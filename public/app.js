const { clientId } = window.APP_CONFIG;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const EXPLORER_ROOT_ID = "root";
const THEME_STORAGE_KEY = "drive-edit-theme";
const DRAFT_DATABASE_NAME = "drive-edit-recovery";
const DRAFT_STORE_NAME = "drafts";
const DRAFT_SAVE_DELAY = 500;
const EMERGENCY_DRAFT_STORAGE_PREFIX = "drive-edit-emergency-drafts:";
const LOADING_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];
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
  darkTheme: "carbon-white",
  lightTheme: "paper-ink",
  uiFont: "gt-america-mono",
  uiFontSize: 14,
  editorFont: "gt-america-mono",
  editorFontSize: 14,
};
const FONT_OPTIONS = [
  {
    id: "gt-america-mono",
    name: "GT America Mono",
    stack:
      '"GT America Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  {
    id: "system-mono",
    name: "System Mono",
    stack: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  {
    id: "courier-new",
    name: "Courier New",
    stack: '"Courier New", Courier, monospace',
  },
  { id: "consolas", name: "Consolas", stack: "Consolas, monospace" },
  { id: "monaco", name: "Monaco", stack: "Monaco, monospace" },
];
const UI_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18];
const EDITOR_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28];

let tokenClient;
let accessToken = null;
let pendingAuthorizationRequests = [];
let editor;
let tabs = [];
let activeTabId = null;
let nextTabId = 1;
let nextUntitledNumber = 1;
let draftDatabasePromise = null;
const openingDriveFileIds = new Set();
let loadingFrameIndex = 0;
let loadingAnimationTimer = null;
let explorerCreateOperation = null;
let editorReady = false;
let driveClientReady = false;
const explorerRoot = {
  id: EXPLORER_ROOT_ID,
  name: "MY DRIVE",
  mimeType: FOLDER_MIME_TYPE,
  expanded: true,
  loaded: false,
  loading: false,
  children: [],
};
let selectedExplorerFolderId = EXPLORER_ROOT_ID;

const explorerToggle = document.getElementById("explorerToggle");
const newTabButton = document.getElementById("newTabButton");
const saveButton = document.getElementById("saveButton");
const settingsButton = document.getElementById("settingsButton");
const explorerNewFileButton = document.getElementById(
  "explorerNewFileButton"
);
const explorerNewFolderButton = document.getElementById(
  "explorerNewFolderButton"
);
const explorerRefreshButton = document.getElementById(
  "explorerRefreshButton"
);
const explorerTree = document.getElementById("explorerTree");
const editorElement = document.getElementById("editor");
const editorState = document.getElementById("editorState");
const editorStateSymbol = document.getElementById("editorStateSymbol");
const editorStateMessage = document.getElementById("editorStateMessage");
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
const uiFontSelect = document.getElementById("uiFontSelect");
const uiFontSizeSelect = document.getElementById("uiFontSizeSelect");
const editorFontSelect = document.getElementById("editorFontSelect");
const editorFontSizeSelect = document.getElementById("editorFontSizeSelect");
const textEncoder = new TextEncoder();
const emergencyDraftStorageKey = `${EMERGENCY_DRAFT_STORAGE_PREFIX}${crypto.randomUUID()}`;
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
      uiFont: FONT_OPTIONS.some((font) => font.id === stored?.uiFont)
        ? stored.uiFont
        : DEFAULT_THEME_PREFERENCES.uiFont,
      uiFontSize: UI_FONT_SIZES.includes(Number(stored?.uiFontSize))
        ? Number(stored.uiFontSize)
        : DEFAULT_THEME_PREFERENCES.uiFontSize,
      editorFont: FONT_OPTIONS.some((font) => font.id === stored?.editorFont)
        ? stored.editorFont
        : DEFAULT_THEME_PREFERENCES.editorFont,
      editorFontSize: EDITOR_FONT_SIZES.includes(
        Number(stored?.editorFontSize)
      )
        ? Number(stored.editorFontSize)
        : DEFAULT_THEME_PREFERENCES.editorFontSize,
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

function populateFontSelect(select) {
  for (const font of FONT_OPTIONS) {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.name;
    select.append(option);
  }
}

function populateFontSizeSelect(select, sizes) {
  for (const size of sizes) {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = `${size} PX`;
    select.append(option);
  }
}

function getFont(fontId) {
  return FONT_OPTIONS.find((font) => font.id === fontId) || FONT_OPTIONS[0];
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

function applyFontPreferences() {
  const uiFont = getFont(themePreferences.uiFont);
  const editorFont = getFont(themePreferences.editorFont);
  document.body.style.setProperty("--ui-font", uiFont.stack);
  document.body.style.setProperty(
    "--ui-font-size",
    `${themePreferences.uiFontSize}px`
  );
  document.body.style.setProperty(
    "--ui-small-font-size",
    `${Math.max(10, themePreferences.uiFontSize - 2)}px`
  );

  if (editor) {
    editor.updateOptions({
      fontFamily: editorFont.stack,
      fontSize: themePreferences.editorFontSize,
    });
  }
}

function updateThemeControls() {
  darkModeToggle.checked = themePreferences.mode === "dark";
  darkModeToggle.disabled = themePreferences.followSystem;
  followSystemToggle.checked = themePreferences.followSystem;
  darkThemeSelect.value = themePreferences.darkTheme;
  lightThemeSelect.value = themePreferences.lightTheme;
  uiFontSelect.value = themePreferences.uiFont;
  uiFontSizeSelect.value = String(themePreferences.uiFontSize);
  editorFontSelect.value = themePreferences.editorFont;
  editorFontSizeSelect.value = String(themePreferences.editorFontSize);
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
  applyFontPreferences();
}

populateThemeSelect(darkThemeSelect, THEMES.dark);
populateThemeSelect(lightThemeSelect, THEMES.light);
populateFontSelect(uiFontSelect);
populateFontSelect(editorFontSelect);
populateFontSizeSelect(uiFontSizeSelect, UI_FONT_SIZES);
populateFontSizeSelect(editorFontSizeSelect, EDITOR_FONT_SIZES);
updateThemeControls();
applyTheme();
applyFontPreferences();

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

uiFontSelect.addEventListener("change", () => {
  themePreferences.uiFont = uiFontSelect.value;
  saveThemePreferences();
});

uiFontSizeSelect.addEventListener("change", () => {
  themePreferences.uiFontSize = Number(uiFontSizeSelect.value);
  saveThemePreferences();
});

editorFontSelect.addEventListener("change", () => {
  themePreferences.editorFont = editorFontSelect.value;
  saveThemePreferences();
});

editorFontSizeSelect.addEventListener("change", () => {
  themePreferences.editorFontSize = Number(editorFontSizeSelect.value);
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

async function putDraftRecordIfNewer(record) {
  const database = await getDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DRAFT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(DRAFT_STORE_NAME);
    const request = store.get(record.id);
    request.onsuccess = () => {
      if (!request.result || record.updatedAt > request.result.updatedAt) {
        store.put(record);
      }
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
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

  queueDraftOperation(tab, () => putDraftRecord(getDraftRecord(tab)));
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

function getDraftRecord(tab) {
  return {
    id: tab.draftId,
    name: tab.name,
    content: tab.model.getValue(),
    file: tab.file,
    updatedAt: new Date().toISOString(),
  };
}

function saveEmergencyDrafts() {
  try {
    const records = tabs
      .filter((tab) => tab.dirty && !tab.model.isDisposed())
      .map(getDraftRecord);
    if (records.length) {
      localStorage.setItem(emergencyDraftStorageKey, JSON.stringify(records));
    } else {
      localStorage.removeItem(emergencyDraftStorageKey);
    }
  } catch (error) {
    console.warn("Could not write emergency recovery drafts.", error);
  }
}

async function importEmergencyDrafts() {
  const storageKeys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(EMERGENCY_DRAFT_STORAGE_PREFIX)) {
      storageKeys.push(key);
    }
  }

  const records = [];
  for (const key of storageKeys) {
    try {
      const storedRecords = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(storedRecords)) {
        records.push(...storedRecords);
      }
    } catch (error) {
      console.warn("Ignored an invalid emergency recovery draft.", error);
      localStorage.removeItem(key);
    }
  }

  records.sort((first, second) =>
    first.updatedAt.localeCompare(second.updatedAt)
  );
  for (const record of records) {
    await putDraftRecordIfNewer(record);
  }
  for (const key of storageKeys) {
    localStorage.removeItem(key);
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
      const restoredTab = createTab({
        name: draft.name,
        content: draft.content,
        file: draft.file,
        dirty: true,
      });
      scheduleDraftSave(restoredTab, true);
      queueDraftOperation(restoredTab, () => deleteDraftRecord(draft.id));
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
    await importEmergencyDrafts();
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
  saveButton.disabled =
    !tab || tab.saving || tab.savePending || tab.loading || tab.loadError;
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
  loading = false,
}) {
  const tab = {
    id: nextTabId++,
    name,
    file,
    dirty,
    saving: false,
    savePending: false,
    loading,
    loadError: null,
    suppressDirtyTracking: false,
    draftId,
    draftTimer: null,
    draftWritePromise: Promise.resolve(),
    model: monaco.editor.createModel(content, languageFromFilename(name)),
  };

  tab.model.onDidChangeContent(() => {
    if (tab.id === activeTabId) {
      updateEditorStats();
    }

    if (tab.suppressDirtyTracking) {
      return;
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
  updateEditorState();
  if (!tab.loading && !tab.loadError) {
    editor.focus();
  }
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) {
    return;
  }

  const tab = tabs[index];
  if (tab.saving || tab.savePending || tab.loading) {
    setStatus(tab.loading ? "FILE LOAD IN PROGRESS" : "SAVE IN PROGRESS");
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
      createUntitledTab();
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

function updateEditorState() {
  const tab = getActiveTab();
  const showState = Boolean(tab?.loading || tab?.loadError);
  editorElement.style.visibility = showState ? "hidden" : "visible";
  editorElement.setAttribute("aria-busy", String(Boolean(tab?.loading)));
  editorState.hidden = !showState;

  if (tab?.loading) {
    editorStateSymbol.hidden = false;
    editorStateSymbol.textContent = LOADING_FRAMES[loadingFrameIndex];
    editorStateMessage.textContent = "LOADING FILE";
  } else if (tab?.loadError) {
    editorStateSymbol.hidden = true;
    editorStateMessage.textContent = `LOAD FAILED: ${tab.loadError}`;
  }
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

function findExplorerFolder(folderId, folder = explorerRoot) {
  if (folder.id === folderId) {
    return folder;
  }

  for (const child of folder.children) {
    if (child.mimeType !== FOLDER_MIME_TYPE) {
      continue;
    }
    const match = findExplorerFolder(folderId, child);
    if (match) {
      return match;
    }
  }

  return null;
}

function findExplorerFolderPath(folderId, folder = explorerRoot, path = []) {
  const nextPath = [...path, folder];
  if (folder.id === folderId) {
    return nextPath;
  }

  for (const child of folder.children) {
    if (child.mimeType !== FOLDER_MIME_TYPE) {
      continue;
    }
    const match = findExplorerFolderPath(folderId, child, nextPath);
    if (match) {
      return match;
    }
  }

  return null;
}

function isExplorerFileSupported(file) {
  return (
    !file.mimeType.startsWith("application/vnd.google-apps.") &&
    isSupportedTextMimeType(file.mimeType)
  );
}

function createExplorerRow(item, depth) {
  const isFolder = item.mimeType === FOLDER_MIME_TYPE;
  const row = document.createElement("button");
  row.type = "button";
  row.className = "explorer-row";
  row.dataset.itemId = item.id;
  row.style.paddingLeft = `${8 + depth * 16}px`;
  row.setAttribute("role", "treeitem");
  row.title = item.name;

  const marker = document.createElement("span");
  marker.className = "explorer-marker";
  marker.setAttribute("aria-hidden", "true");
  if (isFolder) {
    marker.textContent = item.expanded ? "[-]" : "[+]";
  } else {
    marker.textContent = "";
  }
  const name = document.createElement("span");
  name.className = "explorer-name";
  name.textContent = item.name;
  row.append(marker, name);

  if (isFolder) {
    row.setAttribute("aria-expanded", String(item.expanded));
    row.classList.toggle("selected", item.id === selectedExplorerFolderId);
    row.addEventListener("click", () => selectExplorerFolder(item));
  } else {
    const supported = isExplorerFileSupported(item);
    row.classList.toggle("unsupported", !supported);
    if (supported) {
      row.addEventListener("click", () => openDriveFile(item.id, item));
    } else {
      row.title = `${item.name} is not a supported UTF-8 text file`;
      row.setAttribute("aria-disabled", "true");
      row.addEventListener("click", () =>
        setStatus(`UNSUPPORTED FILE TYPE: ${item.mimeType}`)
      );
    }
  }

  return row;
}

function appendExplorerFolder(folder, depth) {
  explorerTree.append(createExplorerRow(folder, depth));
  if (!folder.expanded) {
    return;
  }

  if (explorerCreateOperation?.parentId === folder.id) {
    explorerTree.append(createExplorerInputRow(depth + 1));
  }

  if (folder.loading) {
    const loading = document.createElement("div");
    loading.className = "explorer-message";
    loading.setAttribute("role", "treeitem");
    loading.setAttribute("aria-live", "polite");
    loading.style.paddingLeft = `${24 + depth * 16}px`;
    const loadingSymbol = document.createElement("span");
    loadingSymbol.className = "explorer-loading-symbol";
    loadingSymbol.setAttribute("aria-hidden", "true");
    loadingSymbol.textContent = LOADING_FRAMES[loadingFrameIndex];
    loading.append(loadingSymbol, " LOADING");
    explorerTree.append(loading);
    return;
  }

  if (!folder.loaded) {
    const message = document.createElement("div");
    message.className = "explorer-message";
    message.style.paddingLeft = `${24 + depth * 16}px`;
    message.textContent = accessToken
      ? "SELECT FOLDER TO LOAD"
      : "SELECT REFRESH TO CONNECT TO DRIVE";
    explorerTree.append(message);
    return;
  }

  if (!folder.children.length) {
    const empty = document.createElement("div");
    empty.className = "explorer-message";
    empty.style.paddingLeft = `${24 + depth * 16}px`;
    empty.textContent = "EMPTY FOLDER";
    explorerTree.append(empty);
    return;
  }

  for (const child of folder.children) {
    if (child.mimeType === FOLDER_MIME_TYPE) {
      appendExplorerFolder(child, depth + 1);
    } else {
      explorerTree.append(createExplorerRow(child, depth + 1));
    }
  }
}

function renderExplorerTree() {
  explorerTree.replaceChildren();
  appendExplorerFolder(explorerRoot, 0);
}

function updateExplorerLoadingIndicators() {
  const frame = LOADING_FRAMES[loadingFrameIndex];
  for (const symbol of explorerTree.querySelectorAll(
    ".explorer-loading-symbol"
  )) {
    symbol.textContent = frame;
  }
  if (getActiveTab()?.loading) {
    editorStateSymbol.textContent = frame;
  }
  loadingFrameIndex = (loadingFrameIndex + 1) % LOADING_FRAMES.length;
}

function hasLoadingExplorerFolder(folder = explorerRoot) {
  return (
    folder.loading ||
    folder.children.some(
      (child) =>
        child.mimeType === FOLDER_MIME_TYPE && hasLoadingExplorerFolder(child)
    )
  );
}

function startExplorerLoadingAnimation() {
  updateExplorerLoadingIndicators();
  if (
    !loadingAnimationTimer &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    loadingAnimationTimer = setInterval(updateExplorerLoadingIndicators, 80);
  }
}

function stopExplorerLoadingAnimation() {
  if (
    !openingDriveFileIds.size &&
    !hasLoadingExplorerFolder() &&
    loadingAnimationTimer
  ) {
    clearInterval(loadingAnimationTimer);
    loadingAnimationTimer = null;
    loadingFrameIndex = 0;
  }
  updateExplorerLoadingIndicators();
}

async function listDriveFolder(folderId) {
  const files = [];
  let pageToken = null;

  do {
    const parameters = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: "folder,name_natural",
      pageSize: "1000",
      fields:
        "nextPageToken,files(id,name,mimeType,parents,version,modifiedTime)",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) {
      parameters.set("pageToken", pageToken);
    }

    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?${parameters}`
    );
    const page = await response.json();
    files.push(...(page.files || []));
    pageToken = page.nextPageToken || null;
  } while (pageToken);

  files.sort((first, second) => {
    const firstIsFolder = first.mimeType === FOLDER_MIME_TYPE;
    const secondIsFolder = second.mimeType === FOLDER_MIME_TYPE;
    if (firstIsFolder !== secondIsFolder) {
      return firstIsFolder ? -1 : 1;
    }
    return first.name.localeCompare(second.name);
  });

  return files.map((file) =>
    file.mimeType === FOLDER_MIME_TYPE
      ? {
          ...file,
          expanded: false,
          loaded: false,
          loading: false,
          children: [],
        }
      : file
  );
}

async function loadExplorerFolder(folder, force = false) {
  if (folder.loading || (folder.loaded && !force)) {
    return;
  }

  folder.loading = true;
  folder.expanded = true;
  renderExplorerTree();
  startExplorerLoadingAnimation();
  let createDestinationChanged = false;
  try {
    folder.children = await listDriveFolder(folder.id);
    folder.loaded = true;
    if (explorerCreateOperation) {
      const operationParent = findExplorerFolder(
        explorerCreateOperation.parentId
      );
      if (operationParent) {
        operationParent.expanded = true;
      } else {
        explorerCreateOperation.parentId = folder.id;
        explorerCreateOperation.focusPending = true;
        createDestinationChanged = true;
        setStatus("CREATE DESTINATION CHANGED TO REFRESHED FOLDER");
      }
    }
    if (!findExplorerFolder(selectedExplorerFolderId)) {
      selectedExplorerFolderId = folder.id;
    }
    if (!createDestinationChanged) {
      setStatus("EXPLORER UPDATED");
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    folder.loading = false;
    renderExplorerTree();
    stopExplorerLoadingAnimation();
  }
}

function selectExplorerFolder(folder) {
  selectedExplorerFolderId = folder.id;
  if (!accessToken) {
    renderExplorerTree();
    requestDriveAccess(() => loadExplorerFolder(folder));
    return;
  }

  if (folder.loaded) {
    if (
      folder.expanded &&
      explorerCreateOperation &&
      findExplorerFolder(explorerCreateOperation.parentId, folder)
    ) {
      setStatus("FINISH OR CANCEL THE CURRENT CREATE OPERATION");
      return;
    }
    folder.expanded = !folder.expanded;
    renderExplorerTree();
  } else {
    loadExplorerFolder(folder);
  }
}

function refreshExplorerFolder(folderId = selectedExplorerFolderId) {
  const folder = findExplorerFolder(folderId) || explorerRoot;
  return loadExplorerFolder(folder, true);
}

function refreshExplorer() {
  requestDriveAccess(() => refreshExplorerFolder());
}

function beginExplorerCreate(type, targetTab = null) {
  if (explorerCreateOperation) {
    setStatus("FINISH OR CANCEL THE CURRENT CREATE OPERATION");
    return false;
  }

  const parent = findExplorerFolder(selectedExplorerFolderId) || explorerRoot;
  if (targetTab && document.body.classList.contains("explorer-collapsed")) {
    document.body.classList.remove("explorer-collapsed");
    explorerToggle.setAttribute("aria-expanded", "true");
  }
  selectedExplorerFolderId = parent.id;
  parent.expanded = true;
  explorerCreateOperation = {
    type,
    parentId: parent.id,
    name: type === "file" ? ".txt" : "",
    submitting: false,
    focusPending: true,
    tabId: targetTab?.id || null,
  };
  if (targetTab) {
    targetTab.savePending = true;
    updateSaveButton();
  }
  updateExplorerCreateButtons();
  renderExplorerTree();
  return true;
}

function updateExplorerCreateButtons() {
  const disabled =
    !editorReady || !driveClientReady || Boolean(explorerCreateOperation);
  explorerNewFileButton.disabled = disabled;
  explorerNewFolderButton.disabled = disabled;
  explorerRefreshButton.disabled =
    !driveClientReady || Boolean(explorerCreateOperation);
}

function isDriveDestinationUnavailable(error) {
  return (
    error.status === 404 ||
    (error.status === 403 && error.reason === "insufficientFilePermissions")
  );
}

function cancelExplorerCreate() {
  if (!explorerCreateOperation?.submitting) {
    const type = explorerCreateOperation.type;
    const targetTab = tabs.find(
      (tab) => tab.id === explorerCreateOperation.tabId
    );
    if (targetTab) {
      targetTab.savePending = false;
      updateSaveButton();
    }
    explorerCreateOperation = null;
    updateExplorerCreateButtons();
    renderExplorerTree();
    setStatus("CREATE CANCELLED");
    requestAnimationFrame(() => {
      (type === "file"
        ? explorerNewFileButton
        : explorerNewFolderButton
      ).focus();
    });
  }
}

function resetExplorerCreateSubmission(operation) {
  if (explorerCreateOperation === operation) {
    operation.submitting = false;
    operation.focusPending = true;
    renderExplorerTree();
  }
}

function submitExplorerCreate(operation) {
  const name = operation.name.trim();
  if (!name || (operation.type === "file" && name === ".txt")) {
    operation.focusPending = true;
    renderExplorerTree();
    setStatus(operation.type === "file" ? "ENTER A FILE NAME" : "ENTER A FOLDER NAME");
    return;
  }

  operation.name = name;
  operation.submitting = true;
  renderExplorerTree();
  const requested = requestDriveAccess(
    () => createExplorerItem(operation),
    () => resetExplorerCreateSubmission(operation)
  );
  if (!requested) {
    resetExplorerCreateSubmission(operation);
  }
}

function createExplorerInputRow(depth) {
  const operation = explorerCreateOperation;
  const row = document.createElement("div");
  row.className = "explorer-create-row";
  row.setAttribute("role", "treeitem");
  row.style.paddingLeft = `${8 + depth * 16}px`;

  const marker = document.createElement("span");
  marker.className = "explorer-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = operation.submitting
    ? "..."
    : operation.type === "file"
      ? "[ ]"
      : "[+]";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "explorer-create-input";
  input.value = operation.name;
  input.disabled = operation.submitting;
  input.setAttribute(
    "aria-label",
    operation.type === "file" ? "New file name" : "New folder name"
  );
  input.addEventListener("input", () => {
    if (explorerCreateOperation === operation) {
      operation.name = input.value;
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelExplorerCreate();
    } else if (event.key === "Enter") {
      event.preventDefault();
      submitExplorerCreate(operation);
    }
  });

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "explorer-create-cancel";
  cancelButton.textContent = "X";
  cancelButton.disabled = operation.submitting;
  cancelButton.setAttribute("aria-label", "Cancel create");
  cancelButton.addEventListener("click", cancelExplorerCreate);

  row.append(marker, input, cancelButton);
  if (operation.focusPending && !operation.submitting) {
    operation.focusPending = false;
    requestAnimationFrame(() => {
      input.focus();
      const cursorPosition = operation.type === "file" ? 0 : input.value.length;
      input.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  return row;
}

async function createDriveTextFile(parentId, name, content) {
  const boundary = `drive_editor_${Date.now()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify({ name, mimeType: "text/plain", parents: [parentId] }),
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const response = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,version,modifiedTime",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  return response.json();
}

async function refreshExplorerAfterCreate(folderId) {
  let folderPath = findExplorerFolderPath(folderId);
  while (folderPath?.some((folder) => folder.loading)) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    folderPath = findExplorerFolderPath(folderId);
  }
  const liveFolder = findExplorerFolder(folderId) || explorerRoot;
  await loadExplorerFolder(liveFolder, true);
}

async function createExplorerItem(operation) {
  const parent = findExplorerFolder(operation.parentId) || explorerRoot;
  const isFile = operation.type === "file";
  const targetTab = tabs.find((tab) => tab.id === operation.tabId) || null;
  const content = targetTab?.model.getValue() || "";
  renderExplorerTree();

  try {
    setStatus(isFile ? "CREATING FILE" : "CREATING FOLDER");
    let created;
    if (isFile) {
      created = await createDriveTextFile(parent.id, operation.name, content);
    } else {
      const response = await driveFetch(
        "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,parents,version,modifiedTime",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: operation.name,
            mimeType: FOLDER_MIME_TYPE,
            parents: [parent.id],
          }),
        }
      );
      created = await response.json();
    }
    await refreshExplorerAfterCreate(parent.id);
    if (isFile) {
      if (targetTab) {
        targetTab.savePending = false;
        targetTab.file = created;
        targetTab.name = created.name;
        targetTab.dirty = targetTab.model.getValue() !== content;
        syncDraftAfterSave(targetTab);
        monaco.editor.setModelLanguage(
          targetTab.model,
          languageFromFilename(targetTab.name)
        );
        renderTabs();
        updateActiveFileDisplay();
        updateSaveButton();
      } else {
        createTab({ name: created.name, content: "", file: created });
      }
      explorerCreateOperation = null;
      updateExplorerCreateButtons();
      renderExplorerTree();
      setStatus("FILE CREATED");
    } else {
      selectedExplorerFolderId = created.id;
      explorerCreateOperation = null;
      updateExplorerCreateButtons();
      renderExplorerTree();
      setStatus("FOLDER CREATED");
      requestAnimationFrame(() => {
        for (const row of explorerTree.querySelectorAll(".explorer-row")) {
          if (row.dataset.itemId === created.id) {
            row.focus();
            break;
          }
        }
      });
    }
  } catch (error) {
    console.error(error);
    if (isDriveDestinationUnavailable(error)) {
      selectedExplorerFolderId = EXPLORER_ROOT_ID;
      operation.parentId = EXPLORER_ROOT_ID;
      operation.submitting = false;
      operation.focusPending = true;
      renderExplorerTree();
      setStatus("DESTINATION UNAVAILABLE: SELECTED MY DRIVE");
    } else {
      setStatus(error.message);
      resetExplorerCreateSubmission(operation);
    }
  }
}

renderExplorerTree();

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
    fontFamily: getFont(themePreferences.editorFont).stack,
    fontSize: themePreferences.editorFontSize,
    lineNumbersMinChars: 3,
    padding: { top: 8 },
    readOnly: true,
  });
  editor.onDidChangeCursorPosition(updateEditorStats);
  editorReady = true;
  newTabButton.disabled = false;
  updateExplorerCreateButtons();
  createUntitledTab();
  showRecoveryDrafts();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveEmergencyDrafts();
    for (const tab of tabs) {
      scheduleDraftSave(tab, true);
    }
  }
});

window.addEventListener("load", () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    error_callback: (error) => {
      const requests = pendingAuthorizationRequests;
      pendingAuthorizationRequests = [];
      for (const request of requests) {
        request.onError?.();
      }
      setStatus(`AUTH FAILED: ${error.type || "POPUP ERROR"}`);
    },
    callback: (response) => {
      const requests = pendingAuthorizationRequests;
      pendingAuthorizationRequests = [];
      if (response.error) {
        for (const request of requests) {
          request.onError?.();
        }
        setStatus(`AUTH FAILED: ${response.error}`);
        return;
      }

      accessToken = response.access_token;
      for (const request of requests) {
        request.run();
      }
    },
  });
  driveClientReady = true;
  updateExplorerCreateButtons();
});

window.addEventListener("beforeunload", (event) => {
  if (tabs.some((tab) => tab.dirty)) {
    saveEmergencyDrafts();
    event.preventDefault();
    event.returnValue = true;
  }
});

explorerToggle.addEventListener("click", () => {
  const collapsed = document.body.classList.toggle("explorer-collapsed");
  explorerToggle.setAttribute("aria-expanded", String(!collapsed));
});
newTabButton.addEventListener("click", () => createUntitledTab());
saveButton.addEventListener("click", saveFile);
explorerNewFileButton.addEventListener("click", () =>
  beginExplorerCreate("file")
);
explorerNewFolderButton.addEventListener("click", () =>
  beginExplorerCreate("folder")
);
explorerRefreshButton.addEventListener("click", refreshExplorer);

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
  }
});

function requestDriveAccess(run, onError = null) {
  if (accessToken) {
    run();
    return true;
  }

  pendingAuthorizationRequests.push({ run, onError });
  if (pendingAuthorizationRequests.length > 1) {
    setStatus("AUTHORIZATION ALREADY IN PROGRESS");
    return true;
  }

  tokenClient.requestAccessToken({ prompt: "consent" });
  return true;
}

function openDriveFile(fileId, initialFile = null) {
  const existingTab = tabs.find((tab) => tab.file?.id === fileId);
  if (existingTab) {
    activateTab(existingTab.id);
    if (existingTab.loadError && !openingDriveFileIds.has(fileId)) {
      existingTab.loadError = null;
      existingTab.loading = true;
      updateEditorState();
      beginDriveFileLoad(existingTab);
    } else {
      setStatus("ALREADY OPEN");
    }
    return;
  }

  const loadingTab = createTab({
    name: initialFile?.name || "LOADING...",
    file: { ...initialFile, id: fileId },
    loading: true,
  });
  beginDriveFileLoad(loadingTab);
}

function beginDriveFileLoad(tab) {
  const fileId = tab.file.id;
  openingDriveFileIds.add(fileId);
  startExplorerLoadingAnimation();
  const requested = requestDriveAccess(
    () => loadDriveFile(tab),
    () => failDriveFileLoad(tab, "AUTHORIZATION FAILED")
  );
  if (!requested) {
    failDriveFileLoad(tab, "AUTHORIZATION ALREADY IN PROGRESS");
  }
}

function failDriveFileLoad(tab, message) {
  openingDriveFileIds.delete(tab.file.id);
  if (tabs.includes(tab)) {
    tab.loading = false;
    tab.loadError = message;
    renderTabs();
    updateSaveButton();
    if (tab.id === activeTabId) {
      updateEditorState();
    }
  }
  setStatus(message);
  stopExplorerLoadingAnimation();
}

async function loadDriveFile(tab) {
  const fileId = tab.file.id;
  try {
    let stableFile = null;
    let stableContent = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      setStatus(attempt ? "FILE CHANGED | RETRYING LOAD" : "LOADING");
      const metadataResponse = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          fileId
        )}?supportsAllDrives=true&fields=id,name,mimeType,parents,version,modifiedTime`
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
        )}?alt=media&supportsAllDrives=true`
      );
      const decoded = decodeUtf8Text(
        new Uint8Array(await contentResponse.arrayBuffer())
      );
      const confirmationResponse = await driveFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          file.id
        )}?supportsAllDrives=true&fields=version,modifiedTime`
      );
      const confirmation = await confirmationResponse.json();

      if (confirmation.version === file.version) {
        stableFile = {
          ...file,
          ...confirmation,
          hasUtf8Bom: decoded.hasUtf8Bom,
        };
        stableContent = decoded.content;
        break;
      }
    }

    if (!stableFile) {
      throw new Error("FILE KEPT CHANGING IN DRIVE: TRY OPENING IT AGAIN");
    }

    if (!tabs.includes(tab)) {
      return;
    }
    tab.suppressDirtyTracking = true;
    tab.model.setValue(stableContent);
    tab.suppressDirtyTracking = false;
    tab.file = stableFile;
    tab.name = stableFile.name;
    tab.loading = false;
    tab.loadError = null;
    monaco.editor.setModelLanguage(tab.model, languageFromFilename(tab.name));
    renderTabs();
    updateActiveFileDisplay();
    updateSaveButton();
    if (tab.id === activeTabId) {
      updateEditorState();
      editor.focus();
    }
    setStatus("LOADED");
  } catch (error) {
    console.error(error);
    if (tabs.includes(tab)) {
      tab.loading = false;
      tab.loadError = error.message;
      renderTabs();
      updateSaveButton();
      if (tab.id === activeTabId) {
        updateEditorState();
      }
    }
    setStatus(error.message);
  } finally {
    openingDriveFileIds.delete(fileId);
    stopExplorerLoadingAnimation();
  }
}

async function saveFile() {
  const tab = getActiveTab();
  if (
    !tab ||
    tab.saving ||
    tab.savePending ||
    tab.loading ||
    tab.loadError
  ) {
    return;
  }

  if (!tab.file) {
    beginExplorerCreate("file", tab);
    return;
  }

  if (!accessToken) {
    tab.savePending = true;
    const clearPending = () => {
      tab.savePending = false;
      updateSaveButton();
    };
    const requested = requestDriveAccess(
      () => {
        clearPending();
        if (tabs.includes(tab) && !tab.saving) {
          saveExistingDriveFile(tab);
        }
      },
      clearPending
    );
    if (!requested) {
      clearPending();
    }
    updateSaveButton();
    return;
  }

  return saveExistingDriveFile(tab);
}

async function saveExistingDriveFile(tab) {
  const content = tab.model.getValue();
  try {
    tab.saving = true;
    updateSaveButton();
    setStatus("CHECKING DRIVE VERSION");
    const metadataResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?supportsAllDrives=true&fields=version,modifiedTime`
    );
    const remoteFile = await metadataResponse.json();
    if (tab.file.version && remoteFile.version !== tab.file.version) {
      throw new Error("SAVE BLOCKED: FILE CHANGED IN DRIVE");
    }

    setStatus("SAVING");
    const response = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?uploadType=media&supportsAllDrives=true&fields=id,name,mimeType,parents,version,modifiedTime`,
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
    const body = await response.text();
    const error = new Error(body);
    error.status = response.status;
    try {
      error.reason = JSON.parse(body).error?.errors?.[0]?.reason;
    } catch {
      // Non-JSON API errors do not include a structured Drive reason.
    }
    throw error;
  }

  return response;
}
