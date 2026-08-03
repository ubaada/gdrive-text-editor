# Drive Edit Product Specification

This document is the canonical description of the application's current product
behavior. It describes the final requirement when requirements have changed over
time; it is not a changelog.

## Product Scope

Drive Edit is a browser-based, monochrome text editor for ordinary text files in
Google Drive. It is a client-only application: the browser talks directly to
Google Identity Services and Google Drive, and no application backend stores
files or credentials.

The product must provide:

- A custom Google Drive file explorer.
- A Monaco-based tabbed text editor.
- Creation and saving of files and folders in Drive.
- Local recovery of unsaved work.
- Protection against overwriting remotely changed content.
- Drive revision listing, preview, and confirmed restoration.
- Persistent appearance and font preferences.

Google Picker is not part of the product. Files are opened through the custom
Drive explorer, and new buffers are created with the tab-bar `+` control.

## Visual Language

- The application uses a square-edged, bordered, terminal-like visual language.
- UI and editor typography are monospaced.
- The shell is monochrome within the selected palette, with foreground,
  background, dim, and panel colors.
- Buttons normally invert foreground and background on hover and keyboard focus.
- A selected tab and its close button must retain the selected-tab colors on
  hover and focus; they must not flip back to the unselected palette.
- Long filenames and constrained controls must truncate or scroll rather than
  break the layout.
- The favicon is a white file/document symbol containing an asterisk.

The default dark presentation is Carbon White. The available palettes are:

- Dark: Terminal Green, Amber CRT, Midnight Blue, Violet Console, Carbon White.
- Light: Paper Ink, Arctic Blue, Sage Terminal, Rose Print, Solar Sand.

Carbon White and Solar Sand are the reference screenshot themes.

## Application Layout

The viewport is divided into:

1. A header containing `[=]`, `DRIVE.EDIT`, `[S] SAVE`, and `[G] SETTINGS`.
2. A workspace containing the left Drive sidebar and the editor pane.
3. A footer containing filename state, operation status, cursor position, and
   document statistics.

The editor pane contains a horizontally scrollable tab strip and the Monaco
editor surface. The `+` tab button sits immediately after the open tabs, not at
the far edge of the available strip.

The Drive sidebar has `FILES` and `HISTORY` modes. The explorer toggle hides or
shows the complete sidebar.

There is no persistent connected/disconnected badge. Authorization and Drive
operations are communicated through transient footer statuses.

## Tabs And Buffers

- Monaco initialization creates one active empty buffer named `Untitled 1`.
- Additional untitled buffers increment the number and are created with `+` or
  `Ctrl/Cmd+N`.
- A clean tab shows `X`; a dirty tab shows a solid dot in its close control.
- The application must always keep at least one tab open. Closing the last tab
  immediately creates a fresh empty untitled tab.
- Empty untitled tabs are clean. Closing them must not ask to save and must not
  create a recovery record.
- If an untitled tab is typed into and then returned to exactly empty content,
  it becomes clean and its local draft is removed.
- Closing a dirty tab asks `Close <name> without saving?`. Cancel keeps it open;
  confirmation discards it and removes its local draft.
- Tabs cannot close while their file is loading, saving, waiting for a save
  destination/authorization, or being restored.
- Opening a Drive file from the explorer when that file is already open
  activates its existing tab rather than creating a duplicate. Restoring a
  Drive-backed recovery draft can create a separate tab for that draft.
- A failed Drive-file tab remains available and selecting the file again retries
  the load.

## Editor Behavior

- Monaco uses automatic layout, word wrapping, line numbers, no minimap, and the
  configured editor font and size.
- Normal buffers are editable. Historical revision previews are read-only.
- Language mode follows the filename extension for JavaScript, TypeScript,
  JSON, Markdown, HTML, CSS, XML, YAML, Python, Go, Java, shell, and plain text;
  unknown extensions use plain text.
- Naming a new file updates the tab name and Monaco language mode.
- `Ctrl/Cmd+S` invokes exactly the same guarded save flow as the Save button.

## Supported Files And Encoding

- Google Workspace-native files such as Docs, Sheets, and Slides are not
  editable and must be presented as unsupported.
- Supported files include `text/*`, safe `application/octet-stream` content,
  MIME types ending in `+json` or `+xml`, and these application MIME types:
  ECMAScript, JavaScript, JSON, JSON-LD, SQL, TOML, XML, YAML, PHP, shell
  scripts, and empty files.
- MIME type alone is insufficient: bytes must pass the text-safety checks.
- Only valid UTF-8 is editable.
- UTF-16 and UTF-32 BOMs, invalid UTF-8, NUL bytes, and binary-looking control
  content are rejected with a clear load error.
- A UTF-8 BOM is hidden from the editor model and preserved on every save or
  restore.

## Google Authorization

- Authorization is requested only when a Drive operation requires it. The page
  must not automatically connect to Drive at startup.
- Authorization requests full Google Drive access so the custom explorer can
  list, create, read, and update files and folders.
- The first authorization requests explicit consent.
- The browser remembers prior consent and the authorized account's email and
  stable Drive identity. The email is used as a Google login hint so later token
  requests normally skip account selection and do not force consent again.
- OAuth access tokens remain in memory and are not persisted across reloads.
- While authorization is pending, compatible requests may queue and the footer
  reports authorization progress.
- OAuth denial or revocation clears the remembered-consent marker. A transient
  popup failure reports the error but does not clear remembered consent.
- An expired token is cleared and the next user-initiated Drive operation must
  authorize again using the remembered account hint.
- Account settings show the connected or remembered email and provide
  `SWITCH ACCOUNT`.
- Switching explicitly requests Google's account selector without the old login
  hint. If Drive-backed tabs contain unsaved edits, switching first asks whether
  those edits may be discarded. Cancellation leaves the account and work
  unchanged; confirmed edits are discarded only after a different account is
  successfully authorized.

## Drive File Explorer

- Before connection, Files mode instructs the user to select Refresh.
- Files mode provides `+ FILE`, `+ FOLDER`, and `REFRESH`.
- The explorer is hierarchical and lazy-loads folder contents.
- Folders appear before files; names use locale-aware alphabetical sorting
  within each group.
- Folder rows show `[+]` when collapsed and `[-]` when expanded.
- Folder loading has an inline animated indicator. Empty and unloaded folders
  have explicit messages.
- The selected folder is the destination for new files and folders.
- Refresh updates the selected folder. It falls back to My Drive when the
  selected folder is no longer present in a refreshed tree or a creation
  destination is reported unavailable.
- Selecting a supported file immediately opens a named loading tab before the
  content request finishes.
- A file load must produce a stable content snapshot. If Drive content changes
  during loading, retry and then fail clearly rather than displaying a mixed
  snapshot.
- Unsupported rows are visibly dimmed, exposed as disabled, and explain why the
  file cannot be edited.

### Inline Creation

- Only one inline creation operation may be active.
- New-file naming begins with `.txt`, with the insertion point before the
  extension so typing `notes` produces `notes.txt`.
- New-folder naming begins empty.
- Enter submits; Escape and the inline `X` cancel.
- Empty folder names and an unchanged `.txt` filename are rejected.
- Creation occurs in the selected folder and refreshes that folder afterward.
- `+ FILE` creates an empty text file and opens it in a new clean tab.
- Saving an untitled buffer uses the same inline file naming UI and converts the
  existing tab into the newly created Drive file without losing its content.
- If the destination disappears or becomes inaccessible, retain the operation,
  move its destination to My Drive, and allow retry.

## Saving And Remote-Change Protection

- Save is unavailable while the active tab is loading, load-failed, saving,
  waiting for authorization/destination, loading or displaying a revision
  preview, or restoring.
- Save may be invoked for a clean Drive file and for a pristine untitled buffer;
  it is not limited to dirty tabs.
- Existing-file saves visibly check Drive before uploading.
- A genuine remote content change since load or the previous successful save
  must block the upload with `SAVE BLOCKED: FILE CHANGED IN DRIVE` and preserve
  local edits.
- Metadata-only Drive changes must not create false conflicts. In particular,
  repeated edits and saves in this application must continue to work.
- The content check and post-save baseline must use content-specific metadata
  when Drive provides it, with a safe fallback for legacy records.
- Edits made while an upload is in flight must remain dirty after that upload;
  the UI reports that new changes are pending.
- Successful saves update Drive metadata, remove an obsolete recovery draft,
  and invalidate cached revision history.

## Local Drafts And Recovery

- Dirty work is backed up locally in the browser shortly after editing and is
  flushed when the page becomes hidden.
- Dirty tabs trigger the browser's unload warning and an emergency local backup.
- Startup imports emergency records and then offers recoverable work in a
  `RECOVERY DRAFTS` dialog.
- Recovery entries are newest first and show name, backup time, `RESTORE`, and
  `DISCARD`.
- Restoring opens a dirty tab and retains associated Drive identity/metadata.
- Discard permanently removes the local draft.
- The dialog closes after its final entry is handled.
- Empty untitled records from older application versions are silently deleted
  and must never be offered for recovery.
- Successful save or confirmed tab discard removes the associated draft.
- IndexedDB recovery failures are shown in the footer. Emergency local-storage
  backup failures are currently recorded only in the browser console.

## Revision History

### Listing

- History mode is enabled for a Drive-backed tab that is not loading and has no
  load error, including a restored Drive-backed recovery draft.
- Selecting History opens the sidebar if necessary and lists the active file's
  available Drive revisions newest first.
- Entries show the revision matching the tab's loaded or last-saved Drive
  baseline as `CURRENT REVISION`, plus date/time, readable size, last modifying
  user when available, and `KEPT FOREVER` when applicable. A remote change can
  make that baseline older than Drive's actual head until the file is reloaded.
- If the working model is dirty, a top entry named `UNSAVED REVISION` represents
  the local working copy and states that it is preserved while browsing.
- History supports loading additional pages, explicit refresh, loading, empty,
  and error states.

### Preview

- Non-current Drive revisions have a `PREVIEW` action.
- Preview downloads the historical bytes into a separate Monaco model. It must
  not mutate the working model, its undo history, dirty state, or recovery draft.
- The preview replaces the visible editor content and is read-only.
- The previewing tab header, and only the tab header, uses a cross-hatched
  background. The editor background remains readable and unhatched.
- A top-right editor control appears with the revision time,
  `BACK TO LATEST`, and `RESTORE`.
- Save and `Ctrl/Cmd+S` are disabled throughout preview loading and viewing.
- `BACK TO LATEST` returns to the preserved working model. For a clean tab this
  is the latest saved content; for a dirty tab it is the unsaved local content.
- Switching tabs may preserve each tab's preview state. Closing or replacing a
  preview must dispose its temporary model safely.
- Stale or superseded asynchronous preview responses must never resurrect a
  preview or replace the wrong tab.

Drive may reject downloading an older unretained revision. The application must:

1. Attempt ordinary Preview first without changing retention.
2. If Drive specifically reports that the revision must be retained, explain
   the storage impact and 200-kept-revision limit.
3. Offer `KEEP & PREVIEW` and proceed only after explicit confirmation.
4. Never mark a revision Keep forever silently.

### Restore

- `RESTORE` is available only for a fully loaded historical preview.
- Restore always shows a confirmation beginning with
  `ARE YOU SURE YOU WANT TO RESTORE THIS REVISION?`.
- The confirmation explains that restoration creates a new latest Drive
  revision.
- If the working copy is dirty, it explicitly warns that the unsaved revision
  will be discarded after restoration succeeds.
- Cancel keeps both the preview and working copy unchanged.
- Before upload, restoration performs the same remote-content conflict check as
  Save. A conflict reports `RESTORE BLOCKED: FILE CHANGED IN DRIVE`.
- Restoration uploads the exact historical bytes, including BOM state, and
  therefore creates a new latest revision rather than deleting history.
- Local unsaved data is discarded only after Drive confirms a successful
  restore upload.
- Success updates the working model, marks it clean, clears its draft, exits
  preview, refreshes history, and reports `REVISION RESTORED`.
- Conflict or upload failure preserves the unsaved working copy and preview.

## Settings

`[G] SETTINGS` opens a dialog with Appearance and Account sections.

Appearance contains:

- Manual light/dark mode.
- Follow System.
- UI font and size.
- Editor font and size.
- Dark-theme selection.
- Light-theme selection.

Account shows the connected or remembered Google email and provides the account
switch action described under Google Authorization.

Defaults are dark mode, Follow System off, Carbon White for dark, Paper Ink for
light, GT America Mono for both UI and editor, and 14 px font sizes.

Available font choices are GT America Mono, System Mono, Courier New, Consolas,
and Monaco. UI sizes are 10, 11, 12, 13, 14, 15, 16, and 18 px. Editor sizes
also include 20, 22, 24, and 28 px.

Changes apply immediately and survive reload. Invalid stored values fall back to
defaults. GT America Mono uses system monospace fallbacks when unavailable.
Follow System tracks `prefers-color-scheme` and disables manual mode selection
while still allowing both theme choices to be configured.

## Status, Loading, And Statistics

- The footer is the primary channel for authorization, loading, creation, save,
  conflict, recovery, revision, and error statuses.
- File loading replaces the editor with an accessible `LOADING FILE` state and
  animated indicator. Load failure remains visible as `LOAD FAILED: <error>`.
- Folder loading uses an inline form of the same indicator.
- Continuous animation is disabled when reduced motion is requested.
- The filename footer prefixes `MODIFIED |` for dirty work and
  `REVISION PREVIEW |` while previewing.
- Cursor and document statistics reflect the currently displayed model,
  including a historical preview.
- Statistics show line, whitespace-delimited word, Unicode character, and UTF-8
  byte counts.
- Byte values use readable binary units: B, KB, MB, GB, and TB.

## Responsive And Accessibility Requirements

- At 600 px or narrower, hide the application title, compact header controls,
  reduce tab minimum width, and present the Drive sidebar as a left overlay no
  wider than 88 percent of the viewport.
- On small screens the preview action bar spans the editor width, hides its
  timestamp label, and gives equal space to Back and Restore.
- Settings and recovery layouts must reflow without horizontal page scrolling.
- Native controls, dialogs, tree items, status regions, and Files/History tabs
  retain meaningful accessible names and state. Open-file tabs currently do not
  implement a complete ARIA tab/tabpanel keyboard model.
- Files/History mode tabs support keyboard navigation: Left/Home selects Files;
  Right/End selects History when available.
- Loading/status regions use polite announcements. The editor exposes busy state
  while a file loads; folder loading is represented by an inline status item.
- Focus must remain visibly distinguishable, including on cross-hatched preview
  tabs.

## Acceptance And Regression Policy

The Playwright suite provides partial regression coverage for this
specification. Material behavior changes must update both this document and the
relevant tests, adding missing coverage where practical. Tests must remain
deterministic, parallel-safe, and independent of live Google credentials or
network access to Drive.
