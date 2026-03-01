import type { Editor } from "obsidian";

/** Check if a line is a GFM table separator (only -, :, spaces). */
function isSeparatorLine(cells: string[]): boolean {
	return cells.every((cell) => /^[\s\-:]*$/.test(cell));
}

/** Parse a single line into table cells (split by |, trim, drop empty from edges). */
function parseRowLine(line: string): string[] {
	const trimmed = line.trim();
	if (!trimmed) return [];
	const parts = trimmed.split("|").map((s) => s.trim());
	// Remove leading/trailing empty from optional leading/trailing |
	const start = parts[0] === "" ? 1 : 0;
	const end = parts[parts.length - 1] === "" ? parts.length - 1 : parts.length;
	return parts.slice(start, end);
}

/** Check if the line looks like a table row (has | and at least two cells or one with content). */
function isTableRow(line: string): boolean {
	if (!line.includes("|")) return false;
	const cells = parseRowLine(line);
	if (cells.length === 0) return false;
	// Single cell like |a| or |a| is valid
	return cells.some((c) => c.length > 0) || cells.length >= 2;
}

/** Match Obsidian block ID on its own line: ^block-id */
function parseBlockIdLine(line: string): string | null {
	const m = line.trim().match(/^\^([a-zA-Z0-9_-]+)\s*$/);
	return m ? (m[1] ?? null) : null;
}

/** True if cursor is in a table block (on a table row or on the block ID line immediately after the table). */
export function cursorIsInTable(editor: Editor): boolean {
	return getTableAtCursor(editor) !== null;
}

/**
 * Result of getTableAtCursor: rows (header + data, separator excluded) and optional block ID from the line following the table.
 */
export interface TableAtCursor {
	rows: string[][];
	blockId: string | null;
}

/**
 * Get the full table at a line as rows of cell strings (header + data; separator excluded).
 * If the line immediately after the table is a block ID (^xxx), it is returned as blockId and is not included in rows.
 * Returns null if line is not inside a table block.
 */
export function getTableAtLine(editor: Editor, lineNumber: number): TableAtCursor | null {
	if (lineNumber < 0 || lineNumber >= editor.lineCount()) return null;
	const line = editor.getLine(lineNumber);

	let startLine: number;
	let endLine: number;

	if (isTableRow(line)) {
		startLine = lineNumber;
		endLine = lineNumber;
	} else if (lineNumber > 0 && parseBlockIdLine(line)) {
		// Cursor on block ID line: table is above
		endLine = lineNumber - 1;
		startLine = endLine;
	} else {
		return null;
	}

	const lineCount = editor.lineCount();
	const rows: string[][] = [];

	// Scan upward to find table start
	while (startLine > 0) {
		const prevLine = editor.getLine(startLine - 1);
		if (!isTableRow(prevLine)) break;
		startLine--;
	}

	// Scan downward to find table end
	while (endLine < lineCount - 1) {
		const nextLine = editor.getLine(endLine + 1);
		if (!isTableRow(nextLine)) break;
		endLine++;
	}

	for (let i = startLine; i <= endLine; i++) {
		const rowLine = editor.getLine(i);
		const rowCells = parseRowLine(rowLine);
		if (rowCells.length === 0) continue;
		if (isSeparatorLine(rowCells)) continue; // skip separator
		rows.push(rowCells);
	}

	const nextLineIndex = endLine + 1;
	const blockId =
		nextLineIndex < editor.lineCount()
			? parseBlockIdLine(editor.getLine(nextLineIndex))
			: null;

	if (rows.length === 0) return null;
	return { rows, blockId };
}

/**
 * Get table under the current cursor line.
 */
export function getTableAtCursor(editor: Editor): TableAtCursor | null {
	return getTableAtLine(editor, editor.getCursor().line);
}
