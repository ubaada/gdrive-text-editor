const { clientId } = window.APP_CONFIG;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const EXPLORER_ROOT_ID = "root";
const THEME_STORAGE_KEY = "drive-edit-theme";
const GOOGLE_CONSENT_STORAGE_KEY = "drive-edit-google-consent";
const GOOGLE_ACCOUNT_STORAGE_KEY = "drive-edit-google-account";
const WORKSPACE_STORAGE_PREFIX = "drive-edit-workspace:";
const DRAFT_DATABASE_NAME = "drive-edit-recovery";
const DRAFT_STORE_NAME = "drafts";
const DRAFT_SAVE_DELAY = 500;
const REVISION_PAGE_SIZE = 1000;
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
  rulers: [],
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
let authorizationGeneration = 0;
let authorizationIntent = "normal";
let authorizationInProgress = false;
let accountSwitchPending = false;
let authorizedGoogleAccount = loadAuthorizedGoogleAccount();
let connectedGoogleAccount = null;
let workspaceAccountId = null;
let workspaceRestoring = Boolean(authorizedGoogleAccount?.permissionId);
let silentReconnectStarted = false;
let bootstrapTabId = null;
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
let sidebarMode = "files";
let confirmationResolver = null;

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
const filesModeButton = document.getElementById("filesModeButton");
const historyModeButton = document.getElementById("historyModeButton");
const explorerPanel = document.getElementById("explorerPanel");
const revisionHistoryPanel = document.getElementById("revisionHistoryPanel");
const revisionHistoryFilename = document.getElementById(
  "revisionHistoryFilename"
);
const revisionHistoryRefresh = document.getElementById(
  "revisionHistoryRefresh"
);
const revisionHistoryList = document.getElementById("revisionHistoryList");
const explorerTree = document.getElementById("explorerTree");
const editorElement = document.getElementById("editor");
const revisionPreviewBar = document.getElementById("revisionPreviewBar");
const revisionPreviewLabel = document.getElementById("revisionPreviewLabel");
const backToLatestButton = document.getElementById("backToLatestButton");
const restoreRevisionButton = document.getElementById("restoreRevisionButton");
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
const appearanceSectionButton = document.getElementById(
  "appearanceSectionButton"
);
const editorSectionButton = document.getElementById("editorSectionButton");
const accountSectionButton = document.getElementById("accountSectionButton");
const appearanceSettingsPanel = document.getElementById(
  "appearanceSettingsPanel"
);
const editorSettingsPanel = document.getElementById("editorSettingsPanel");
const accountSettingsPanel = document.getElementById("accountSettingsPanel");
const googleAccountValue = document.getElementById("googleAccountValue");
const switchAccountButton = document.getElementById("switchAccountButton");
const recoveryDialog = document.getElementById("recoveryDialog");
const closeRecoveryButton = document.getElementById("closeRecoveryButton");
const recoveryList = document.getElementById("recoveryList");
const confirmationDialog = document.getElementById("confirmationDialog");
const confirmationTitle = document.getElementById("confirmationTitle");
const confirmationMessage = document.getElementById("confirmationMessage");
const closeConfirmationButton = document.getElementById(
  "closeConfirmationButton"
);
const cancelConfirmationButton = document.getElementById(
  "cancelConfirmationButton"
);
const acceptConfirmationButton = document.getElementById(
  "acceptConfirmationButton"
);
const reconnectDialog = document.getElementById("reconnectDialog");
const closeReconnectButton = document.getElementById("closeReconnectButton");
const cancelReconnectButton = document.getElementById("cancelReconnectButton");
const connectDriveButton = document.getElementById("connectDriveButton");
const darkModeToggle = document.getElementById("darkModeToggle");
const followSystemToggle = document.getElementById("followSystemToggle");
const darkThemeSelect = document.getElementById("darkThemeSelect");
const lightThemeSelect = document.getElementById("lightThemeSelect");
const uiFontSelect = document.getElementById("uiFontSelect");
const uiFontSizeSelect = document.getElementById("uiFontSizeSelect");
const editorFontSelect = document.getElementById("editorFontSelect");
const editorFontSizeSelect = document.getElementById("editorFontSizeSelect");
const rulerForm = document.getElementById("rulerForm");
const rulerInput = document.getElementById("rulerInput");
const rulerList = document.getElementById("rulerList");
const textEncoder = new TextEncoder();
const emergencyDraftStorageKey = `${EMERGENCY_DRAFT_STORAGE_PREFIX}${crypto.randomUUID()}`;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let themePreferences = loadThemePreferences();

function hasPreviousGoogleConsent() {
  try {
    return localStorage.getItem(GOOGLE_CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function setPreviousGoogleConsent(granted) {
  try {
    if (granted) {
      localStorage.setItem(GOOGLE_CONSENT_STORAGE_KEY, "granted");
    } else {
      localStorage.removeItem(GOOGLE_CONSENT_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Could not save Google consent state.", error);
  }
}

function loadAuthorizedGoogleAccount() {
  try {
    const account = JSON.parse(localStorage.getItem(GOOGLE_ACCOUNT_STORAGE_KEY));
    return account?.emailAddress && account?.permissionId
      ? {
          emailAddress: account.emailAddress,
          permissionId: account.permissionId,
        }
      : null;
  } catch {
    return null;
  }
}

function setAuthorizedGoogleAccount(account) {
  authorizedGoogleAccount = account;
  try {
    if (account) {
      localStorage.setItem(GOOGLE_ACCOUNT_STORAGE_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(GOOGLE_ACCOUNT_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Could not save Google account hint.", error);
  }
  updateAccountPanel();
}

function updateAccountPanel() {
  const account = connectedGoogleAccount || authorizedGoogleAccount;
  googleAccountValue.textContent = account
    ? `${connectedGoogleAccount ? "CONNECTED" : "REMEMBERED"} | ${account.emailAddress}`
    : "NO ACCOUNT REMEMBERED";
  switchAccountButton.disabled = !driveClientReady || accountSwitchPending;
}

function selectSettingsSection(section) {
  for (const [name, button, panel] of [
    ["appearance", appearanceSectionButton, appearanceSettingsPanel],
    ["editor", editorSectionButton, editorSettingsPanel],
    ["account", accountSectionButton, accountSettingsPanel],
  ]) {
    const selected = name === section;
    button.classList.toggle("selected", selected);
    button.toggleAttribute("aria-current", selected);
    panel.hidden = !selected;
  }
}

function normalizeRulers(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values.map(Number).filter(
    (value) => Number.isSafeInteger(value) && value > 0
  ))].sort((first, second) => first - second);
}

function getWorkspaceStorageKey(accountId) {
  return `${WORKSPACE_STORAGE_PREFIX}${accountId}`;
}

function loadWorkspace(accountId) {
  try {
    const stored = JSON.parse(
      localStorage.getItem(getWorkspaceStorageKey(accountId))
    );
    const seen = new Set();
    const files = Array.isArray(stored?.files)
      ? stored.files.filter((file) => {
          if (!file?.id || seen.has(file.id)) {
            return false;
          }
          seen.add(file.id);
          return true;
        })
      : [];
    return {
      files,
      activeFileId:
        typeof stored?.activeFileId === "string"
          ? stored.activeFileId
          : null,
    };
  } catch {
    return { files: [], activeFileId: null };
  }
}

function saveWorkspace(account = authorizedGoogleAccount) {
  if (!account?.permissionId || workspaceRestoring) {
    return;
  }
  const files = tabs
    .filter((tab) => tab.file?.id)
    .map((tab) => ({
      id: tab.file.id,
      name: tab.name,
      mimeType: tab.file.mimeType || "text/plain",
      parents: tab.file.parents || [],
    }));
  const activeFileId = getActiveTab()?.file?.id || null;
  try {
    localStorage.setItem(
      getWorkspaceStorageKey(account.permissionId),
      JSON.stringify({ files, activeFileId })
    );
  } catch (error) {
    console.warn("Could not save Drive workspace.", error);
  }
}

function removePristineBootstrapTab() {
  const index = tabs.findIndex((tab) => tab.id === bootstrapTabId);
  const tab = tabs[index];
  if (
    !tab ||
    tab.file ||
    tab.dirty ||
    tab.model.getValue() !== "" ||
    tab.loading
  ) {
    return;
  }
  tabs.splice(index, 1);
  tab.model.dispose();
  bootstrapTabId = null;
}

function restoreAccountWorkspace(account) {
  if (!editorReady || !account?.permissionId) {
    return;
  }
  if (workspaceAccountId === account.permissionId) {
    return;
  }
  const workspace = loadWorkspace(account.permissionId);
  workspaceRestoring = true;
  workspaceAccountId = account.permissionId;
  if (workspace.files.length) {
    removePristineBootstrapTab();
  }

  const restoredTabs = [];
  for (const file of workspace.files) {
    let tab = tabs.find((candidate) => candidate.file?.id === file.id);
    if (!tab) {
      tab = createTab({
        name: file.name || "LOADING...",
        file: { ...file },
        loading: true,
        activate: false,
      });
    }
    restoredTabs.push(tab);
  }
  const activeTab =
    restoredTabs.find((tab) => tab.file.id === workspace.activeFileId) ||
    restoredTabs[0] ||
    getActiveTab() ||
    tabs[0];
  if (activeTab) {
    activateTab(activeTab.id);
  } else {
    createUntitledTab();
  }
  renderTabs();
  workspaceRestoring = false;
  for (const tab of restoredTabs) {
    if (tab.loading && !openingDriveFileIds.has(tab.file.id)) {
      beginDriveFileLoad(tab);
    }
  }
  saveWorkspace(account);
}

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
      rulers: normalizeRulers(stored?.rulers),
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
      "editorRuler.foreground": theme.dim,
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
      rulers: themePreferences.rulers,
    });
  }
}

function renderRulerList() {
  rulerList.replaceChildren();
  for (const ruler of themePreferences.rulers) {
    const item = document.createElement("div");
    item.className = "ruler-item";
    const column = document.createElement("span");
    column.className = "ruler-column";
    column.textContent = `COLUMN ${ruler}`;
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "DELETE";
    deleteButton.setAttribute("aria-label", `Delete ruler ${ruler}`);
    deleteButton.addEventListener("click", () => {
      themePreferences.rulers = themePreferences.rulers.filter(
        (candidate) => candidate !== ruler
      );
      saveThemePreferences();
    });
    item.append(column, deleteButton);
    rulerList.append(item);
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
  renderRulerList();
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

settingsButton.addEventListener("click", () => {
  selectSettingsSection("appearance");
  updateAccountPanel();
  settingsDialog.showModal();
});
closeSettingsButton.addEventListener("click", () => settingsDialog.close());
appearanceSectionButton.addEventListener("click", () =>
  selectSettingsSection("appearance")
);
editorSectionButton.addEventListener("click", () =>
  selectSettingsSection("editor")
);
accountSectionButton.addEventListener("click", () =>
  selectSettingsSection("account")
);

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

rulerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const ruler = Number(rulerInput.value);
  if (!Number.isSafeInteger(ruler) || ruler <= 0) {
    rulerInput.setCustomValidity("Enter a positive whole-number column.");
    rulerInput.reportValidity();
    return;
  }
  rulerInput.setCustomValidity("");
  themePreferences.rulers = normalizeRulers([
    ...themePreferences.rulers,
    ruler,
  ]);
  rulerInput.value = "";
  saveThemePreferences();
  rulerInput.focus();
});

rulerInput.addEventListener("input", () => rulerInput.setCustomValidity(""));

systemTheme.addEventListener("change", () => {
  if (themePreferences.followSystem) {
    applyTheme();
  }
});

closeRecoveryButton.addEventListener("click", () => recoveryDialog.close());

function finishConfirmation(accepted) {
  if (!confirmationResolver) {
    return;
  }
  const resolve = confirmationResolver;
  confirmationResolver = null;
  confirmationDialog.close();
  resolve(accepted);
}

function confirmAction({ title, message, acceptLabel = "YES" }) {
  if (confirmationResolver) {
    return Promise.resolve(false);
  }
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = message;
  acceptConfirmationButton.textContent = acceptLabel;
  confirmationDialog.showModal();
  return new Promise((resolve) => {
    confirmationResolver = resolve;
  });
}

closeConfirmationButton.addEventListener("click", () =>
  finishConfirmation(false)
);
cancelConfirmationButton.addEventListener("click", () =>
  finishConfirmation(false)
);
acceptConfirmationButton.addEventListener("click", () =>
  finishConfirmation(true)
);
confirmationDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  finishConfirmation(false);
});

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
    const drafts = [];
    for (const draft of await getDraftRecords()) {
      if (!draft.file && draft.content === "") {
        await deleteDraftRecord(draft.id);
      } else {
        drafts.push(draft);
      }
    }
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
    !tab ||
    tab.saving ||
    tab.savePending ||
    tab.loading ||
    tab.loadError ||
    tab.revisionPreview ||
    tab.restoring ||
    tab.revisionHistory.previewingId;
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

function hasDriveContentChanged(localFile, remoteFile) {
  if (localFile.md5Checksum && remoteFile.md5Checksum) {
    return localFile.md5Checksum !== remoteFile.md5Checksum;
  }
  return Boolean(
    localFile.version && remoteFile.version !== localFile.version
  );
}

function createRevisionHistoryState() {
  return {
    revisions: [],
    nextPageToken: null,
    loaded: false,
    loading: false,
    error: null,
    generation: 0,
    previewGeneration: 0,
    previewingId: null,
  };
}

function getDisplayedModel(tab = getActiveTab()) {
  return tab?.revisionPreview?.model || tab?.model || null;
}

function canShowRevisionHistory(tab) {
  return Boolean(tab?.file && !tab.loading && !tab.loadError);
}

function updateHistoryControls() {
  const tab = getActiveTab();
  historyModeButton.disabled = !canShowRevisionHistory(tab);
  revisionHistoryRefresh.disabled = !canShowRevisionHistory(tab);
  if (sidebarMode === "history" && !canShowRevisionHistory(tab)) {
    setSidebarMode("files");
  }
}

function updateSidebarModeTabStops() {
  filesModeButton.tabIndex = sidebarMode === "files" ? 0 : -1;
  historyModeButton.tabIndex = sidebarMode === "history" ? 0 : -1;
}

function setSidebarMode(mode) {
  const tab = getActiveTab();
  if (mode === "history" && !canShowRevisionHistory(tab)) {
    return;
  }

  sidebarMode = mode;
  filesModeButton.setAttribute("aria-selected", String(mode === "files"));
  historyModeButton.setAttribute("aria-selected", String(mode === "history"));
  updateSidebarModeTabStops();
  explorerPanel.hidden = mode !== "files";
  revisionHistoryPanel.hidden = mode !== "history";
  if (mode === "history") {
    document.body.classList.remove("explorer-collapsed");
    explorerToggle.setAttribute("aria-expanded", "true");
    renderRevisionHistory();
    requestRevisionHistory(tab);
  }
}

function requestRevisionHistory(tab, { append = false, force = false } = {}) {
  if (
    !tabs.includes(tab) ||
    !canShowRevisionHistory(tab) ||
    tab.revisionHistory.loading
  ) {
    return;
  }
  if (!append && tab.revisionHistory.loaded && !force) {
    renderRevisionHistory();
    return;
  }
  requestDriveAccess(() => {
    if (tabs.includes(tab)) {
      loadRevisionHistory(tab, { append });
    }
  });
}

async function loadRevisionHistory(tab, { append = false } = {}) {
  if (!tabs.includes(tab)) {
    return;
  }
  const history = tab.revisionHistory;
  const generation = ++history.generation;
  history.loading = true;
  history.error = null;
  if (!append) {
    history.revisions = [];
    history.nextPageToken = null;
  }
  renderRevisionHistory();

  try {
    const parameters = new URLSearchParams({
      pageSize: String(REVISION_PAGE_SIZE),
      fields:
        "nextPageToken,revisions(id,modifiedTime,size,md5Checksum,keepForever,originalFilename,lastModifyingUser(displayName))",
    });
    if (append && history.nextPageToken) {
      parameters.set("pageToken", history.nextPageToken);
    }
    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}/revisions?${parameters}`
    );
    const page = await response.json();
    if (!tabs.includes(tab) || generation !== history.generation) {
      return;
    }
    history.revisions = append
      ? [...history.revisions, ...(page.revisions || [])]
      : page.revisions || [];
    history.revisions.sort((first, second) =>
      second.modifiedTime.localeCompare(first.modifiedTime)
    );
    history.nextPageToken = page.nextPageToken || null;
    history.loaded = true;
  } catch (error) {
    console.error(error);
    if (tabs.includes(tab) && generation === history.generation) {
      history.error = error.message;
      setStatus("REVISION HISTORY FAILED");
    }
  } finally {
    if (tabs.includes(tab) && generation === history.generation) {
      history.loading = false;
      renderRevisionHistory();
    }
  }
}

function revisionIsCurrent(tab, revision, index) {
  if (tab.file.headRevisionId) {
    return revision.id === tab.file.headRevisionId;
  }
  return index === 0 && revision.md5Checksum === tab.file.md5Checksum;
}

function formatRevisionTime(value) {
  return new Date(value).toLocaleString();
}

function createRevisionItem(tab, revision, index) {
  const current = revisionIsCurrent(tab, revision, index);
  const item = document.createElement("div");
  item.className = `revision-item${current ? " current" : ""}`;
  item.dataset.revisionId = revision.id;

  const details = document.createElement("div");
  details.className = "revision-details";
  const name = document.createElement("span");
  name.className = "revision-name";
  name.textContent = current ? "CURRENT REVISION" : formatRevisionTime(revision.modifiedTime);
  const metadata = document.createElement("span");
  metadata.className = "revision-meta";
  const labels = [];
  if (current) {
    labels.push(formatRevisionTime(revision.modifiedTime));
  }
  if (revision.size) {
    labels.push(formatByteSize(Number(revision.size)));
  }
  if (revision.lastModifyingUser?.displayName) {
    labels.push(revision.lastModifyingUser.displayName);
  }
  if (revision.keepForever) {
    labels.push("KEPT FOREVER");
  }
  metadata.textContent = labels.join(" | ");
  details.append(name, metadata);
  item.append(details);

  if (!current) {
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    const viewing = tab.revisionPreview?.revision.id === revision.id;
    previewButton.textContent = viewing ? "VIEWING" : "PREVIEW";
    previewButton.disabled = viewing || Boolean(tab.revisionHistory.previewingId);
    previewButton.addEventListener("click", () => previewRevision(tab, revision));
    item.append(previewButton);
  }
  return item;
}

function renderRevisionHistory() {
  const tab = getActiveTab();
  revisionHistoryList.replaceChildren();
  revisionHistoryFilename.textContent = tab?.name || "NO FILE";
  if (!canShowRevisionHistory(tab)) {
    const message = document.createElement("div");
    message.className = "explorer-message";
    message.textContent = "OPEN A DRIVE FILE TO VIEW HISTORY";
    revisionHistoryList.append(message);
    return;
  }

  if (tab.dirty) {
    const unsaved = document.createElement("div");
    unsaved.className = "revision-item unsaved";
    unsaved.innerHTML =
      '<div class="revision-details"><span class="revision-name">UNSAVED REVISION</span><span class="revision-meta">LOCAL WORKING COPY | PRESERVED WHILE BROWSING</span></div>';
    revisionHistoryList.append(unsaved);
  }

  tab.revisionHistory.revisions.forEach((revision, index) => {
    revisionHistoryList.append(createRevisionItem(tab, revision, index));
  });

  if (tab.revisionHistory.loading) {
    const message = document.createElement("div");
    message.className = "explorer-message";
    message.textContent = "LOADING REVISION HISTORY";
    revisionHistoryList.append(message);
  } else if (tab.revisionHistory.error) {
    const message = document.createElement("div");
    message.className = "explorer-message";
    message.textContent = tab.revisionHistory.error;
    revisionHistoryList.append(message);
  } else if (tab.revisionHistory.loaded && !tab.revisionHistory.revisions.length) {
    const message = document.createElement("div");
    message.className = "explorer-message";
    message.textContent = "NO REVISIONS AVAILABLE";
    revisionHistoryList.append(message);
  }

  if (tab.revisionHistory.nextPageToken && !tab.revisionHistory.loading) {
    const loadMore = document.createElement("button");
    loadMore.type = "button";
    loadMore.className = "revision-load-more";
    loadMore.textContent = "LOAD OLDER REVISIONS";
    loadMore.addEventListener("click", () =>
      requestRevisionHistory(tab, { append: true })
    );
    revisionHistoryList.append(loadMore);
  }
}

async function downloadRevision(tab, revision) {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      tab.file.id
    )}/revisions/${encodeURIComponent(revision.id)}?alt=media`
  );
  return new Uint8Array(await response.arrayBuffer());
}

async function keepRevisionForever(tab, revision) {
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      tab.file.id
    )}/revisions/${encodeURIComponent(revision.id)}?fields=id,keepForever`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keepForever: true }),
    }
  );
  const updated = await response.json();
  revision.keepForever = updated.keepForever;
}

async function previewRevision(tab, revision) {
  const history = tab.revisionHistory;
  if (
    history.previewingId ||
    tab.restoring ||
    tab.saving ||
    tab.savePending ||
    tab.loading
  ) {
    return;
  }
  history.previewingId = revision.id;
  const previewGeneration = ++history.previewGeneration;
  updateSaveButton();
  updateRevisionPreviewBar();
  renderRevisionHistory();
  setStatus("LOADING REVISION");
  try {
    let bytes;
    try {
      bytes = await downloadRevision(tab, revision);
    } catch (error) {
      if (
        error.reason !== "download_restricted_for_revision" &&
        error.reason !== "downloadRestrictedForRevision"
      ) {
        throw error;
      }
      const accepted = await confirmAction({
        title: "KEEP REVISION FOREVER?",
        message:
          "DRIVE REQUIRES THIS REVISION TO BE KEPT FOREVER BEFORE IT CAN BE PREVIEWED.\n\nKEPT REVISIONS USE DRIVE STORAGE AND COUNT TOWARD THE 200-REVISION LIMIT.",
        acceptLabel: "KEEP & PREVIEW",
      });
      if (!accepted) {
        setStatus("REVISION PREVIEW CANCELLED");
        return;
      }
      await keepRevisionForever(tab, revision);
      bytes = await downloadRevision(tab, revision);
    }

    if (
      !tabs.includes(tab) ||
      previewGeneration !== history.previewGeneration
    ) {
      return;
    }
    const decoded = decodeUtf8Text(bytes);
    const model = monaco.editor.createModel(
      decoded.content,
      languageFromFilename(tab.name)
    );
    const previousPreview = tab.revisionPreview;
    tab.revisionPreview = { revision, bytes, decoded, model };
    if (tab.id === activeTabId) {
      editor.setModel(model);
      editor.updateOptions({ readOnly: true });
    }
    previousPreview?.model.dispose();
    renderTabs();
    updateSaveButton();
    updateActiveFileDisplay();
    updateRevisionPreviewBar();
    renderRevisionHistory();
    setStatus("REVISION PREVIEW");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    if (previewGeneration === history.previewGeneration) {
      history.previewingId = null;
      updateSaveButton();
      updateRevisionPreviewBar();
      renderRevisionHistory();
    }
  }
}

function exitRevisionPreview(tab) {
  const preview = tab?.revisionPreview;
  if (!preview) {
    return;
  }
  tab.revisionHistory.previewGeneration += 1;
  tab.revisionHistory.previewingId = null;
  if (tab.id === activeTabId) {
    editor.setModel(tab.model);
    editor.updateOptions({ readOnly: false });
  }
  tab.revisionPreview = null;
  preview.model.dispose();
  renderTabs();
  updateSaveButton();
  updateActiveFileDisplay();
  updateRevisionPreviewBar();
  renderRevisionHistory();
  setStatus("BACK TO LATEST");
}

function updateRevisionPreviewBar() {
  const tab = getActiveTab();
  const preview = tab?.revisionPreview;
  revisionPreviewBar.hidden = !preview;
  if (!preview) {
    return;
  }
  revisionPreviewLabel.textContent = `REVISION ${formatRevisionTime(
    preview.revision.modifiedTime
  )}`;
  backToLatestButton.disabled = Boolean(tab.restoring);
  restoreRevisionButton.disabled = Boolean(
    tab.restoring || tab.revisionHistory.previewingId
  );
}

async function restorePreviewedRevision(tab) {
  const preview = tab?.revisionPreview;
  if (
    !preview ||
    tab.restoring ||
    tab.saving ||
    tab.savePending ||
    tab.revisionHistory.previewingId
  ) {
    return;
  }
  const unsavedWarning = tab.dirty
    ? "\n\nYOUR UNSAVED REVISION WILL BE DISCARDED AFTER RESTORE SUCCEEDS."
    : "";
  const accepted = await confirmAction({
    title: "RESTORE REVISION?",
    message: `ARE YOU SURE YOU WANT TO RESTORE THIS REVISION?\n\nTHIS CREATES A NEW LATEST REVISION IN DRIVE.${unsavedWarning}`,
    acceptLabel: "RESTORE",
  });
  if (!accepted || !tabs.includes(tab) || tab.revisionPreview !== preview) {
    return;
  }

  tab.restoring = true;
  updateSaveButton();
  updateRevisionPreviewBar();
  setStatus("RESTORING REVISION");
  try {
    const metadataResponse = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?supportsAllDrives=true&fields=md5Checksum,version,modifiedTime`
    );
    const remoteFile = await metadataResponse.json();
    if (hasDriveContentChanged(tab.file, remoteFile)) {
      throw new Error("RESTORE BLOCKED: FILE CHANGED IN DRIVE");
    }

    const response = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?uploadType=media&supportsAllDrives=true&fields=id,name,mimeType,parents,md5Checksum,headRevisionId,version,modifiedTime`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": tab.file.mimeType || "text/plain; charset=utf-8",
        },
        body: preview.bytes,
      }
    );
    const savedFile = await response.json();
    tab.file = {
      ...tab.file,
      ...savedFile,
      hasUtf8Bom: preview.decoded.hasUtf8Bom,
    };
    tab.suppressDirtyTracking = true;
    try {
      tab.model.setValue(preview.decoded.content);
    } finally {
      tab.suppressDirtyTracking = false;
    }
    tab.dirty = false;
    syncDraftAfterSave(tab);
    tab.revisionHistory = createRevisionHistoryState();
    tab.restoring = false;
    exitRevisionPreview(tab);
    requestRevisionHistory(tab, { force: true });
    setStatus("REVISION RESTORED");
  } catch (error) {
    console.error(error);
    setStatus(error.message);
  } finally {
    tab.restoring = false;
    updateSaveButton();
    updateRevisionPreviewBar();
  }
}

function createTab({
  name,
  content = "",
  file = null,
  dirty = false,
  draftId = crypto.randomUUID(),
  loading = false,
  activate = true,
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
    revisionHistory: createRevisionHistoryState(),
    revisionPreview: null,
    restoring: false,
    model: monaco.editor.createModel(content, languageFromFilename(name)),
  };

  tab.model.onDidChangeContent(() => {
    if (tab.id === activeTabId) {
      updateEditorStats();
    }

    if (tab.suppressDirtyTracking) {
      return;
    }

    const dirty = tab.file ? true : tab.model.getValue().length > 0;
    if (tab.dirty !== dirty) {
      tab.dirty = dirty;
      renderTabs();
      updateActiveFileDisplay();
      renderRevisionHistory();
    }
    if (tab.dirty) {
      scheduleDraftSave(tab);
    } else {
      deleteDraftForTab(tab);
    }
  });

  tabs.push(tab);
  if (activate) {
    activateTab(tab.id);
  } else {
    renderTabs();
  }
  scheduleDraftSave(tab);
  return tab;
}

function createUntitledTab() {
  return createTab({
    name: `Untitled ${nextUntitledNumber++}`,
  });
  setStatus("NEW BUFFER");
}

function activateTab(tabId) {
  const tab = tabs.find((candidate) => candidate.id === tabId);
  if (!tab) {
    return;
  }

  activeTabId = tab.id;
  editor.setModel(getDisplayedModel(tab));
  editor.updateOptions({ readOnly: Boolean(tab.revisionPreview) });
  updateSaveButton();
  renderTabs();
  updateActiveFileDisplay();
  updateEditorState();
  updateHistoryControls();
  updateRevisionPreviewBar();
  renderRevisionHistory();
  if (sidebarMode === "history") {
    requestRevisionHistory(tab);
  }
  if (!tab.loading && !tab.loadError) {
    editor.focus();
  }
  saveWorkspace();
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) {
    return;
  }

  const tab = tabs[index];
  if (tab.saving || tab.savePending || tab.loading || tab.restoring) {
    setStatus(tab.loading ? "FILE LOAD IN PROGRESS" : "SAVE IN PROGRESS");
    return;
  }

  if (tab.dirty && !confirm(`Close ${tab.name} without saving?`)) {
    return;
  }

  deleteDraftForTab(tab);
  tabs.splice(index, 1);
  tab.revisionPreview?.model.dispose();
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
    saveWorkspace();
  }
}

function renderTabs() {
  tabsElement.replaceChildren();

  for (const tab of tabs) {
    const tabElement = document.createElement("div");
    tabElement.className = "tab";
    tabElement.classList.toggle("revision-preview", Boolean(tab.revisionPreview));
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
    ? `${tab.revisionPreview ? "REVISION PREVIEW | " : ""}${
        tab.dirty ? "MODIFIED | " : ""
      }${tab.name}`
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

function formatByteSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)) - 1,
    units.length - 1
  );
  const value = bytes / 1024 ** (unitIndex + 1);
  return `${Number(value.toFixed(value >= 100 ? 0 : 1))} ${units[unitIndex]}`;
}

function updateEditorStats() {
  const tab = getActiveTab();
  if (!tab) {
    cursorPosition.textContent = "LN --, COL --";
    documentStats.textContent = "0 LINES | 0 WORDS | 0 CHARS | 0 B";
    return;
  }

  const model = getDisplayedModel(tab);
  const value = model.getValue();
  const position = editor.getPosition() || { lineNumber: 1, column: 1 };
  const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
  const characters = [...value].length;
  const bytes = textEncoder.encode(value).length;

  cursorPosition.textContent = `LN ${position.lineNumber}, COL ${position.column}`;
  documentStats.textContent = `${model.getLineCount()} LINES | ${words} WORDS | ${characters} CHARS | ${formatByteSize(bytes)}`;
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
        "nextPageToken,files(id,name,mimeType,parents,md5Checksum,headRevisionId,version,modifiedTime)",
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
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,parents,md5Checksum,headRevisionId,version,modifiedTime",
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
        targetTab.revisionHistory = createRevisionHistoryState();
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
        if (targetTab.id === activeTabId) {
          updateHistoryControls();
        }
        saveWorkspace();
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

async function fetchAuthorizedGoogleAccount(token) {
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,permissionId)",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    throw new Error("GOOGLE ACCOUNT LOOKUP FAILED");
  }
  const { user } = await response.json();
  if (!user?.emailAddress || !user?.permissionId) {
    throw new Error("GOOGLE ACCOUNT IDENTITY UNAVAILABLE");
  }
  return {
    emailAddress: user.emailAddress,
    permissionId: user.permissionId,
  };
}

function resetDriveContextForAccountChange() {
  workspaceRestoring = true;
  const remainingTabs = [];
  for (const tab of tabs) {
    if (!tab.file) {
      remainingTabs.push(tab);
      continue;
    }
    deleteDraftForTab(tab);
    tab.revisionPreview?.model.dispose();
    tab.model.dispose();
  }
  tabs = remainingTabs;
  explorerRoot.children = [];
  explorerRoot.loaded = false;
  explorerRoot.loading = false;
  explorerRoot.expanded = true;
  selectedExplorerFolderId = EXPLORER_ROOT_ID;
  workspaceAccountId = null;
  setSidebarMode("files");
  renderExplorerTree();
  if (tabs.length) {
    activateTab(tabs[0].id);
  } else {
    activeTabId = null;
    editor.setModel(null);
    createUntitledTab();
  }
}

async function handleTokenResponse(response) {
  const generation = ++authorizationGeneration;
  const intent = authorizationIntent;
  authorizationIntent = "normal";
  const requests = pendingAuthorizationRequests;
  pendingAuthorizationRequests = [];

  if (response.error) {
    authorizationInProgress = false;
    if (intent === "silent") {
      pendingAuthorizationRequests.unshift(...requests);
      showReconnectDialog();
      setStatus("DRIVE RECONNECT REQUIRED");
      return;
    }
    accessToken = null;
    connectedGoogleAccount = null;
    workspaceAccountId = null;
    workspaceRestoring = false;
    setPreviousGoogleConsent(false);
    setAuthorizedGoogleAccount(null);
    for (const request of requests) {
      request.onError?.();
    }
    accountSwitchPending = false;
    updateAccountPanel();
    setStatus(`AUTH FAILED: ${response.error}`);
    return;
  }

  accessToken = response.access_token;
  setPreviousGoogleConsent(true);
  let account = null;
  try {
    account = await fetchAuthorizedGoogleAccount(accessToken);
  } catch (error) {
    console.error(error);
    if (intent === "switch") {
      accessToken = null;
      authorizationInProgress = false;
      accountSwitchPending = false;
      updateAccountPanel();
      setStatus(error.message);
      return;
    }
  }
  if (generation !== authorizationGeneration) {
    return;
  }

  const previousAccount = connectedGoogleAccount || authorizedGoogleAccount;
  const accountChanged = Boolean(
    account &&
      previousAccount &&
      account.permissionId !== previousAccount.permissionId
  );
  if (
    accountChanged &&
    intent !== "switch" &&
    tabs.some((tab) => tab.file && tab.dirty)
  ) {
    accessToken = null;
    authorizationInProgress = false;
    for (const request of requests) {
      request.onError?.();
    }
    setStatus("ACCOUNT CHANGED: USE SWITCH ACCOUNT");
    return;
  }
  if (accountChanged) {
    saveWorkspace(previousAccount);
    resetDriveContextForAccountChange();
  }
  if (account) {
    connectedGoogleAccount = account;
    setAuthorizedGoogleAccount(account);
  } else {
    updateAccountPanel();
  }

  accountSwitchPending = false;
  authorizationInProgress = false;
  updateAccountPanel();
  if (account) {
    restoreAccountWorkspace(account);
  }
  for (const request of requests) {
    request.run();
  }
  if (["silent", "reconnect", "switch"].includes(intent)) {
    loadExplorerFolder(explorerRoot, true);
    setStatus(intent === "switch" ? "ACCOUNT SWITCHED" : "DRIVE RECONNECTED");
  }
}

function switchGoogleAccount() {
  if (accountSwitchPending || authorizationInProgress) {
    return;
  }
  if (
    tabs.some(
      (tab) => tab.file && (tab.saving || tab.savePending || tab.loading || tab.restoring)
    )
  ) {
    setStatus("FINISH DRIVE OPERATIONS BEFORE SWITCHING ACCOUNT");
    return;
  }
  const hasDirtyDriveTabs = tabs.some((tab) => tab.file && tab.dirty);
  if (
    hasDirtyDriveTabs &&
    !confirm("Discard unsaved Drive file changes and switch Google account?")
  ) {
    return;
  }
  saveWorkspace();
  accountSwitchPending = true;
  authorizationInProgress = true;
  authorizationIntent = "switch";
  updateAccountPanel();
  tokenClient.requestAccessToken({ prompt: "select_account" });
}

function showReconnectDialog() {
  if (!reconnectDialog.open) {
    reconnectDialog.showModal();
  }
}

function maybeStartSilentReconnect() {
  if (
    silentReconnectStarted ||
    !editorReady ||
    !driveClientReady ||
    !authorizedGoogleAccount?.emailAddress
  ) {
    return;
  }
  silentReconnectStarted = true;
  authorizationInProgress = true;
  authorizationIntent = "silent";
  setStatus("RECONNECTING TO DRIVE");
  tokenClient.requestAccessToken({
    prompt: "none",
    login_hint: authorizedGoogleAccount.emailAddress,
  });
}

function startInteractiveReconnect() {
  reconnectDialog.close();
  authorizationInProgress = true;
  authorizationIntent = "reconnect";
  setStatus("AUTHORIZING DRIVE");
  tokenClient.requestAccessToken({
    prompt: hasPreviousGoogleConsent() ? "" : "consent",
    ...(authorizedGoogleAccount?.emailAddress
      ? { login_hint: authorizedGoogleAccount.emailAddress }
      : {}),
  });
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
    fontFamily: getFont(themePreferences.editorFont).stack,
    fontSize: themePreferences.editorFontSize,
    rulers: themePreferences.rulers,
    lineNumbersMinChars: 3,
    padding: { top: 8 },
    readOnly: true,
  });
  editor.onDidChangeCursorPosition(updateEditorStats);
  editorReady = true;
  newTabButton.disabled = false;
  updateExplorerCreateButtons();
  bootstrapTabId = createUntitledTab().id;
  showRecoveryDrafts();
  maybeStartSilentReconnect();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveWorkspace();
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
      const intent = authorizationIntent;
      authorizationIntent = "normal";
      authorizationInProgress = false;
      const requests = pendingAuthorizationRequests;
      pendingAuthorizationRequests = [];
      if (intent === "silent") {
        pendingAuthorizationRequests.unshift(...requests);
        showReconnectDialog();
        setStatus("DRIVE RECONNECT REQUIRED");
        return;
      }
      for (const request of requests) {
        request.onError?.();
      }
      accountSwitchPending = false;
      updateAccountPanel();
      setStatus(`AUTH FAILED: ${error.type || "POPUP ERROR"}`);
    },
    callback: handleTokenResponse,
  });
  driveClientReady = true;
  updateExplorerCreateButtons();
  updateAccountPanel();
  maybeStartSilentReconnect();
});

window.addEventListener("beforeunload", (event) => {
  saveWorkspace();
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
filesModeButton.addEventListener("click", () => setSidebarMode("files"));
historyModeButton.addEventListener("click", () => setSidebarMode("history"));
for (const button of [filesModeButton, historyModeButton]) {
  button.addEventListener("keydown", (event) => {
    let target = null;
    if (event.key === "ArrowLeft" || event.key === "Home") {
      target = filesModeButton;
    } else if (event.key === "ArrowRight" || event.key === "End") {
      target = historyModeButton;
    }
    if (!target || target.disabled) {
      return;
    }
    event.preventDefault();
    setSidebarMode(target === filesModeButton ? "files" : "history");
    target.focus();
  });
}
revisionHistoryRefresh.addEventListener("click", () => {
  const tab = getActiveTab();
  if (tab) {
    requestRevisionHistory(tab, { force: true });
  }
});
backToLatestButton.addEventListener("click", () =>
  exitRevisionPreview(getActiveTab())
);
restoreRevisionButton.addEventListener("click", () =>
  restorePreviewedRevision(getActiveTab())
);
switchAccountButton.addEventListener("click", switchGoogleAccount);
connectDriveButton.addEventListener("click", startInteractiveReconnect);
closeReconnectButton.addEventListener("click", () => reconnectDialog.close());
cancelReconnectButton.addEventListener("click", () => reconnectDialog.close());
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
  if (authorizationInProgress || pendingAuthorizationRequests.length > 1) {
    setStatus("AUTHORIZATION ALREADY IN PROGRESS");
    return true;
  }

  authorizationInProgress = true;
  authorizationIntent = "normal";
  setStatus("AUTHORIZING DRIVE");
  tokenClient.requestAccessToken({
    prompt: hasPreviousGoogleConsent() ? "" : "consent",
    ...(authorizedGoogleAccount?.emailAddress
      ? { login_hint: authorizedGoogleAccount.emailAddress }
      : {}),
  });
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
        )}?supportsAllDrives=true&fields=id,name,mimeType,parents,md5Checksum,headRevisionId,version,modifiedTime`
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
        )}?supportsAllDrives=true&fields=md5Checksum,version,modifiedTime`
      );
      const confirmation = await confirmationResponse.json();

      if (!hasDriveContentChanged(file, confirmation)) {
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
    tab.revisionHistory = createRevisionHistoryState();
    tab.name = stableFile.name;
    tab.loading = false;
    tab.loadError = null;
    monaco.editor.setModelLanguage(tab.model, languageFromFilename(tab.name));
    renderTabs();
    updateActiveFileDisplay();
    updateSaveButton();
    if (tab.id === activeTabId) {
      updateEditorState();
      updateHistoryControls();
      editor.focus();
    }
    setStatus("LOADED");
    saveWorkspace();
  } catch (error) {
    console.error(error);
    if (tabs.includes(tab)) {
      tab.loading = false;
      tab.loadError = error.message;
      renderTabs();
      updateSaveButton();
      if (tab.id === activeTabId) {
        updateEditorState();
        updateHistoryControls();
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
    tab.loadError ||
    tab.revisionPreview ||
    tab.restoring ||
    tab.revisionHistory.previewingId
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
      )}?supportsAllDrives=true&fields=md5Checksum,version,modifiedTime`
    );
    const remoteFile = await metadataResponse.json();
    if (hasDriveContentChanged(tab.file, remoteFile)) {
      throw new Error("SAVE BLOCKED: FILE CHANGED IN DRIVE");
    }

    setStatus("SAVING");
    const response = await driveFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        tab.file.id
      )}?uploadType=media&supportsAllDrives=true&fields=id,name,mimeType,parents,md5Checksum,headRevisionId,version,modifiedTime`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": tab.file.mimeType || "text/plain; charset=utf-8",
        },
        body: contentForUpload(tab, content),
      }
    );

    tab.file = { ...tab.file, ...(await response.json()) };
    tab.revisionHistory = createRevisionHistoryState();
    tab.dirty = tab.model.getValue() !== content;
    syncDraftAfterSave(tab);
    renderTabs();
    updateActiveFileDisplay();
    setStatus(tab.dirty ? "SAVED | NEW CHANGES PENDING" : "SAVED");
    if (sidebarMode === "history" && tab.id === activeTabId) {
      requestRevisionHistory(tab, { force: true });
    }
    saveWorkspace();
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
    connectedGoogleAccount = null;
    updateAccountPanel();
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
