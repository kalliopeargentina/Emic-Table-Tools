import { MarkdownView, Notice, type Plugin } from "obsidian";
import { getTableAtLine } from "../utils/table-detection";
import { getNextTableNumberInNote } from "../utils/block-id";

/**
 * Assign block-ids to all tables in the active note that don't have one.
 * Uses format ^tabla-1, ^tabla-2, ... Inserts from bottom to top so line numbers stay valid.
 */
export function assignAllTablesBlockId(plugin: Plugin): void {
	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) {
		new Notice("Open a note first.");
		return;
	}

	const editor = view.editor;

	const lineCount = editor.lineCount();
	const insertAfterLines: number[] = [];
	let line = 0;

	while (line < lineCount) {
		const result = getTableAtLine(editor, line);
		if (!result) {
			line++;
			continue;
		}
		if (result.blockId === null) {
			insertAfterLines.push(result.endLine);
		}
		line = result.endLine + 1;
		// If the next line is a block-id, skip it so we don't treat it as table start
		if (line < lineCount && /^\^[a-zA-Z0-9_-]+\s*$/.test(editor.getLine(line).trim())) {
			line++;
		}
	}

	if (insertAfterLines.length === 0) {
		new Notice("No tables without block-id in this note.");
		return;
	}

	const nextNum = getNextTableNumberInNote(editor);
	// Insert from bottom to top to keep line numbers valid
	insertAfterLines.sort((a, b) => b - a);
	for (let i = 0; i < insertAfterLines.length; i++) {
		const endLine = insertAfterLines[i] as number;
		const id = `tabla-${nextNum + i}`;
		const pos = { line: endLine, ch: editor.getLine(endLine).length };
		editor.replaceRange("\n^" + id, pos);
	}

	const count = insertAfterLines.length;
	new Notice(
		count === 1
			? "Block-id assigned to 1 table."
			: `Block-id assigned to ${count} tables.`
	);
}
