# Transponer Tabla — Architecture and implementation

This document describes how the **Transponer Tabla** (transpose table) feature is implemented: swapping rows and columns of a GFM table while preserving its block-id and producing a correctly formatted table. It is intended for both humans and automated agents working on the codebase.

---

## 1. Feature overview

**What it does:** The user can transpose the table under the cursor or under the right-click: rows become columns and columns become rows. The result is valid GFM markdown with aligned columns. If the table had a block-id (e.g. `^tabla-1`) on the line after it, that line is left unchanged so the block-id is preserved.

**Entry points:**

- **Context menu:** Right-click on a table in the editor → **Table Tools** → **Transponer Tabla**. The table is determined by the click position (same resolution as Export table to CSV and Assign block-id).
- **Command palette:** Run **Transponer Tabla** while the cursor is inside a table. The table is determined by the cursor line.

**Outcome:** The table lines (from first row to last row, including the GFM separator row in the source) are replaced in place by the transposed table. The block-id line, if present, is **not** part of the replaced range and therefore remains intact below the new table. A notice "Tabla transpuesta." is shown.

**Icon:** The command and menu item use a custom icon registered as `"transpose"` (from Advanced Tables for Obsidian, GPL-3.0), with viewBox `0 0 100 100` for Obsidian/mobile toolbar compatibility. See `src/icons.ts`.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  main.ts (Plugin lifecycle)                                                   │
│  - Registers command "transpose-table" (icon: transpose)                     │
│  - editor-menu: adds "Table Tools" → "Transponer Tabla"                     │
│  - addTransposeIcon() so "transpose" icon is available globally (e.g. mobile)│
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  commands/transpose-table.ts                                                 │
│  - transposeTable(plugin, resolver, context?)                                │
│  - Resolve context (from argument or resolver.resolveForCommand)             │
│  - Get table bounds: getTableAtLine / findTableBoundsForMatchingRows         │
│  - transposeMatrix(result.rows) → string[][]                                 │
│  - rowsToGFMTable(transposed) → markdown string                             │
│  - editor.replaceRange(newTableText, from, to)  (from startLine to endLine)  │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ├── table-context/resolver.ts (same as other Table Tools)
          ├── utils/table-detection.ts (getTableAtLine, findTableBoundsForMatchingRows)
          └── icons.ts (addTransposeIcon → addIcon("transpose", svg))
```

---

## 3. Data flow (end-to-end)

1. **User action**
   - **A) Context menu:** Same as Export table to CSV: context from `resolveForEditorMenu(editor)` with stored context-menu event; menu item calls `transposeTable(plugin, resolver, context)`.
   - **B) Command:** User runs **Transponer Tabla** from the palette; command calls `transposeTable(plugin, resolver)`; function uses `resolver.resolveForCommand(editor)` to get the table at the cursor.

2. **Resolving the table**
   - **ResolvedTableContext** = `{ source, rows, blockId, preferredLine? }`. The `rows` are header + data only (GFM separator row is excluded by `getTableAtLine` / table-detection).

3. **Finding bounds**
   - If `resolved.preferredLine != null`: `getTableAtLine(editor, resolved.preferredLine)` → `{ startLine, endLine, rows, blockId }`.
   - Else: `findTableBoundsForMatchingRows(editor, resolved.rows)` → same shape. If no result, notice "No table under click/cursor." and return.

4. **Guards**
   - If `result.rows.length === 0`: notice "Table has no rows." and return.
   - `transposed = transposeMatrix(result.rows)`. If `transposed.length === 0`: notice "Table has no columns." and return.

5. **Transpose and format**
   - **transposeMatrix(rows):** For each column index `j` in `0..maxCols-1` (maxCols = max row length), build a new row as `rows.map(row => row[j] ?? "")`. Missing cells become `""`. Result: `string[][]` with dimensions swapped.
   - **rowsToGFMTable(rows):** Compute per-column width = max cell length in that column (min 1). Build: (1) header line: `| cell1 | cell2 | … |` with padded cells; (2) separator line: `| --- | --- | … |` with each column at least `---` and padded to column width; (3) body lines same as header. Join with `\n`.

6. **Replace**
   - `from = { line: result.startLine, ch: 0 }`, `to = { line: result.endLine, ch: editor.getLine(result.endLine).length }`. So only the table lines are replaced; any line after `endLine` (e.g. `^tabla-1`) is untouched.
   - `editor.replaceRange(newTableText, from, to)`.
   - Notice "Tabla transpuesta."

---

## 4. Key types

| Type | Definition | Where |
|------|------------|--------|
| **ResolvedTableContext** | `{ source: "markdown" \| "dom"; rows: string[][]; blockId: string \| null; preferredLine?: number }` | `src/types.ts` |
| **TableAtCursor** | `{ rows: string[][]; blockId: string \| null; startLine: number; endLine: number }` | `src/utils/table-detection.ts` |

**Rows:** In both table-detection and transpose, `rows` are **header + data only**; the GFM separator row (`|---|---|`) is skipped when reading the table, so the transpose operates on a clean matrix of cell contents.

---

## 5. Module responsibilities

| Path | Role |
|------|------|
| **src/main.ts** | Registers command "transpose-table" with icon "transpose", calls `addTransposeIcon()`, adds "Transponer Tabla" to Table Tools submenu. |
| **src/commands/transpose-table.ts** | `transposeTable(plugin, resolver, context?)`: resolve context, get bounds, transpose matrix, build GFM string, replace range. Contains private `transposeMatrix(rows)` and `rowsToGFMTable(rows)`. |
| **src/icons.ts** | `addTransposeIcon()`: registers custom SVG under id "transpose" with viewBox 0 0 100 100 (for mobile toolbar). |
| **src/table-context/resolver.ts** | Shared: context resolution for context menu and command (see export-table-to-csv.md). |
| **src/utils/table-detection.ts** | `getTableAtLine`, `findTableBoundsForMatchingRows` (and parsing helpers). |

---

## 6. Transpose and GFM details

- **Irregular tables:** If some rows have fewer cells, `transposeMatrix` uses `row[j] ?? ""` so the transposed table has rectangular shape; column count = max of all row lengths.
- **Empty tables:** Guarded by "Table has no rows." / "Table has no columns." so we never replace with empty content.
- **Block-id preservation:** The replacement range is strictly `startLine` through `endLine`. The block-id lives on line `endLine + 1` (or later, after blank lines) and is never included in the replacement text, so it stays in the document unchanged.
- **GFM output:** Separator uses `---` per column (padded to column width with `-`). No alignment markers (`:---`) are generated; the result is valid GFM and readable.

---

## 7. File reference (quick lookup)

| Need to… | See / edit |
|----------|------------|
| Change how the command or menu item is registered | `src/main.ts` |
| Change transpose logic, formatting, or replace range | `src/commands/transpose-table.ts` |
| Change the transpose icon (e.g. for mobile) | `src/icons.ts` |
| Change how “which table” is resolved | `src/table-context/resolver.ts` |
| Change table parsing or bounds detection | `src/utils/table-detection.ts` |
| Change shared context type | `src/types.ts` |

---

## 8. Dependencies between modules

- **main** → commands/transpose-table, icons, table-context/resolver, utils/table-detection.
- **commands/transpose-table** → types, table-context/resolver, utils/table-detection, Obsidian MarkdownView/Notice/Plugin.
- **icons** → Obsidian addIcon only.

No circular dependencies.
