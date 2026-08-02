const { clientId, apiKey, appId } = window.APP_CONFIG;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

let tokenClient;
let accessToken = null;
let pickerReady = false;
let editor;
let currentFile = null;

const newButton = document.getElementById("newButton");
const openButton = document.getElementById("openButton");
const saveButton = document.getElementById("saveButton");
const filename = document.getElementById("filename");
const status = document.getElementById("status");

function setStatus(message) {
  status.textContent = message;
}

async function createFile() {
  const name = prompt("Filename, including extension:");

  if (!name?.trim()) {
    return;
  }

  try {
    setStatus("Creating…");

    const response = await driveFetch(
      "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          mimeType: "text/plain",
        }),
      }
    );

    currentFile = await response.json();

    editor.setValue("");
    monaco.editor.setModelLanguage(
      editor.getModel(),
      languageFromFilename(currentFile.name)
    );

    filename.textContent = currentFile.name;
    saveButton.disabled = false;
    setStatus("Created");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
}

newButton.addEventListener("click", createFile);


function languageFromFilename(name) {
  const extension = name.split(".").pop()?.toLowerCase();

  const languages = {
    js: "javascript",
    ts: "typescript",
    json: "json",
    md: "markdown",
    html: "html",
    css: "css",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    go: "go",
    java: "java",
    sh: "shell",
    txt: "plaintext",
  };

  return languages[extension] || "plaintext";
}

require.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
  },
});

require(["vs/editor/editor.main"], () => {
  editor = monaco.editor.create(document.getElementById("editor"), {
    value: "",
    language: "plaintext",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: "on",
  });
});

window.addEventListener("load", () => {
  gapi.load("picker", {
    callback: () => {
      pickerReady = true;
    },
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      if (response.error) {
        setStatus(`Authorization failed: ${response.error}`);
        return;
      }

      accessToken = response.access_token;
      showPicker();
    },
  });
});

openButton.addEventListener("click", () => {
  if (!pickerReady) {
    setStatus("Google Picker is still loading.");
    return;
  }

  if (!accessToken) {
    tokenClient.requestAccessToken({ prompt: "consent" });
    return;
  }

  showPicker();
});

saveButton.addEventListener("click", saveFile);

function showPicker() {
const view = new google.picker.DocsView()
  .setMode(google.picker.DocsViewMode.LIST)
  .setIncludeFolders(false)
  .setSelectFolderEnabled(false);

  const picker = new google.picker.PickerBuilder()
    .setDeveloperKey(apiKey)
    .setAppId(appId)
    .setOAuthToken(accessToken)
    .addView(view)
    .setCallback(handlePickerResult)
    .build();

  picker.setVisible(true);
}

async function handlePickerResult(data) {
  if (data.action !== google.picker.Action.PICKED) {
    return;
  }

  const selected = data.docs[0];

  try {
    setStatus("Loading…");

    const metadataResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        selected.id
      )}?fields=id,name,mimeType`
    );

    currentFile = await metadataResponse.json();

    if (currentFile.mimeType.startsWith("application/vnd.google-apps.")) {
      throw new Error(
        "Google Docs, Sheets and Slides are not plain-text Drive files."
      );
    }

    const contentResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        currentFile.id
      )}?alt=media`
    );

    const content = await contentResponse.text();

    editor.setValue(content);
    monaco.editor.setModelLanguage(
      editor.getModel(),
      languageFromFilename(currentFile.name)
    );

    filename.textContent = currentFile.name;
    saveButton.disabled = false;
    setStatus("Loaded");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
}

async function saveFile() {
  if (!currentFile) {
    return;
  }

  try {
    saveButton.disabled = true;
    setStatus("Saving…");

    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        currentFile.id
      )}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": currentFile.mimeType || "text/plain; charset=utf-8",
        },
        body: editor.getValue(),
      }
    );

    setStatus("Saved");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    saveButton.disabled = false;
  }
}

async function driveFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    accessToken = null;
    throw new Error("Google authorization expired. Open the file again.");
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response;
}