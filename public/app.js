const { clientId, apiKey, appId } = window.APP_CONFIG;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const THEME_STORAGE_KEY = "drive-edit-theme";
const DRAFT_DATABASE_NAME = "drive-edit-recovery";
const DRAFT_STORE_NAME = "drafts";
const DRAFT_SAVE_DELAY = 500;
const TEXT_APPLICATION_MIME_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/json",
  "application/ld+json",
  "application/sql",
  "application/toml",
  "application/x-empty",
  "application/x-httpd-php",
  "application/x-javascript",
  "application/x-sh",
  "application/x-shellscript",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
]);
const THEMES = {
  dark: [
    {
      id: "terminal-green",
      name: "Terminal Green",
      background: "#020602",
      foreground: "#8cff66",
      dim: "#397c2d",
      panel: "#071007",
      selection: "#285c22",
    },
    {
      id: "amber-crt",
      name: "Amber CRT",
      background: "#0b0802",
      foreground: "#ffc15c",
      dim: "#8c6128",
      panel: "#171004",
      selection: "#5e421d",
    },
    {
      id: "midnight-blue",
      name: "Midnight Blue",
      background: "#030812",
      foreground: "#8fc7ff",
      dim: "#3a648d",
      panel: "#07111f",
      selection: "#244f78",
    },
    {
      id: "violet-console",
      name: "Violet Console",
      background: "#0b0610",
      foreground: "#dda7ff",
      dim: "#76518d",
      panel: "#150b1f",
      selection: "#533269",
    },
    {
      id: "carbon-white",
      name: "Carbon White",
      background: "#0a0a0a",
      foreground: "#e4e4e4",
      dim: "#747474",
      panel: "#151515",
      selection: "#3c3c3c",
    },
  ],
  light: [
    {
      id: "paper-ink",
      name: "Paper Ink",
      background: "#f4f0df",
      foreground: "#29291f",
      dim: "#777461",
      panel: "#e5dfc8",
      selection: "#cbc4a9",
    },
    {
      id: "arctic-blue",
      name: "Arctic Blue",
      background: "#eef5f8",
      foreground: "#17384b",
      dim: "#67818e",
      panel: "#dce9ef",
      selection: "#bdd3de",
    },
    {
      id: "sage-terminal",
      name: "Sage Terminal",
      background: "#edf3e8",
      foreground: "#243c28",
      dim: "#6b806c",
      panel: "#dce8d6",
      selection: "#bed0b8",
    },
    {
      id: "rose-print",
      name: "Rose Print",
      background: "#f8eeee",
      foreground: "#4a252c",
      dim: "#916e73",
      panel: "#ecdadd",
      selection: "#dcbfc4",
    },
    {
      id: "solar-sand",
      name: "Solar Sand",
      background: "#f8f0d6",
      foreground: "#463812",
      dim: "#8d7b45",
      panel: "#eee1b8",
      selection: "#dac98d",
    },
  ],
};
const DEFAULT_THEME_PREFERENCES = {
  mode: "dark",
  followSystem: false,
  darkTheme: "terminal-green",
  lightTheme: "paper-ink",
};

let tokenClient;
let accessToken = null;
let pickerReady = false;
let pendingPickerRequest = null;
let editor;
let tabs = [];
let activeTabId = null;
let nextTabId = 1;
let nextUntitledNumber = 1;
let draftDatabasePromise = null;

const newButton = document.getElementById("newButton");
const openButton = document.getElementById("openButton");
const saveButton = document.getElementById("saveButton");
const settingsButton = document.getElementById("settingsButton");
const tabsElement = document.getElementById("tabs");
const filename = document.getElementById("filename");
const status = document.getElementById("status");
const cursorPosition = document.getElementById("cursorPosition");
const documentStats = document.getElementById("documentStats");
const settingsDialog = document.getElementById("settingsDialog");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const recoveryDialog = document.getElementById("recoveryDialog");
const closeRecoveryButton = document.getElementById("closeRecoveryButton");
const recoveryList = document.getElementById("recoveryList");
const darkModeToggle = document.getElementById("darkModeToggle");
const followSystemToggle = document.getElementById("followSystemToggle");
const darkThemeSelect = document.getElementById("darkThemeSelect");
const lightThemeSelect = document.getElementById("lightThemeSelect");
const textEncoder = new TextEncoder();
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let themePreferences = loadThemePreferences();

function loadThemePreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
    return {
      mode: stored?.mode === "light" ? "light" : "dark",
      followSystem:
        typeof stored?.followSystem === "boolean"
          ? stored.followSystem
          : DEFAULT_THEME_PREFERENCES.followSystem,
      darkTheme: THEMES.dark.some((theme) => theme.id === stored?.darkTheme)
        ? stored.darkTheme
        : DEFAULT_THEME_PREFERENCES.darkTheme,
      lightTheme: THEMES.light.some((theme) => theme.id === stored?.lightTheme)
        ? stored.lightTheme
        : DEFAULT_THEME_PREFERENCES.lightTheme,
    };
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES };
  }
}

function populateThemeSelect(select, themes) {
  for (const theme of themes) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    select.append(option);
  }
}

function getActiveTheme() {
  const mode = themePreferences.followSystem
    ? systemTheme.matches
      ? "dark"
      : "light"
    : themePreferences.mode;
  const selectedId = themePreferences[`${mode}Theme`];
  const theme = THEMES[mode].find((candidate) => candidate.id === selectedId);

  return { mode, theme: theme || THEMES[mode][0] };
}

function applyTheme() {
  const { mode, theme } = getActiveTheme();
  document.body.style.setProperty("--background", theme.background);
  document.body.style.setProperty("--ink", theme.foreground);
  document.body.style.setProperty("--dim", theme.dim);
  document.body.style.setProperty("--panel", theme.panel);
  document.body.dataset.themeMode = mode;

  if (typeof monaco === "undefined") {
    return;
  }

  monaco.editor.defineTheme("drive-edit-theme", {
    base: mode === "dark" ? "vs-dark" : "vs",
    inherit: false,
    rules: [{ token: "", foreground: theme.foreground.slice(1) }],
    colors: {
      "editor.background": theme.background,
      "editor.foreground": theme.foreground,
      "editorCursor.foreground": theme.foreground,
      "editorLineNumber.foreground": theme.dim,
      "editorLineNumber.activeForeground": theme.foreground,
      "editor.selectionBackground": theme.selection,
      "editor.inactiveSelectionBackground": theme.panel,
      "editor.lineHighlightBackground": theme.panel,
      "editorWhitespace.foreground": theme.dim,
      "editorIndentGuide.background1": theme.panel,
      "editorIndentGuide.activeBackground1": theme.dim,
      "editorWidget.background": theme.panel,
      "editorWidget.border": theme.foreground,
      "input.background": theme.background,
      "input.foreground": theme.foreground,
      "input.border": theme.dim,
      "dropdown.background": theme.panel,
      "dropdown.foreground": theme.foreground,
      "dropdown.border": theme.dim,
      "list.hoverBackground": theme.selection,
      "list.activeSelectionBackground": theme.foreground,
      "list.activeSelectionForeground": theme.background,
      focusBorder: theme.foreground,
    },
  });
  monaco.editor.setTheme("drive-edit-theme");
}

function updateThemeControls() {
  darkModeToggle.checked = themePreferences.mode === "dark";
  darkModeToggle.disabled = themePreferences.followSystem;
  followSystemToggle.checked = themePreferences.followSystem;
  darkThemeSelect.value = themePreferences.darkTheme;
  lightThemeSelect.value = themePreferences.lightTheme;
  darkThemeSelect.disabled =
    !themePreferences.followSystem && themePreferences.mode !== "dark";
  lightThemeSelect.disabled =
    !themePreferences.followSystem && themePreferences.mode !== "light";
}

function saveThemePreferences() {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themePreferences));
  } catch (error) {
    console.warn("Could not save theme preferences.", error);
  }

  updateThemeControls();
  applyTheme();
}

populateThemeSelect(darkThemeSelect, THEMES.dark);
populateThemeSelect(lightThemeSelect, THEMES.light);
updateThemeControls();
applyTheme();

settingsButton.addEventListener("click", () => settingsDialog.showModal());
closeSettingsButton.addEventListener("click", () => settingsDialog.close());

darkModeToggle.addEventListener("change", () => {
  themePreferences.mode = darkModeToggle.checked ? "dark" : "light";
  saveThemePreferences();
});

followSystemToggle.addEventListener("change", () => {
  themePreferences.followSystem = followSystemToggle.checked;
  saveThemePreferences();
});

darkThemeSelect.addEventListener("change", () => {
  themePreferences.darkTheme = darkThemeSelect.value;
  saveThemePreferences();
});

lightThemeSelect.addEventListener("change", () => {
  themePreferences.lightTheme = lightThemeSelect.value;
  saveThemePreferences();
});

systemTheme.addEventListener("change", () => {
  if (themePreferences.followSystem) {
    applyTheme();
  }
});

closeRecoveryButton.addEventListener("click", () => recoveryDialog.close());

function getDraftDatabase() {
  if (!draftDatabasePromise) {
    draftDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DRAFT_DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(DRAFT_STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return draftDatabasePromise;
}

async function putDraftRecord(record) {
  const database = await getDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE_NAME, "readwrite");
    transaction.objectStore(DRAFT_STORE_NAME).put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function deleteDraftRecord(draftId) {
  const database = await getDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE_NAME, "readwrite");
    transaction.objectStore(DRAFT_STORE_NAME).delete(draftId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getDraftRecords() {
  const database = await getDraftDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(DRAFT_STORE_NAME, "readonly")
      .objectStore(DRAFT_STORE_NAME)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reportDraftFailure(error) {
  console.error(error);
  setStatus("LOCAL RECOVERY FAILED");
}

function queueDraftOperation(tab, operation) {
  tab.draftWritePromise = tab.draftWritePromise
    .catch(() => {})
    .then(operation)
    .catch(reportDraftFailure);
}

function persistDraft(tab) {
  tab.draftTimer = null;
  if (!tab.dirty || tab.model.isDisposed()) {
    return;
  }

  const record = {
    id: tab.draftId,
    name: tab.name,
    content: tab.model.getValue(),
    file: tab.file,
    updatedAt: new Date().toISOString(),
  };
  queueDraftOperation(tab, () => putDraftRecord(record));
}

function scheduleDraftSave(tab, immediate = false) {
  if (!tab.dirty) {
    return;
  }

  clearTimeout(tab.draftTimer);
  if (immediate) {
    persistDraft(tab);
  } else {
    tab.draftTimer = setTimeout(() => persistDraft(tab), DRAFT_SAVE_DELAY);
  }
}

function deleteDraftForTab(tab) {
  clearTimeout(tab.draftTimer);
  tab.draftTimer = null;
  queueDraftOperation(tab, () => deleteDraftRecord(tab.draftId));
}

function syncDraftAfterSave(tab) {
  if (tab.dirty) {
    scheduleDraftSave(tab);
  } else {
    deleteDraftForTab(tab);
  }
}

function removeRecoveryItem(item) {
  item.remove();
  if (!recoveryList.children.length) {
    recoveryDialog.close();
  }
}

function renderRecoveryDrafts(drafts) {
  recoveryList.replaceChildren();

  for (const draft of drafts) {
    const item = document.createElement("div");
    item.className = "recovery-item";
    item.dataset.draftId = draft.id;

    const details = document.createElement("div");
    details.className = "recovery-details";
    const name = document.createElement("span");
    name.className = "recovery-name";
    name.textContent = draft.name;
    const time = document.createElement("span");
    time.className = "recovery-time";
    time.textContent = `BACKED UP ${new Date(draft.updatedAt).toLocaleString()}`;
    details.append(name, time);

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.textContent = "RESTORE";
    restoreButton.addEventListener("click", () => {
      createTab({
        name: draft.name,
        content: draft.content,
        file: draft.file,
        dirty: true,
        draftId: draft.id,
      });
      removeRecoveryItem(item);
      setStatus("DRAFT RESTORED");
    });

    const discardButton = document.createElement("button");
    discardButton.type = "button";
    discardButton.textContent = "DISCARD";
    discardButton.addEventListener("click", async () => {
      try {
        await deleteDraftRecord(draft.id);
        removeRecoveryItem(item);
      } catch (error) {
        reportDraftFailure(error);
      }
    });

    item.append(details, restoreButton, discardButton);
    recoveryList.append(item);
  }
}

async function showRecoveryDrafts() {
  try {
    const drafts = await getDraftRecords();
    if (!drafts.length) {
      return;
    }

    drafts.sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt)
    );
    renderRecoveryDrafts(drafts);
    if (settingsDialog.open) {
      settingsDialog.addEventListener(
        "close",
        () => recoveryDialog.showModal(),
        { once: true }
      );
    } else {
      recoveryDialog.showModal();
    }
  } catch (error) {
    reportDraftFailure(error);
  }
}

function setStatus(message) {
  status.textContent = message;
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function updateSaveButton() {
  const tab = getActiveTab();
  saveButton.disabled = !tab || tab.saving || tab.savePending;
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

function isSupportedTextMimeType(mimeType) {
  const normalized = (mimeType || "application/octet-stream")
    .split(";", 1)[0]
    .toLowerCase();

  return (
    normalized.startsWith("text/") ||
    normalized === "application/octet-stream" ||
    normalized.endsWith("+json") ||
    normalized.endsWith("+xml") ||
    TEXT_APPLICATION_MIME_TYPES.has(normalized)
  );
}

function decodeUtf8Text(bytes) {
  const hasUtf8Bom =
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf;
  const hasUtf16Or32Bom =
    (bytes.length >= 2 &&
      ((bytes[0] === 0xff && bytes[1] === 0xfe) ||
        (bytes[0] === 0xfe && bytes[1] === 0xff))) ||
    (bytes.length >= 4 &&
      bytes[0] === 0 &&
      bytes[1] === 0 &&
      bytes[2] === 0xfe &&
      bytes[3] === 0xff);

  if (hasUtf16Or32Bom) {
    throw new Error("UNSUPPORTED TEXT ENCODING: ONLY UTF-8 IS SAFE TO EDIT");
  }

  let suspiciousControls = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      throw new Error("BINARY FILE BLOCKED");
    }
    if (byte < 0x20 && ![0x09, 0x0a, 0x0c, 0x0d].includes(byte)) {
      suspiciousControls += 1;
    }
  }
  if (suspiciousControls > Math.max(2, bytes.length * 0.01)) {
    throw new Error("BINARY FILE BLOCKED");
  }

  try {
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      hasUtf8Bom,
    };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("UNSUPPORTED TEXT ENCODING: ONLY UTF-8 IS SAFE TO EDIT");
    }
    throw error;
  }
}

function contentForUpload(tab, content) {
  return tab.file?.hasUtf8Bom ? `\ufeff${content}` : content;
}

function createTab({
  name,
  content = "",
  file = null,
  dirty = false,
  draftId = crypto.randomUUID(),
}) {
  const tab = {
    id: nextTabId++,
    name,
    file,
    dirty,
    saving: false,
    savePending: false,
    draftId,
    draftTimer: null,
    draftWritePromise: Promise.resolve(),
    model: monaco.editor.createModel(content, languageFromFilename(name)),
  };

  tab.model.onDidChangeContent(() => {
    if (tab.id === activeTabId) {
      updateEditorStats();
    }

    if (!tab.dirty) {
      tab.dirty = true;
      renderTabs();
      updateActiveFileDisplay();
    }
    scheduleDraftSave(tab);
  });

  tabs.push(tab);
  activateTab(tab.id);
  scheduleDraftSave(tab);
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
  updateSaveButton();
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
  if (tab.saving) {
    setStatus("SAVE IN PROGRESS");
    return;
  }

  if (tab.dirty && !confirm(`Close ${tab.name} without saving?`)) {
    return;
  }

  deleteDraftForTab(tab);
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
      updateSaveButton();
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
  applyTheme();

  editor = monaco.editor.create(document.getElementById("editor"), {
    model: null,
    theme: "drive-edit-theme",
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
  showRecoveryDrafts();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    for (const tab of tabs) {
      scheduleDraftSave(tab, true);
    }
  }
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
        const failedRequest = pendingPickerRequest;
        pendingPickerRequest = null;
        if (failedRequest?.tabId) {
          const tab = tabs.find(
            (candidate) => candidate.id === failedRequest.tabId
          );
          if (tab) {
            tab.savePending = false;
            updateSaveButton();
          }
        }
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
    event.returnValue = true;
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
    return false;
  }

  if (!accessToken) {
    if (pendingPickerRequest) {
      setStatus("AUTHORIZATION ALREADY IN PROGRESS");
      return false;
    }
    pendingPickerRequest = { mode, tabId };
    tokenClient.requestAccessToken({ prompt: "consent" });
    return true;
  }

  showPicker(mode, tabId);
  return true;
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
    if (mode === "folder" && data.action === google.picker.Action.CANCEL) {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      if (tab) {
        tab.savePending = false;
        updateSaveButton();
      }
    }
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
      )}?fields=id,name,mimeType,parents,version,modifiedTime`
    );
    const file = await metadataResponse.json();

    if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      throw new Error("Google workspace files are not plain text.");
    }
    if (!isSupportedTextMimeType(file.mimeType)) {
      throw new Error(`UNSUPPORTED FILE TYPE: ${file.mimeType}`);
    }

    const contentResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        file.id
      )}?alt=media`
    );
    const decoded = decodeUtf8Text(
      new Uint8Array(await contentResponse.arrayBuffer())
    );
    file.hasUtf8Bom = decoded.hasUtf8Bom;

    createTab({ name: file.name, content: decoded.content, file });
    setStatus("LOADED");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  }
}

async function saveFile() {
  const tab = getActiveTab();
  if (!tab || tab.saving || tab.savePending) {
    return;
  }

  if (!tab.file) {
    tab.savePending = true;
    if (!requestPicker("folder", tab.id)) {
      tab.savePending = false;
    }
    updateSaveButton();
    return;
  }

  const content = tab.model.getValue();
  try {
    tab.saving = true;
    updateSaveButton();
    setStatus("CHECKING DRIVE VERSION");
    const metadataResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?fields=version,modifiedTime`
    );
    const remoteFile = await metadataResponse.json();
    if (tab.file.version && remoteFile.version !== tab.file.version) {
      throw new Error("SAVE BLOCKED: FILE CHANGED IN DRIVE");
    }

    setStatus("SAVING");
    const response = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?uploadType=media&fields=id,name,mimeType,parents,version,modifiedTime`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": tab.file.mimeType || "text/plain; charset=utf-8",
        },
        body: contentForUpload(tab, content),
      }
    );

    tab.file = { ...tab.file, ...(await response.json()) };
    tab.dirty = tab.model.getValue() !== content;
    syncDraftAfterSave(tab);
    renderTabs();
    updateActiveFileDisplay();
    setStatus(tab.dirty ? "SAVED | NEW CHANGES PENDING" : "SAVED");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    tab.saving = false;
    updateSaveButton();
  }
}

async function createDriveFile(folderId, tabId) {
  const tab = tabs.find((candidate) => candidate.id === tabId);
  if (tab) {
    tab.savePending = false;
  }
  if (!tab || tab.file) {
    updateSaveButton();
    return;
  }

  const name = prompt("Filename, including extension:", tab.name);
  if (!name?.trim()) {
    setStatus("SAVE CANCELLED");
    updateSaveButton();
    return;
  }

  const content = tab.model.getValue();
  try {
    tab.saving = true;
    updateSaveButton();
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
      content,
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,version,modifiedTime",
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
    tab.dirty = tab.model.getValue() !== content;
    syncDraftAfterSave(tab);
    monaco.editor.setModelLanguage(tab.model, languageFromFilename(tab.name));
    renderTabs();
    updateActiveFileDisplay();
    setStatus(tab.dirty ? "SAVED | NEW CHANGES PENDING" : "SAVED");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    tab.saving = false;
    updateSaveButton();
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
