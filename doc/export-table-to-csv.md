# Export table to CSV — Architecture and implementation

This document describes how the **Export table to CSV** feature is implemented: architecture, data flow, key types, and where each responsibility lives. It is intended for both humans and automated agents working on the codebase.

---

## 1. Feature overview

**What it does:** The user can export a markdown (GFM) table from the current note to a CSV file in the vault.

**Entry points:**

- **Context menu:** Right-click on a table in the editor → **Table Tools** → **Export table to CSV**. The table is determined by where the user clicked (and optionally by the editor that contains that click).
- **Command palette:** Run **Export table to CSV** while the cursor is inside a table. The table is determined by the cursor line.

**Outcome:** A modal shows a preview of the CSV (with optional “Include table headers” toggle). The user can click **Save to file** to write a CSV into the configured default export folder. The filename uses the table’s block ID (e.g. `^table-1`) when present, otherwise the first header cell or a timestamp.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  main.ts (Plugin lifecycle)                                                   │
│  - Registers command "export-table-csv"                                       │
│  - Captures contextmenu → TableContextResolver.setContextMenuEvent            │
│  - Registers editor-menu → resolve context, add "Table Tools" submenu          │
│  - addSettingTab(EmicTableToolsSettingTab)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  commands/export-table-csv.ts                                                 │
│  - exportTableToCsv(plugin, resolver, context?)                                │
│  - Gets ResolvedTableContext (from argument or resolver.resolveForCommand)    │
│  - Calls openCsvExportForContext(plugin, context, view.file)                  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  table-actions/export-csv.ts                                                  │
│  - openCsvExportForContext(plugin, context, sourceFile)                       │
│  - Guards: empty rows → notice and return                                    │
│  - Opens CsvExportModal(app, context.rows, plugin, sourceFile, blockId)     │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ui/csv-export-modal.ts                                                       │
│  - Shows preview (rowsToCsv), "Include table headers" checkbox, Save button  │
│  - saveToFile(): uses defaultExportFolder, buildFilename(), vault.create       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Table context resolution** (used when the action is triggered from the context menu and no context is passed, or when context is passed from the menu):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  table-context/resolver.ts — TableContextResolver                            │
│  - setContextMenuEvent(evt): stores click position, target, targetIsTable     │
│  - resolveForEditorMenu(editor): uses last contextmenu + editor → context    │
│  - resolveForCommand(editor): cursor line → getTableAtCursor → context       │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ├── Position → line: editor-position.ts (mapTargetToLine, mapCoordsToLine, probeCoordLines)
          ├── Rows from DOM: dom-table.ts (extractRowsFromTableTarget)
          └── Rows + blockId from markdown: utils/table-detection.ts
                  (getTableAtLine, getTableAtCursor, getBlockIdForMatchingTable, findBlockIdForMatchingTableInDocument)
```

---

## 3. Data flow (end-to-end)

1. **User action**
   - **A) Context menu:** User right-clicks on a table.  
     - Earlier, a global `contextmenu` (capture) handler called `TableContextResolver.setContextMenuEvent(evt)` and stored `(x, y, target, targetIsTable)`.  
     - When the **editor-menu** event fires, the handler calls `resolver.resolveForEditorMenu(editor)` and, if non-null, adds **Table Tools** → **Export table to CSV** with an `onClick` that calls `exportTableToCsv(plugin, resolver, context)` with that resolved context.
   - **B) Command:** User runs **Export table to CSV** from the palette.  
     - Command runs `exportTableToCsv(plugin, resolver)` with no context.  
     - The command implementation uses `resolver.resolveForCommand(editor)` to get the table at the cursor.

2. **Resolving the table (context)**
   - **ResolvedTableContext** = `{ source: "markdown"|"dom", rows: string[][], blockId: string | null, preferredLine?: number }`.
   - **From context menu (resolveForEditorMenu):**
     - Prefer **markdown path:** map click to a line (via `mapTargetToLine`, `mapLineElementAtPointToLine`, `mapCoordsToLine` or `probeCoordLines`), then `getTableAtLine(editor, line ± deltas)` to get rows + blockId. If the mapped line is 0 and the file is long, a wider range of lines is tried so tables further down are found.
     - If that fails, **DOM fallback:** `extractRowsFromTableTarget(target)` to get rows from the rendered table. The **editor** used for block-ID lookup is the one that contains the clicked element (`getEditorContainingTarget`), so the correct file is searched. Then `getBlockIdForMatchingTable(editorToSearch, domRows, center)` for several candidate lines, or `findBlockIdForMatchingTableInDocument(editorToSearch, domRows)` if needed.
   - **From command (resolveForCommand):** `getTableAtCursor(editor)` → `getTableAtLine(editor, cursor.line)` → same shape (rows + blockId).

3. **Opening the export modal**
   - `exportTableToCsv` gets the active `MarkdownView` and uses `context ?? resolver.resolveForCommand(editor)`. If there is no table, it shows a notice and returns.
   - `openCsvExportForContext(plugin, context, sourceFile)` checks `context.rows.length`; if 0, shows “Table has no rows” and returns. Otherwise it opens `CsvExportModal(app, context.rows, plugin, sourceFile, context.blockId)`.

4. **Modal and save**
   - **CsvExportModal** displays a read-only textarea with `rowsToCsv(rows, includeHeader)` (from `utils/csv.ts`), a checkbox to include/exclude the header row, and a **Save to file** button.
   - **Save to file:** Reads `plugin.settings.defaultExportFolder`. If empty, asks the user to set it in settings. Otherwise builds a filename with `buildFilename()` (blockId or first header cell or timestamp), avoids overwriting by appending `-1`, `-2`, … if the path exists, then `vault.create(fullPath, content)` and closes the modal.

---

## 4. Key types

| Type | Definition | Where |
|------|------------|--------|
| **ResolvedTableContext** | `{ source: "markdown" \| "dom"; rows: string[][]; blockId: string \| null; preferredLine?: number }` | `src/types.ts` |
| **TableAtCursor** | `{ rows: string[][]; blockId: string \| null }` (markdown table at a line) | `src/utils/table-detection.ts` |
| **CsvExportPlugin** | `{ app: App; settings: { defaultExportFolder: string } }` (minimal plugin interface for export) | `src/ui/csv-export-modal.ts` |
| **EmicTableToolsSettings** | `{ defaultExportFolder: string }` | `src/settings.ts` |

Rows are always **header + data only**; the GFM separator row is excluded in both markdown parsing and DOM extraction so that DOM and markdown row counts match when resolving block IDs.

---

## 5. Module responsibilities

| Path | Role |
|------|------|
| **src/main.ts** | Plugin lifecycle: load settings, register command and editor-menu, capture contextmenu, add settings tab. Does not implement export logic. |
| **src/commands/export-table-csv.ts** | Entry for “Export table to CSV”: get active view, resolve context (or use passed context), call `openCsvExportForContext`. |
| **src/table-actions/export-csv.ts** | Validates context (non-empty rows), opens `CsvExportModal` with rows, source file, and blockId. |
| **src/table-context/resolver.ts** | Stores last context-menu event; implements `resolveForEditorMenu` (click → table) and `resolveForCommand` (cursor → table). Uses editor-position, dom-table, and table-detection. Finds editor containing target when needed. |
| **src/table-context/editor-position.ts** | Maps (target or x,y) to editor line number: `mapTargetToLine`, `mapLineElementAtPointToLine`, `mapCoordsToLine`, `probeCoordLines`. Uses CodeMirror internals (posAtDOM, posAtCoords) with try/catch. |
| **src/table-context/dom-table.ts** | `extractRowsFromTableTarget(target)`: from a table cell element, finds the table, iterates `tr`/`th,td`, trims cell text, skips separator row; returns `string[][]` or null. |
| **src/utils/table-detection.ts** | Markdown table parsing: `getTableAtLine`, `getTableAtCursor`, `parseRowLine`, `isSeparatorLine`, `parseBlockIdLine`. Block ID lookup: `getBlockIdForMatchingTable(editor, rows, aroundLine)`, `findBlockIdForMatchingTableInDocument(editor, rows)`. |
| **src/utils/csv.ts** | `rowsToCsv(rows, includeHeader)`: RFC 4180-style CSV (quotes/escapes, `\r\n`). |
| **src/ui/csv-export-modal.ts** | Modal UI: preview, “Include table headers” checkbox, Save button. Builds filename (blockId / first header / timestamp), handles duplicate names, calls `vault.create`. |
| **src/ui/folder-picker-modal.ts** | Modal to choose a vault folder (for default export folder in settings). Collects folder paths from vault root, search filter, click to select. |
| **src/settings.ts** | `EmicTableToolsSettings`, `DEFAULT_SETTINGS`, `EmicTableToolsSettingTab`: default export folder text + “Choose folder” button (opens FolderPickerModal). |

---

## 6. Table context resolution in detail

**Why two paths?**

- **Context menu:** The menu is built for “the” editor, but the user clicked on a specific element. That element might be in a different pane (e.g. Reading view) or the click position might map to the wrong line (e.g. line 0). So we try markdown first (position → line → `getTableAtLine`), then fall back to DOM (rows from the clicked table) and then find the same table in the correct editor to get its block ID.
- **Command:** The cursor is in the active editor, so we only need the table at the cursor line: `getTableAtCursor(editor)`.

**Constants (resolver):**

- `CONTEXT_MENU_FRESHNESS_MS = 15000`: treat the last context-menu event as valid for 15 seconds.
- `CONTEXT_MENU_LINE_DELTAS`: when mapping click to line, try line + [0, ±1, ±2, ±3, ±4, ±5]. If the mapped line is 0 and the file has >10 lines, try lines 0..50 so tables further down are found.

**Block ID when using DOM fallback:**

- Rows come from the DOM; the block ID is not in the DOM. So we search the **editor that contains the clicked target** (`getEditorContainingTarget`) for a markdown table with the same row count and first row (`getBlockIdForMatchingTable` with several candidate centers, then `findBlockIdForMatchingTableInDocument` if needed) and use that table’s block ID.

---

## 7. CSV format and filename

- **CSV:** RFC 4180-style: fields containing `,`, `"`, or newline are quoted; internal `"` escaped as `""`; rows joined with `\r\n`. Implemented in `src/utils/csv.ts` (`rowsToCsv`).
- **Filename:** `{noteBasename}-{tableName}.csv`. `tableName` is, in order: `blockId` (if set), else sanitized first header cell, else `unnamedtable-{timestamp}`. If the path already exists, `-1`, `-2`, … is appended before `.csv`.

---

## 8. Settings and folder picker

- **Setting:** `defaultExportFolder` (string). Shown in **Settings → Emic Table Tools** as “Default export folder” with a text field and “Choose folder” button.
- **FolderPickerModal:** Recursively collects vault folder paths from `vault.getRoot()` (guarded if root is null). User can filter by typing; clicking a path sets it and closes the modal. Used only from the settings tab to set `defaultExportFolder`.

---

## 9. File reference (quick lookup)

| Need to… | See / edit |
|----------|------------|
| Change how the plugin registers the command or context menu | `src/main.ts` |
| Change what happens when “Export table to CSV” is run | `src/commands/export-table-csv.ts` |
| Change empty-table or open-modal behavior | `src/table-actions/export-csv.ts` |
| Change how we decide “which table” from a right-click | `src/table-context/resolver.ts` |
| Change how click position or DOM target becomes a line number | `src/table-context/editor-position.ts` |
| Change how we get rows from the rendered table (DOM) | `src/table-context/dom-table.ts` |
| Change markdown table parsing or block ID detection | `src/utils/table-detection.ts` |
| Change CSV serialization | `src/utils/csv.ts` |
| Change export modal UI or save logic | `src/ui/csv-export-modal.ts` |
| Change default export folder setting or picker | `src/settings.ts`, `src/ui/folder-picker-modal.ts` |
| Change shared context type | `src/types.ts` |

---

## 10. Dependencies between modules

- **main** → settings, commands/export-table-csv, utils/table-detection, table-context/resolver.
- **commands/export-table-csv** → types, ui/csv-export-modal (CsvExportPlugin), table-actions/export-csv, table-context/resolver.
- **table-actions/export-csv** → types, ui/csv-export-modal, obsidian Notice.
- **table-context/resolver** → types, table-context/dom-table, table-context/editor-position, utils/table-detection, MarkdownView.
- **table-context/editor-position** → Obsidian Editor (and CodeMirror internals).
- **table-context/dom-table** → none (pure DOM + table separator heuristic).
- **utils/table-detection** → Obsidian Editor only.
- **utils/csv** → none (pure function).
- **ui/csv-export-modal** → utils/csv, Obsidian Modal/Notice/normalizePath/vault.
- **ui/folder-picker-modal** → Obsidian Modal/TFolder.
- **settings** → main (plugin class), ui/folder-picker-modal.

No circular dependencies. Table context resolution is the most cross-cutting part (resolver → editor-position, dom-table, table-detection).
