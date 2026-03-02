# Assign block-id to tables — Architecture and implementation

This document describes how the **block-id** features are implemented: assigning Obsidian block IDs to markdown tables so they can be linked (e.g. `^tabla-1`). It covers both the single-table and the all-tables commands. It is intended for both humans and automated agents working on the codebase.

---

## 1. Feature overview

**What it does:** The user can assign Obsidian block IDs to GFM tables. Once a table has a block-id (e.g. `^tabla-1` on the line immediately after the table), it can be linked from elsewhere in the vault.

**Two entry points:**

- **Asignar block-id a esta tabla** (assign block-id to this table)
  - **Context menu:** Right-click on a table → **Table Tools** → **Asignar block-id a esta tabla**. The table is determined by the click position (same resolution as Export table to CSV).
  - **Command palette:** Run **Asignar block-id a esta tabla** while the cursor is inside a table. The table is determined by the cursor line.
  - **Outcome:** If the table has no block-id, a new line `^tabla-N` is inserted after the last row of the table (N = next free number in the note). If it already has a block-id, a notice is shown and nothing is changed.

- **Asignar block-id a todas las tablas de esta nota que no tengan** (assign block-id to all tables in this note that don’t have one)
  - **Command palette only.** No context menu.
  - **Outcome:** The plugin scans the active note for all GFM tables. For each table that does not already have a block-id on the line(s) after it, it inserts `^tabla-N`, `^tabla-(N+1)`, … from bottom to top so line numbers remain valid. A notice reports how many tables were assigned.

**Block-id format:** `^tabla-1`, `^tabla-2`, … (lowercase `tabla-` plus integer). The next number is computed by scanning the whole note for existing `^tabla-(\d+)` lines and using `max + 1`.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  main.ts (Plugin lifecycle)                                                   │
│  - Registers command "assign-table-block-id" (icon: hash)                    │
│  - Registers command "assign-all-tables-block-id" (icon: list)                │
│  - editor-menu: adds "Table Tools" → "Asignar block-id a esta tabla"         │
│  - Captures contextmenu → TableContextResolver.setContextMenuEvent            │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ├──────────────────────────────────┬─────────────────────────────────┐
          ▼                                  ▼                                 ▼
┌─────────────────────────────┐  ┌─────────────────────────────────┐  ┌──────────────────────────────┐
│  commands/                  │  │  commands/                        │  │  table-context/resolver.ts   │
│  assign-table-block-id.ts   │  │  assign-all-tables-block-id.ts   │  │  (shared with other features) │
│  - assignTableBlockId(...)  │  │  - assignAllTablesBlockId(...)  │  │  - resolveForEditorMenu       │
│  - Resolve context or use   │  │  - No context; scans full note   │  │  - resolveForCommand          │
│    passed context           │  │  - getTableAtLine in a loop      │  └──────────────────────────────┘
│  - getTableAtLine /         │  │  - getNextTableNumberInNote       │
│    findTableBoundsForMatching│  │  - Inserts ^tabla-N from bottom │
│  - getNextTableNumberInNote │  │    to top                         │
│  - editor.replaceRange      │  └─────────────────────────────────┘
└─────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  utils/table-detection.ts                                                    │
│  - getTableAtLine(editor, lineNumber) → TableAtCursor | null                │
│  - findTableBoundsForMatchingRows(editor, rows) → TableAtCursor | null       │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  utils/block-id.ts                                                           │
│  - getNextTableNumberInNote(editor) → number (scans ^tabla-(\d+), returns max+1)│
│  - sanitizeBasenameForBlockId (for potential future use, e.g. filenames)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data flow (end-to-end)

### 3.1 Asignar block-id a esta tabla

1. **User action**
   - **A) Context menu:** User right-clicks on a table. The same flow as Export table to CSV: `setContextMenuEvent` has stored the click; when **editor-menu** fires, the handler resolves context with `resolveForEditorMenu(editor)` and adds the menu item that calls `assignTableBlockId(plugin, resolver, context)` with that context.
   - **B) Command:** User runs **Asignar block-id a esta tabla** from the palette. The command calls `assignTableBlockId(plugin, resolver)` with no context; the function uses `resolver.resolveForCommand(editor)` to get the table at the cursor.

2. **Resolving the table**
   - Same **ResolvedTableContext** as other Table Tools: `{ source, rows, blockId, preferredLine? }`. From context menu: `resolveForEditorMenu`. From command: `resolveForCommand` → `getTableAtCursor(editor)`.

3. **Finding bounds in the editor**
   - If `resolved.preferredLine != null`: `getTableAtLine(editor, resolved.preferredLine)` → `{ startLine, endLine, blockId }`.
   - Else: `findTableBoundsForMatchingRows(editor, resolved.rows)` to find the same table by row content and get `startLine`, `endLine`, `blockId`.

4. **Guards and insert**
   - If no result: notice "No table under click/cursor." and return.
   - If `result.blockId !== null`: notice "This table already has a block-id: ^…" and return.
   - Else: `nextNum = getNextTableNumberInNote(editor)`, `id = "tabla-" + nextNum`, then `editor.replaceRange("\n^" + id, pos)` where `pos` is the end of `result.endLine`. Notice "Block-id assigned: ^…".

### 3.2 Asignar block-id a todas las tablas de esta nota que no tengan

1. **User action**
   - User runs **Asignar block-id a todas las tablas de esta nota que no tengan** from the command palette. No table context is needed.

2. **Scanning the note**
   - Get active `MarkdownView`; if none, notice "Open a note first." and return.
   - Loop over lines: for each line, call `getTableAtLine(editor, line)`. If a table is found, check `result.blockId === null`; if so, push `result.endLine` to `insertAfterLines`. Then advance `line` to `result.endLine + 1`, and if the next line is a block-id line (`^…`), skip it so the next table is not mis-detected.

3. **Inserting block-ids**
   - If `insertAfterLines` is empty: notice "No tables without block-id in this note." and return.
   - `nextNum = getNextTableNumberInNote(editor)`. Sort `insertAfterLines` descending (bottom to top). For each `endLine`, insert `\n^tabla-${nextNum + i}` at the end of that line so that earlier insertions do not shift line numbers for later ones.
   - Notice "Block-id assigned to 1 table." or "Block-id assigned to N tables."

---

## 4. Key types

| Type | Definition | Where |
|------|------------|--------|
| **ResolvedTableContext** | `{ source: "markdown" \| "dom"; rows: string[][]; blockId: string \| null; preferredLine?: number }` | `src/types.ts` |
| **TableAtCursor** | `{ rows: string[][]; blockId: string \| null; startLine: number; endLine: number }` | `src/utils/table-detection.ts` |

Block-id lines are parsed in `table-detection.ts` with `parseBlockIdLine` (regex `^\^([a-zA-Z0-9_-]+)\s*$`). The **assign** feature uses only the `tabla-N` format; `getNextTableNumberInNote` in `block-id.ts` scans for `^\^tabla-(\d+)\s*$`.

---

## 5. Module responsibilities

| Path | Role |
|------|------|
| **src/main.ts** | Registers both commands (with icons hash / list) and the single-table item under Table Tools. Does not implement logic. |
| **src/commands/assign-table-block-id.ts** | Entry for “Asignar block-id a esta tabla”: resolve context, get table bounds, guard existing block-id, call `getNextTableNumberInNote`, insert `\n^tabla-N` after `endLine`. |
| **src/commands/assign-all-tables-block-id.ts** | Entry for “Asignar block-id a todas las tablas…”: scan note with `getTableAtLine`, collect `endLine` for tables without block-id, insert from bottom to top. |
| **src/table-context/resolver.ts** | Shared: `resolveForEditorMenu`, `resolveForCommand` (see export-table-to-csv.md). |
| **src/utils/table-detection.ts** | `getTableAtLine`, `findTableBoundsForMatchingRows`, `parseBlockIdLine`. |
| **src/utils/block-id.ts** | `getNextTableNumberInNote(editor)`: scans document for `^tabla-(\d+)`, returns max + 1. `sanitizeBasenameForBlockId`: reserved for future use. |

---

## 6. Block-id format and placement

- **Format:** `^tabla-N` where N is a positive integer. No spaces between `^` and `tabla-N`. The line may have trailing whitespace; `parseBlockIdLine` trims.
- **Placement:** The block-id line is inserted **immediately after** the last line of the table (i.e. after `endLine`). So the table spans `startLine`…`endLine`; the new line is `endLine + 1`.
- **All-tables order:** Insertions are done from the **bottom** of the document upward so that each `replaceRange` does not change the line numbers of tables above. So we sort `insertAfterLines` descending and insert in that order.

---

## 7. File reference (quick lookup)

| Need to… | See / edit |
|----------|------------|
| Change how commands or menu item are registered | `src/main.ts` |
| Change single-table assign behavior or messages | `src/commands/assign-table-block-id.ts` |
| Change all-tables scan or insert logic | `src/commands/assign-all-tables-block-id.ts` |
| Change how “which table” is resolved (context menu / cursor) | `src/table-context/resolver.ts` |
| Change table parsing or block-id detection in markdown | `src/utils/table-detection.ts` |
| Change next-number logic or block-id naming | `src/utils/block-id.ts` |
| Change shared context type | `src/types.ts` |

---

## 8. Dependencies between modules

- **main** → commands/assign-table-block-id, commands/assign-all-tables-block-id, table-context/resolver, utils/table-detection.
- **commands/assign-table-block-id** → types, table-context/resolver, utils/table-detection, utils/block-id, Obsidian MarkdownView/Notice/Plugin.
- **commands/assign-all-tables-block-id** → utils/table-detection, utils/block-id, Obsidian MarkdownView/Notice/Plugin.
- **utils/block-id** → Obsidian Editor only.

No circular dependencies.
