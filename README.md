# Emic Table Tools

Obsidian plugin that implements features to handle tabular data in markdown: import and export, and data management.

## Features

Currently implemented:

1. **Export table to CSV** – Export a markdown (GFM) table to a CSV file. Available from the editor context menu (right-click on a table → **Table Tools → Export table to CSV**) or via the command palette when the cursor is inside a table. Uses the table’s block ID (e.g. `^table-1`) in the filename when present; supports a configurable default export folder in settings.

*(More import/export and data-management features may be added later.)*

## How to use

- Make sure Node.js is at least v16 (`node --version`).
- `npm install` in the project folder.
- `npm run dev` for watch mode, or `npm run build` for a production build.

## Manually installing the plugin

Copy `main.js`, `manifest.json`, and `styles.css` (if present) into your vault:

`<Vault>/.obsidian/plugins/Emic-Table-Tools/`

Then enable the plugin under **Settings → Community plugins**.

## First time developing plugins?

- Check if [someone already made a plugin](https://obsidian.md/plugins) for what you need.
- Clone this repo, run `npm install`, then `npm run dev`.
- Edit `src/*.ts`; changes compile to `main.js`. Reload Obsidian to test.
- See the [Obsidian plugin API](https://docs.obsidian.md) and [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).

## Releasing

- Bump `version` in `manifest.json` and update `versions.json`.
- Create a GitHub release with the same tag as the version (no `v` prefix).
- Attach `main.js`, `manifest.json`, and `styles.css` to the release.

## API Documentation

See https://docs.obsidian.md
