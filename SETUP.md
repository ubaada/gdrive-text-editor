# Infrastructure Setup

This guide assumes you already have a checkout of this repository. It covers:

1. Building the supplied Docker image and deploying it privately to Google
   Cloud Run
2. Optionally configuring a fork to deploy through the supplied GitHub Actions
   workflow

It does not cover application development or local test setup.

## Prerequisites

For a direct deployment, you need:

- A Google Cloud account with billing enabled
- A Google Cloud project you can administer
- `gcloud` and Docker
- A Google account that will be allowed to use the deployed application

Set the deployment values:

```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="YOUR_GCP_REGION"
export SERVICE_NAME="drive-text-editor"
export ARTIFACT_REPOSITORY="drive-text-editor"
export IMAGE_NAME="drive-text-editor"
export RUNTIME_NAME="drive-text-editor-runtime"

gcloud auth login
gcloud config set project "$PROJECT_ID"
```

Skip `gcloud auth login` when Cloud Shell already has the correct account. For
example, a region might be `australia-southeast1`.

## Prepare Google Cloud

Link the project to a billing account in **Billing -> My projects**, then enable
the required APIs:

```bash
gcloud services enable \
  drive.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  iap.googleapis.com \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com
```

The browser calls the Drive API directly. Cloud Run only serves the static
HTML, CSS, and JavaScript in the image.

## Configure Drive OAuth

### Consent screen

In **Google Auth Platform**:

1. Open **Branding** and provide the app name, support email, and developer
   contact email.
2. Open **Audience** and select **External**.
3. Leave the app in **Testing** for a private deployment.
4. Add every Google account that should use the app as a test user.

Under **Data Access**, declare this scope:

```text
https://www.googleapis.com/auth/drive
```

The custom explorer needs full Drive access to list ordinary existing files.
The narrower `drive.file` scope requires a Picker-based selection flow, which
this application does not implement.

Full Drive access is a restricted OAuth scope. Testing mode is suitable for a
private deployment with named test users, but Google applies testing limits and
users may need to authorize again. Publishing for broader use can require
Google verification and additional security review.

### Browser client

In **Google Auth Platform -> Clients**, create a client with:

```text
Application type: Web application
Name: Drive Text Editor Web
```

The Cloud Run URL does not exist yet, so its authorized JavaScript origin can
be added after the first deployment. Record the OAuth client ID:

```bash
export GOOGLE_CLIENT_ID="YOUR_WEB_OAUTH_CLIENT_ID"
```

The browser flow does not use the OAuth client secret. Never put that secret in
the image, repository, or GitHub Actions.

## Create The Image Repository

Create an Artifact Registry Docker repository:

```bash
gcloud artifacts repositories create "$ARTIFACT_REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Container images for Drive Text Editor"
```

Skip this command if the repository already exists.

Configure Docker authentication:

```bash
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
```

## Create The Runtime Identity

The static nginx container does not need permission to call Google Cloud APIs.
Create a dedicated service account without project roles:

```bash
gcloud iam service-accounts create "$RUNTIME_NAME" \
  --display-name="Drive Text Editor runtime"

export RUNTIME_SERVICE_ACCOUNT="${RUNTIME_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
```

Skip the create command if the account already exists.

## Build And Deploy

The Dockerfile accepts the browser OAuth client ID as a build argument. The
client ID is a public browser identifier, not a client secret. Build and push an
image tagged with a unique deployment tag:

```bash
export IMAGE_TAG="$(date -u +%Y%m%d-%H%M%S)"
export IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

docker build \
  --build-arg "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  --tag "$IMAGE_URI" \
  .
docker push "$IMAGE_URI"
```

Deploy a private Cloud Run service:

```bash
gcloud run deploy "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE_URI" \
  --service-account="$RUNTIME_SERVICE_ACCOUNT" \
  --no-allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --cpu=1 \
  --memory=256Mi
```

Get the service URL:

```bash
export CLOUD_RUN_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(status.url)"
)"

echo "$CLOUD_RUN_URL"
```

The private service returns 403 to an ordinary browser until IAP is enabled.

## Add The Browser Origin

Open the web OAuth client in **Google Auth Platform -> Clients**. Add the exact
Cloud Run URL under **Authorized JavaScript origins**.

Requirements:

- Include `https://`.
- Do not include a trailing slash.
- Do not include a path.
- Do not add it as a redirect URI.

Example:

```text
https://drive-text-editor-example.a.run.app
```

## Enable Private Browser Access

In the Google Cloud console:

1. Open **Cloud Run** and select the service.
2. Open **Security**.
3. Under **Require authentication**, select **Identity-Aware Proxy (IAP)**.
4. Keep unauthenticated access disabled and save.

The console enables IAP and grants its service agent permission to invoke the
Cloud Run service.

For a project without a Google Cloud organization, or for users outside the
project's organization, complete IAP's one-time external-user configuration:

1. Under the service's IAP policy, select **Configure in IAP**.
2. Configure an External consent screen.
3. Let IAP auto-generate credentials, or configure a dedicated IAP OAuth
   client.

The IAP OAuth client is separate from the browser client used for Drive access.
Never put an IAP client secret in `public/config.js` or GitHub Actions.

Grant each user access:

```bash
gcloud iap web add-iam-policy-binding \
  --project="$PROJECT_ID" \
  --resource-type=cloud-run \
  --service="$SERVICE_NAME" \
  --region="$REGION" \
  --member="user:USER_EMAIL_ADDRESS" \
  --role="roles/iap.httpsResourceAccessor"
```

While the Drive OAuth app remains in Testing, the same account must also be a
test user under **Google Auth Platform -> Audience**.

IAP and Drive OAuth enforce separate permissions:

- IAP controls who may open the application.
- Drive OAuth controls who may grant the browser access to their Drive.

## Verify The Deployment

Open the Cloud Run URL in a browser. The expected sequence is:

1. IAP asks you to sign in.
2. Cloud Run returns the editor.
3. Clicking **REFRESH** in Files mode starts browser OAuth.
4. Google displays the Drive consent screen.
5. The custom explorer lists the user's files and folders.

The Drive access token remains in browser memory. Cloud Run does not receive or
store it.

## Optional Cleanup Policy

Each deployment pushes a new image. To retain the newest three versions and
delete older versions, create a temporary policy file:

```bash
cat > cleanup-policy.json <<'EOF'
[
  {
    "name": "keep-recent",
    "action": { "type": "Keep" },
    "mostRecentVersions": { "keepCount": 3 }
  },
  {
    "name": "delete-old",
    "action": { "type": "Delete" },
    "condition": {
      "tagState": "any",
      "olderThan": "86400s"
    }
  }
]
EOF

gcloud artifacts repositories set-cleanup-policies \
  "$ARTIFACT_REPOSITORY" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --policy="cleanup-policy.json"

rm cleanup-policy.json
```

## Optional GitHub Actions Setup

This section is only for maintainers who want their fork to deploy on pushes to
`main`. The repository already contains `.github/workflows/deploy.yml`; do not
create another workflow.

### Additional values

Set:

```bash
export DEPLOYER_NAME="github-deployer"
export WIF_POOL_ID="github-actions"
export WIF_PROVIDER_ID="github"
export GITHUB_REPOSITORY_ID="NUMERIC_GITHUB_REPOSITORY_ID"
export GITHUB_OWNER_ID="NUMERIC_GITHUB_OWNER_ID"
```

Find the immutable `id` and `owner.id` values at:

```text
https://api.github.com/repos/GITHUB_USERNAME/REPOSITORY_NAME
```

Numeric IDs are used for deployment trust because repository and owner names
can be renamed or reused. Deployment credentials are also restricted to the
`main` branch.

Get the Google Cloud project number:

```bash
export PROJECT_NUMBER="$(
  gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)"
)"
```

### Deployment service account

Create the GitHub deployment identity:

```bash
gcloud iam service-accounts create "$DEPLOYER_NAME" \
  --display-name="GitHub Actions deployer"

export DEPLOYER_EMAIL="${DEPLOYER_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
```

Grant only the permissions needed to push images and deploy revisions:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/serviceusage.serviceUsageConsumer"

gcloud iam service-accounts add-iam-policy-binding \
  "$RUNTIME_SERVICE_ACCOUNT" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/iam.serviceAccountUser"
```

The final binding permits the deployer to attach the runtime identity to a
revision; it does not grant the runtime identity's permissions to the deployer.

### Workload Identity Federation

Create a pool and GitHub OIDC provider:

```bash
gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc \
  "$WIF_PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$WIF_POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id=='${GITHUB_REPOSITORY_ID}' && assertion.repository_owner_id=='${GITHUB_OWNER_ID}' && assertion.ref=='refs/heads/main'"
```

Allow only that repository ID to impersonate the deployment account:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$DEPLOYER_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/attribute.repository_id/${GITHUB_REPOSITORY_ID}"
```

Build the provider identifier:

```bash
export WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/providers/${WIF_PROVIDER_ID}"
```

### GitHub configuration

Add these repository secrets under **Settings -> Secrets and variables ->
Actions**:

```text
GOOGLE_CLIENT_ID
WIF_PROVIDER
DEPLOYER_SERVICE_ACCOUNT
```

Use these values:

```text
GOOGLE_CLIENT_ID
  Web OAuth client ID used by the browser

WIF_PROVIDER
  Full provider identifier stored in $WIF_PROVIDER

DEPLOYER_SERVICE_ACCOUNT
  Service-account email stored in $DEPLOYER_EMAIL
```

`WIF_PROVIDER` and `DEPLOYER_SERVICE_ACCOUNT` are identifiers rather than
credentials, but the supplied workflow reads them from repository secrets.

Update the deployment-specific values in the workflow's `env` block:

```text
PROJECT_ID
REGION
REPOSITORY
SERVICE
IMAGE
RUNTIME_SERVICE_ACCOUNT
```

The workflow already:

1. Passes `GOOGLE_CLIENT_ID` to the supplied Dockerfile as a build argument.
2. Authenticates through Workload Identity Federation.
3. Builds and pushes the supplied Docker image.
4. Deploys a private Cloud Run revision with the dedicated runtime identity.

It runs on pushes to `main` and through manual `workflow_dispatch` runs of the
`main` branch.

## Troubleshooting

### OAuth reports `origin_mismatch`

Add the exact Cloud Run origin to the web OAuth client's **Authorized
JavaScript origins**. Do not add a path or trailing slash.

### OAuth is restricted to test users

Add the account under **Google Auth Platform -> Audience -> Test users**.

### IAP denies access

Confirm the user has `roles/iap.httpsResourceAccessor` on the Cloud Run IAP
resource. For outside-organization users, also complete the one-time IAP OAuth
configuration.

### GitHub authentication fails

Confirm that:

- `WIF_PROVIDER` and `DEPLOYER_SERVICE_ACCOUNT` contain the expected values.
- The provider condition contains the current numeric `repository_id` and
  `repository_owner_id` values.
- The provider condition requires `refs/heads/main`.
- The repository binding uses the current numeric `repository_id`.

### Deployment cannot use the runtime service account

Reapply the `roles/iam.serviceAccountUser` binding on
`$RUNTIME_SERVICE_ACCOUNT` for `$DEPLOYER_EMAIL`.

### Cloud Run returns 403 before IAP is enabled

This is expected for a private IAM-protected service. Enable IAP for normal
interactive browser sign-in.

## Security Summary

- Cloud Run serves static files and does not receive Drive tokens or contents.
- Browser OAuth access tokens remain in browser memory.
- The runtime service account has no project roles.
- GitHub Actions uses short-lived OIDC credentials instead of a service-account
  key.
- IAP and Drive OAuth independently restrict access.
