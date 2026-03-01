import { MarkdownView, Notice } from "obsidian";
import type { ResolvedTableContext } from "../types";
import type { CsvExportPlugin } from "../ui/csv-export-modal";
import { openCsvExportForContext } from "../table-actions/export-csv";
import { TableContextResolver } from "../table-context/resolver";

export function exportTableToCsv(
	plugin: CsvExportPlugin,
	resolver: TableContextResolver,
	context?: ResolvedTableContext
): void {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return;

	const resolved = context ?? resolver.resolveForCommand(view.editor);
	if (!resolved) {
		new Notice("No table under click/cursor.");
		return;
	}

	openCsvExportForContext(plugin, resolved, view.file ?? null);
}
