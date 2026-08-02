const { clientId, apiKey, appId } = window.APP_CONFIG;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

let tokenClient;
let accessToken = null;
let pickerReady = false;
let pendingPickerRequest = null;
let editor;
let tabs = [];
let activeTabId = null;
let nextTabId = 1;
let nextUntitledNumber = 1;

const newButton = document.getElementById("newButton");
const openButton = document.getElementById("openButton");
const saveButton = document.getElementById("saveButton");
const tabsElement = document.getElementById("tabs");
const filename = document.getElementById("filename");
const status = document.getElementById("status");
const cursorPosition = document.getElementById("cursorPosition");
const documentStats = document.getElementById("documentStats");
const textEncoder = new TextEncoder();

function setStatus(message) {
  status.textContent = message;
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

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

function createTab({ name, content = "", file = null, dirty = false }) {
  const tab = {
    id: nextTabId++,
    name,
    file,
    dirty,
    model: monaco.editor.createModel(content, languageFromFilename(name)),
  };

  tab.model.onDidChangeContent(() => {
    if (tab.id === activeTabId) {
      updateEditorStats();
    }

    if (tab.dirty) {
      return;
    }

    tab.dirty = true;
    renderTabs();
    updateActiveFileDisplay();
  });

  tabs.push(tab);
  activateTab(tab.id);
  return tab;
}

function createUntitledTab() {
  createTab({
    name: `Untitled ${nextUntitledNumber++}`,
    dirty: true,
  });
  setStatus("NEW BUFFER");
}

function activateTab(tabId) {
  const tab = tabs.find((candidate) => candidate.id === tabId);
  if (!tab) {
    return;
  }

  activeTabId = tab.id;
  editor.setModel(tab.model);
  editor.updateOptions({ readOnly: false });
  saveButton.disabled = false;
  renderTabs();
  updateActiveFileDisplay();
  editor.focus();
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) {
    return;
  }

  const tab = tabs[index];
  if (tab.dirty && !confirm(`Close ${tab.name} without saving?`)) {
    return;
  }

  tabs.splice(index, 1);
  tab.model.dispose();

  if (activeTabId === tabId) {
    const replacement = tabs[index] || tabs[index - 1];
    if (replacement) {
      activateTab(replacement.id);
    } else {
      activeTabId = null;
      editor.setModel(null);
      editor.updateOptions({ readOnly: true });
      saveButton.disabled = true;
      renderTabs();
      updateActiveFileDisplay();
    }
  } else {
    renderTabs();
  }
}

function renderTabs() {
  tabsElement.replaceChildren();

  for (const tab of tabs) {
    const tabElement = document.createElement("div");
    tabElement.className = "tab";
    tabElement.setAttribute("role", "tab");
    tabElement.setAttribute("aria-selected", String(tab.id === activeTabId));

    const selectButton = document.createElement("button");
    selectButton.className = "tab-select";
    selectButton.type = "button";
    selectButton.title = tab.name;
    selectButton.textContent = tab.name;
    selectButton.addEventListener("click", () => activateTab(tab.id));

    const closeButton = document.createElement("button");
    closeButton.className = "tab-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", `Close ${tab.name}`);
    closeButton.textContent = tab.dirty ? "●" : "X";
    closeButton.addEventListener("click", () => closeTab(tab.id));

    tabElement.append(selectButton, closeButton);
    tabsElement.append(tabElement);
  }
}

function updateActiveFileDisplay() {
  const tab = getActiveTab();
  filename.textContent = tab
    ? `${tab.dirty ? "MODIFIED | " : ""}${tab.name}`
    : "NO FILE";
  updateEditorStats();
}

function updateEditorStats() {
  const tab = getActiveTab();
  if (!tab) {
    cursorPosition.textContent = "LN --, COL --";
    documentStats.textContent = "0 LINES | 0 WORDS | 0 CHARS | 0 BYTES";
    return;
  }

  const value = tab.model.getValue();
  const position = editor.getPosition() || { lineNumber: 1, column: 1 };
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
  const characters = [...value].length;
  const bytes = textEncoder.encode(value).length;

  cursorPosition.textContent = `LN ${position.lineNumber}, COL ${position.column}`;
  documentStats.textContent = `${tab.model.getLineCount()} LINES | ${words} WORDS | ${characters} CHARS | ${bytes} BYTES`;
}

require.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs",
  },
});

require(["vs/editor/editor.main"], () => {
  monaco.editor.defineTheme("terminal-monochrome", {
    base: "vs-dark",
    inherit: false,
    rules: [{ token: "", foreground: "8CFF66" }],
    colors: {
      "editor.background": "#020602",
      "editor.foreground": "#8CFF66",
      "editorCursor.foreground": "#8CFF66",
      "editorLineNumber.foreground": "#397C2D",
      "editorLineNumber.activeForeground": "#8CFF66",
      "editor.selectionBackground": "#285C22",
      "editor.inactiveSelectionBackground": "#173A16",
      "editor.lineHighlightBackground": "#071007",
      "editorWhitespace.foreground": "#397C2D",
      "editorIndentGuide.background1": "#173A16",
      "editorIndentGuide.activeBackground1": "#397C2D",
    },
  });

  editor = monaco.editor.create(document.getElementById("editor"), {
    model: null,
    theme: "terminal-monochrome",
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: "on",
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: 14,
    lineNumbersMinChars: 3,
    padding: { top: 8 },
    readOnly: true,
  });
  editor.onDidChangeCursorPosition(updateEditorStats);
  newButton.disabled = false;
  openButton.disabled = false;
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
        setStatus(`AUTH FAILED: ${response.error}`);
        return;
      }

      accessToken = response.access_token;
      const request = pendingPickerRequest;
      pendingPickerRequest = null;
      if (request) {
        showPicker(request.mode, request.tabId);
      }
    },
  });
});

window.addEventListener("beforeunload", (event) => {
  if (tabs.some((tab) => tab.dirty)) {
    event.preventDefault();
  }
});

newButton.addEventListener("click", createUntitledTab);
openButton.addEventListener("click", () => requestPicker("file"));
saveButton.addEventListener("click", saveFile);

document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    saveFile();
  } else if (key === "n") {
    event.preventDefault();
    createUntitledTab();
  } else if (key === "o") {
    event.preventDefault();
    requestPicker("file");
  }
});

function requestPicker(mode, tabId = null) {
  if (!pickerReady) {
    setStatus("PICKER LOADING");
    return;
  }

  if (!accessToken) {
    pendingPickerRequest = { mode, tabId };
    tokenClient.requestAccessToken({ prompt: "consent" });
    return;
  }

  showPicker(mode, tabId);
}

function showPicker(mode, tabId) {
  const view = new google.picker.DocsView()
    .setMode(google.picker.DocsViewMode.LIST)
    .setIncludeFolders(mode === "folder")
    .setSelectFolderEnabled(mode === "folder");

  if (mode === "folder") {
    view.setMimeTypes(FOLDER_MIME_TYPE);
  }

  const picker = new google.picker.PickerBuilder()
    .setDeveloperKey(apiKey)
    .setAppId(appId)
    .setOAuthToken(accessToken)
    .addView(view)
    .setTitle(mode === "folder" ? "Choose a folder for this file" : "Open from Drive")
    .setCallback((data) => handlePickerResult(data, mode, tabId))
    .build();

  picker.setVisible(true);
}

async function handlePickerResult(data, mode, tabId) {
  if (data.action !== google.picker.Action.PICKED) {
    return;
  }

  const selected = data.docs[0];
  if (mode === "folder") {
    await createDriveFile(selected.id, tabId);
  } else {
    await openDriveFile(selected.id);
  }
}

async function openDriveFile(fileId) {
  const existingTab = tabs.find((tab) => tab.file?.id === fileId);
  if (existingTab) {
    activateTab(existingTab.id);
    setStatus("ALREADY OPEN");
    return;
  }

  try {
    setStatus("LOADING");
    const metadataResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}?fields=id,name,mimeType,parents`
    );
    const file = await metadataResponse.json();

    if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      throw new Error("Google workspace files are not plain text.");
    }

    const contentResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        file.id
      )}?alt=media`
    );
    const content = await contentResponse.text();

    createTab({ name: file.name, content, file });
    setStatus("LOADED");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
}

async function saveFile() {
  const tab = getActiveTab();
  if (!tab) {
    return;
  }

  if (!tab.file) {
    requestPicker("folder", tab.id);
    return;
  }

  try {
    saveButton.disabled = true;
    setStatus("SAVING");
    await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": tab.file.mimeType || "text/plain; charset=utf-8",
        },
        body: tab.model.getValue(),
      }
    );

    tab.dirty = false;
    renderTabs();
    updateActiveFileDisplay();
    setStatus("SAVED");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    saveButton.disabled = false;
  }
}

async function createDriveFile(folderId, tabId) {
  const tab = tabs.find((candidate) => candidate.id === tabId);
  if (!tab || tab.file) {
    return;
  }

  const name = prompt("Filename, including extension:", tab.name);
  if (!name?.trim()) {
    setStatus("SAVE CANCELLED");
    return;
  }

  try {
    saveButton.disabled = true;
    setStatus("CREATING");
    const boundary = `drive_editor_${Date.now()}`;
    const metadata = {
      name: name.trim(),
      mimeType: "text/plain",
      parents: [folderId],
    };
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      tab.model.getValue(),
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents",
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    tab.file = await response.json();
    tab.name = tab.file.name;
    tab.dirty = false;
    monaco.editor.setModelLanguage(tab.model, languageFromFilename(tab.name));
    renderTabs();
    updateActiveFileDisplay();
    setStatus("SAVED");
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
    throw new Error("Google authorization expired. Try again.");
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response;
}
