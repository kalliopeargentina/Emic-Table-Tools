import type { TFile } from "obsidian";
import { Notice } from "obsidian";
import type { CsvExportPlugin } from "../ui/csv-export-modal";
import type { ResolvedTableContext } from "../types";
import { CsvExportModal } from "../ui/csv-export-modal";

export function openCsvExportForContext(
	plugin: CsvExportPlugin,
	context: ResolvedTableContext,
	sourceFile: TFile | null
): void {
	if (!context.rows.length) {
		new Notice("Table has no rows.");
		return;
	}
	new CsvExportModal(plugin.app, context.rows, plugin, sourceFile, context.blockId).open();
}
