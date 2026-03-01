import { MarkdownView, Notice, type Plugin } from "obsidian";
import type { ResolvedTableContext } from "../types";
import { TableContextResolver } from "../table-context/resolver";
import { getTableAtLine, findTableBoundsForMatchingRows } from "../utils/table-detection";
import { getNextTableNumberInNote } from "../utils/block-id";

export function assignTableBlockId(
	plugin: Plugin,
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

	const editor = view.editor;

	let result: { startLine: number; endLine: number; blockId: string | null } | null;
	if (resolved.preferredLine != null) {
		result = getTableAtLine(editor, resolved.preferredLine);
	} else {
		result = findTableBoundsForMatchingRows(editor, resolved.rows);
	}

	if (!result) {
		new Notice("No table under click/cursor.");
		return;
	}

	if (result.blockId !== null) {
		new Notice(`This table already has a block-id: ^${result.blockId}`);
		return;
	}

	const nextNum = getNextTableNumberInNote(editor);
	const id = `tabla-${nextNum}`;

	const endLine = result.endLine;
	const pos = { line: endLine, ch: editor.getLine(endLine).length };
	editor.replaceRange("\n^" + id, pos);

	new Notice(`Block-id assigned: ^${id}`);
}
