# Deployment Setup

This guide deploys the app from GitHub Actions to a private Google Cloud Run service.

## Prerequisites

You need:

- A Google Cloud account with billing enabled
- A Google Cloud project
- A GitHub repository containing this application
- Permission to administer both the GCP project and GitHub repository
- Google Cloud Shell or a local installation of `gcloud`

Set these values before running the commands:

```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="YOUR_GCP_REGION"
export GITHUB_REPO="GITHUB_USERNAME/REPOSITORY_NAME"

export SERVICE_NAME="drive-text-editor"
export ARTIFACT_REPOSITORY="drive-text-editor"
export DEPLOYER_NAME="github-deployer"
export WIF_POOL_ID="github-actions"
export WIF_PROVIDER_ID="github"
```

Example region:

```bash
export REGION="australia-southeast1"
```

Select the project:

```bash
gcloud config set project "$PROJECT_ID"
```

Confirm it:

```bash
gcloud config get-value project
```

## 1. Link billing

In Google Cloud Console:

1. Open **Billing**
2. Select **My projects**
3. Link the project to a billing account

Cloud Run can scale to zero, but Google Cloud generally requires billing to be enabled.

## 2. Enable required APIs

Run:

```bash
gcloud services enable \
  drive.googleapis.com \
  picker.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  iap.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com
```

The relevant services are:

- **Google Drive API** — reads and modifies Drive files
- **Google Picker API** — displays the Google Drive file picker
- **Cloud Run API** — runs the application container
- **Artifact Registry API** — stores container images
- **IAM APIs** — manage deployment identities and permissions
- **Security Token Service** — exchanges GitHub OIDC tokens for temporary GCP credentials
- **IAP API** — protects the browser application with Google sign-in

## 3. Configure the Google OAuth consent screen

In Google Cloud Console:

1. Open **Google Auth Platform**
2. Open **Branding**
3. Configure:
   - App name: `Personal Drive Text Editor`
   - User support email: your email
   - Developer contact email: your email
4. Open **Audience**
5. Select **External**
6. Leave the application in **Testing**
7. Add every Google account that should use the application under **Test users**

## 4. Declare the Drive scope

Open:

**Google Auth Platform → Data Access → Add or remove scopes**

For full Drive browsing and file management, add:

```text
https://www.googleapis.com/auth/drive
```

This permits the application to:

- List Drive files and folders
- Read file contents
- Create files and folders
- Edit and rename files
- Move files
- Delete files

The same scope must be requested in `public/app.js`:

```js
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
```

For a more restricted per-file application, use this instead:

```text
https://www.googleapis.com/auth/drive.file
```

`drive.file` limits access to files selected through Google Picker or created by the application.

## 5. Create the browser OAuth client

Open:

**Google Auth Platform → Clients → Create client**

Configure:

```text
Application type: Web application
Name: Personal Drive Text Editor Web
```

The Cloud Run URL does not exist yet, so the authorized JavaScript origin can initially be left empty.

Create the client and record the:

```text
OAuth client ID
```

Do not put the OAuth client secret in the application or GitHub repository. This application uses the browser OAuth token flow and does not require the client secret.

## 6. Create the Google Picker API key

Open:

**APIs & Services → Credentials → Create credentials → API key**

Name it:

```text
drive-text-editor-picker-key
```

Configure:

```text
API restrictions:
  Restrict key
  Google Picker API
```

Leave the website restriction unset temporarily because the Cloud Run URL does not exist yet.

Record the API key.

## 7. Get the GCP project number

Run:

```bash
export PROJECT_NUMBER="$(
  gcloud projects describe "$PROJECT_ID" \
    --format="value(projectNumber)"
)"

echo "$PROJECT_NUMBER"
```

Record this value.

## 8. Create the Artifact Registry repository

Run:

```bash
gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Container images for Drive Text Editor"
```

If it already exists, this command can be skipped.

## 9. Create the GitHub deployment service account

Run:

```bash
gcloud iam service-accounts create "$DEPLOYER_NAME" \
  --display-name="GitHub Actions deployer"
```

Set its email:

```bash
export DEPLOYER_EMAIL="${DEPLOYER_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "$DEPLOYER_EMAIL"
```

## 10. Grant deployment permissions

Allow the deployment service account to deploy Cloud Run revisions:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/run.admin"
```

Allow it to upload container images:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/artifactregistry.writer"
```

Allow deployment tools to consume enabled project services:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

## 11. Allow the deployer to use the Cloud Run runtime identity

The default Cloud Run runtime service account is:

```bash
export RUNTIME_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

Permit the GitHub deployer to attach it to Cloud Run revisions:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$RUNTIME_SERVICE_ACCOUNT" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

This does not give the GitHub deployer the runtime service account's permissions. It permits the deployer to create a Cloud Run revision that runs as that identity.

## 12. Create the Workload Identity Pool

Workload Identity Federation allows GitHub Actions to authenticate without storing a permanent Google service-account key.

Create the pool:

```bash
gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
  --location="global" \
  --display-name="GitHub Actions"
```

Create the GitHub OIDC provider:

```bash
gcloud iam workload-identity-pools providers create-oidc \
  "$WIF_PROVIDER_ID" \
  --location="global" \
  --workload-identity-pool="$WIF_POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
```

The condition limits authentication to the specified GitHub repository.

## 13. Allow GitHub to impersonate the deployer

Run:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$DEPLOYER_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/attribute.repository/${GITHUB_REPO}"
```

Build the provider identifier:

```bash
export WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/providers/${WIF_PROVIDER_ID}"
```

Print the values needed by GitHub:

```bash
echo "WIF_PROVIDER=${WIF_PROVIDER}"
echo "DEPLOYER_SERVICE_ACCOUNT=${DEPLOYER_EMAIL}"
```

## 14. Add GitHub Actions secrets

In the GitHub repository, open:

**Settings → Secrets and variables → Actions → Repository secrets**

Create:

```text
GOOGLE_CLIENT_ID
GOOGLE_PICKER_API_KEY
GOOGLE_PROJECT_NUMBER
WIF_PROVIDER
DEPLOYER_SERVICE_ACCOUNT
```

Values:

```text
GOOGLE_CLIENT_ID
  OAuth browser client ID

GOOGLE_PICKER_API_KEY
  Restricted Google Picker API key

GOOGLE_PROJECT_NUMBER
  Numeric GCP project number

WIF_PROVIDER
  Full Workload Identity Provider identifier

DEPLOYER_SERVICE_ACCOUNT
  GitHub deployment service-account email
```

The WIF provider and service-account email are identifiers rather than credentials, so they may alternatively be stored as repository variables. The workflow supplied with this repository expects repository secrets unless changed.

## 15. Check the application configuration template

`public/config.js` should contain placeholders rather than real values:

```js
window.APP_CONFIG = {
  clientId: "__GOOGLE_CLIENT_ID__",
  apiKey: "__GOOGLE_PICKER_API_KEY__",
  appId: "__GOOGLE_PROJECT_NUMBER__",
};
```

The GitHub Actions workflow replaces these placeholders during the build.

Make sure `.gitignore` includes:

```gitignore
.env
.env.*
!.env.example
credentials/
secrets/
gha-creds-*.json
```

Do not commit:

- OAuth client secrets
- Service-account JSON keys
- OAuth access or refresh tokens
- GitHub personal access tokens

## 16. Configure the GitHub Actions workflow

Create:

```text
.github/workflows/deploy.yml
```

Use:

```yaml
name: Build and deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

env:
  PROJECT_ID: YOUR_GCP_PROJECT_ID
  REGION: YOUR_GCP_REGION
  REPOSITORY: drive-text-editor
  SERVICE: drive-text-editor
  IMAGE: drive-text-editor

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Generate browser configuration
        env:
          GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          GOOGLE_PICKER_API_KEY: ${{ secrets.GOOGLE_PICKER_API_KEY }}
          GOOGLE_PROJECT_NUMBER: ${{ secrets.GOOGLE_PROJECT_NUMBER }}
        run: |
          python3 - <<'PY'
          import json
          import os
          from pathlib import Path

          required = [
              "GOOGLE_CLIENT_ID",
              "GOOGLE_PICKER_API_KEY",
              "GOOGLE_PROJECT_NUMBER",
          ]

          missing = [name for name in required if not os.environ.get(name)]

          if missing:
              raise RuntimeError(
                  "Missing GitHub secrets: " + ", ".join(missing)
              )

          config = {
              "clientId": os.environ["GOOGLE_CLIENT_ID"],
              "apiKey": os.environ["GOOGLE_PICKER_API_KEY"],
              "appId": os.environ["GOOGLE_PROJECT_NUMBER"],
          }

          Path("public/config.js").write_text(
              "window.APP_CONFIG = " + json.dumps(config) + ";\n",
              encoding="utf-8",
          )
          PY

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.DEPLOYER_SERVICE_ACCOUNT }}

      - name: Install Google Cloud CLI
        uses: google-github-actions/setup-gcloud@v3

      - name: Configure Docker authentication
        run: |
          gcloud auth configure-docker \
            "${REGION}-docker.pkg.dev" \
            --quiet

      - name: Build and push image
        env:
          IMAGE_URI: ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE }}:${{ github.sha }}
        run: |
          docker build --tag "$IMAGE_URI" .
          docker push "$IMAGE_URI"

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v3
        with:
          service: ${{ env.SERVICE }}
          region: ${{ env.REGION }}
          image: ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE }}:${{ github.sha }}
          flags: >-
            --no-allow-unauthenticated
            --min-instances=0
            --max-instances=1
            --cpu=1
            --memory=256Mi
```

Replace:

```text
YOUR_GCP_PROJECT_ID
YOUR_GCP_REGION
```

Commit and push:

```bash
git add .
git commit -m "Configure Google Cloud deployment"
git push
```

A push to `main` triggers the workflow immediately. It can also be run manually from the GitHub **Actions** tab.

## 17. Get the Cloud Run URL

After deployment succeeds, run:

```bash
gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" \
  --format="value(status.url)"
```

Save the returned URL:

```bash
export CLOUD_RUN_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --format="value(status.url)"
)"

echo "$CLOUD_RUN_URL"
```

## 18. Add the OAuth JavaScript origin

Open:

**Google Auth Platform → Clients → the web OAuth client**

Under **Authorized JavaScript origins**, add the exact Cloud Run origin:

```text
https://YOUR_CLOUD_RUN_HOSTNAME
```

Requirements:

- Include `https://`
- Do not include a trailing slash
- Do not put it under redirect URIs
- Use the exact origin returned by Cloud Run

Example form:

```text
https://drive-text-editor-example.a.run.app
```

## 19. Restrict the Picker API key

Open:

**APIs & Services → Credentials → drive-text-editor-picker-key**

Set:

```text
Application restrictions:
  Websites
```

Add:

```text
https://YOUR_CLOUD_RUN_HOSTNAME/*
```

Keep:

```text
API restrictions:
  Google Picker API only
```

The API key is visible in browser JavaScript by design. These restrictions prevent it from being reused from unrelated websites or with unrelated APIs.

## 20. Enable IAP for private browser access

In Google Cloud Console:

1. Open **Cloud Run**
2. Select the deployed service
3. Open **Security**
4. Enable **Identity-Aware Proxy**
5. Keep unauthenticated access disabled

IAP presents a normal Google sign-in flow before forwarding requests to the Cloud Run container.

## 21. Grant users access through IAP

For each Google account that should access the application, run:

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service="$SERVICE_NAME" \
  --region="$REGION" \
  --member="user:USER_EMAIL_ADDRESS" \
  --role="roles/iap.httpsResourceAccessor"
```

Example placeholder:

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service="$SERVICE_NAME" \
  --region="$REGION" \
  --member="user:user@example.com" \
  --role="roles/iap.httpsResourceAccessor"
```

The role is displayed in the console as:

```text
IAP-Secured Web App User
```

If the OAuth app remains in Testing, also add that account under:

**Google Auth Platform → Audience → Test users**

IAP access and OAuth test-user access are separate:

- IAP controls who may open the Cloud Run application
- OAuth controls who may grant the application access to their Drive

## 22. Add an Artifact Registry cleanup policy

Each deployment pushes a new image version. Configure cleanup so old versions do not accumulate indefinitely.

Create a temporary policy file:

```bash
cat > cleanup-policy.json <<'EOF'
[
  {
    "name": "keep-recent",
    "action": {
      "type": "Keep"
    },
    "mostRecentVersions": {
      "keepCount": 3
    }
  },
  {
    "name": "delete-old",
    "action": {
      "type": "Delete"
    },
    "condition": {
      "tagState": "any",
      "olderThan": "86400s"
    }
  }
]
EOF
```

Apply it:

```bash
gcloud artifacts repositories set-cleanup-policies \
  "$ARTIFACT_REPOSITORY" \
  --location="$REGION" \
  --policy="cleanup-policy.json"
```

Delete the temporary local file:

```bash
rm cleanup-policy.json
```

This keeps the newest three versions and allows older versions to be removed.

## 23. Test the deployment

Open the Cloud Run URL in a browser.

Expected sequence:

1. IAP asks you to sign in
2. IAP verifies that your account has `roles/iap.httpsResourceAccessor`
3. Cloud Run returns the editor
4. Clicking **Open from Drive** starts browser OAuth
5. Google displays the Drive consent screen
6. Google Picker opens
7. The browser calls the Drive API using the user's short-lived OAuth token

The Drive access token stays in browser memory. Cloud Run only serves the static application files and does not need to receive or store the Drive token.

## 24. Troubleshooting

### IAP says access is denied

Confirm the user has the IAP role:

```bash
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service="$SERVICE_NAME" \
  --region="$REGION" \
  --member="user:USER_EMAIL_ADDRESS" \
  --role="roles/iap.httpsResourceAccessor"
```

Wait one or two minutes for IAM propagation.

### OAuth reports `origin_mismatch`

Add the exact Cloud Run origin to:

```text
Google Auth Platform
→ Clients
→ Authorized JavaScript origins
```

Do not add a path or trailing slash.

### OAuth says the app is restricted to test users

Add the account under:

```text
Google Auth Platform
→ Audience
→ Test users
```

### Google Picker reports an API-key or referrer error

Verify that the Picker API key permits:

```text
https://YOUR_CLOUD_RUN_HOSTNAME/*
```

and is restricted to:

```text
Google Picker API
```

### GitHub authentication fails

Verify these repository secrets:

```text
WIF_PROVIDER
DEPLOYER_SERVICE_ACCOUNT
```

Confirm that the Workload Identity Provider condition matches the exact repository slug:

```text
GITHUB_USERNAME/REPOSITORY_NAME
```

Repository names and GitHub usernames are case-sensitive in identity claims.

### Cloud Run deployment cannot act as the runtime service account

Reapply:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$RUNTIME_SERVICE_ACCOUNT" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

### Cloud Run returns 403 before IAP is enabled

A private IAM-protected Cloud Run service does not automatically receive an identity token from an ordinary browser request. Enable IAP for normal interactive browser sign-in.

## Security summary

The deployed architecture is:

```text
Browser
   │
   │ Google sign-in
   ▼
Identity-Aware Proxy
   │
   │ authorized users only
   ▼
Private Cloud Run service
   │
   │ HTML, CSS and JavaScript
   ▼
Browser application
   │
   │ user's short-lived OAuth token
   ▼
Google Drive API
```

GitHub deployment authentication is:

```text
GitHub Actions
   │
   │ short-lived GitHub OIDC token
   ▼
GCP Workload Identity Provider
   │
   │ repository identity verified
   ▼
GitHub deployment service account
   ├── upload image to Artifact Registry
   └── deploy revision to Cloud Run
```

No permanent GCP service-account key is stored in GitHub.