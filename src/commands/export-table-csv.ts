import { MarkdownView, Notice } from "obsidian";
import { CsvExportModal, type CsvExportPlugin } from "../ui/csv-export-modal";
import { getTableAtCursor } from "../utils/table-detection";

export function exportTableToCsv(plugin: CsvExportPlugin): void {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return;
	const editor = view.editor;
	const rows = getTableAtCursor(editor);
	if (rows === null) {
		new Notice("Cursor is not in a table.");
		return;
	}
	new CsvExportModal(plugin.app, rows, plugin, view.file ?? null).open();
}
