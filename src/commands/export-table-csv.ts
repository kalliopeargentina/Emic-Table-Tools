import { MarkdownView, Notice } from "obsidian";
import { CsvExportModal, type CsvExportPlugin } from "../ui/csv-export-modal";
import { getTableAtCursor, getTableAtLine } from "../utils/table-detection";

export function exportTableToCsv(plugin: CsvExportPlugin, preferredLine?: number): void {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return;
	const editor = view.editor;

	const lineResult =
		typeof preferredLine === "number" ? getTableAtLine(editor, preferredLine) : null;
	const result = lineResult ?? getTableAtCursor(editor);
	if (result === null) {
		new Notice("No table under click/cursor.");
		return;
	}
	new CsvExportModal(plugin.app, result.rows, plugin, view.file ?? null, result.blockId).open();
}

export function exportRowsToCsv(plugin: CsvExportPlugin, rows: string[][]): void {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return;
	if (!rows.length) {
		new Notice("No table under click/cursor.");
		return;
	}
	new CsvExportModal(plugin.app, rows, plugin, view.file ?? null, null).open();
}
