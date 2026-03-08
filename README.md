# Emic Table Tools

Obsidian plugin that implements features to handle tabular data in markdown: import and export, and data management.

## Features

Currently implemented:

1. **Export table to CSV** – Export a markdown (GFM) table to a CSV file. Available from the editor context menu (right-click on a table → **Table Tools → Export table to CSV**) or via the command palette when the cursor is inside a table. Uses the table’s block ID (e.g. `^table-1`) in the filename when present; supports a configurable default export folder in settings.

2. **Block-id in tables** – Assign Obsidian block IDs to tables so you can link to them (e.g. `^nombre-nota-tabla-1`).
   - **Asignar block-id a esta tabla** – Adds a block-id to the table under the cursor or under the right-click. Available from **Table Tools** and the command palette when the cursor is in a table.
   - **Asignar block-id a todas las tablas de esta nota que no tengan** – Assigns block-ids to every table in the current note that doesn’t already have one. Available from the command palette only.

3. **Transponer Tabla** – Transpose the table (swap rows and columns). Available from **Table Tools** (right-click on a table) or the command palette when the cursor is in a table. Keeps the table’s block-id if it has one and outputs a correctly formatted GFM table.

4. **CSV view** – Open and edit `.csv` files directly in Obsidian. When you open a CSV file, it is shown as an editable table: search, pin columns, change delimiter (re-parse only), edit cells, undo/redo, and switch to source (raw text) view. You can create new CSV files from the command palette (**Create new CSV file**) or from the file explorer context menu. After exporting a table to CSV, you can optionally open the new file in this view (setting **Open CSV after export**).

*(More import/export and data-management features may be added later.)*

## Credits

- The icon for **Transponer Tabla** is based on the transpose icon from [Advanced Tables for Obsidian](https://github.com/tgrosinger/advanced-tables-obsidian) (GPL-3.0).
- The CSV view and related functionality are ported from [csv-lite](https://github.com/LIUBINfighter/csv-lite) by LIUBINfighter (MIT).

