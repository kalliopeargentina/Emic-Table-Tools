# Emic Table Tools — Documentation

This folder contains architecture and implementation documentation for the plugin. It is intended for both humans and automated agents (e.g. code assistants, review tools) that need to understand or modify the codebase.

## Contents

| Document | Description |
|----------|-------------|
| [export-table-to-csv.md](export-table-to-csv.md) | **Export table to CSV**: architecture, data flow, types, module responsibilities, table context resolution, CSV format, settings, and file reference. |

## Conventions

- **Paths** are given relative to the repository root (e.g. `src/main.ts`).
- **Types** and **public APIs** are named and, where useful, linked to the file that defines them.
- **Data flow** is described from user action to outcome (e.g. right-click → context resolution → modal → save).
- **Quick lookup** sections (e.g. “File reference”) help locate where to change a specific behavior.

## Related

- [AGENTS.md](../AGENTS.md) — Project and plugin guidelines (structure, manifest, security, conventions).
- [README.md](../README.md) — User-facing project overview and features.
- [DEBUGGING.md](../DEBUGGING.md) — How to add temporary logging for troubleshooting.
