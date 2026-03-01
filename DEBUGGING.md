# Debugging Emic Table Tools

The plugin no longer ships with built-in debug logging.

To debug (e.g. block ID or context menu behaviour), add temporary `console.log(...)` in:

- **`src/table-context/resolver.ts`** – `resolveForEditorMenu` (position→line, markdown vs DOM path, blockId).
- **`src/utils/table-detection.ts`** – `getBlockIdForMatchingTable` / `findBlockIdForMatchingTableInDocument` (e.g. when first row doesn’t match).

Then run `npm run build`, copy `main.js` into your vault’s plugin folder, reload Obsidian, and open DevTools (**Ctrl+Shift+I** / **Cmd+Option+I**) → Console tab.
