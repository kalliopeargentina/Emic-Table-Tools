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

/** Number of lines to look ahead after a table for a block ID (^xxx). */
const BLOCK_ID_LOOKAHEAD_LINES = 5;

/** Radius (lines) around the given line when searching for a matching table by row content. */
const MATCHING_TABLE_SEARCH_RADIUS = 25;

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
	let blockId: string | null = null;
	// Block ID can be on the line immediately after the table or after blank lines
	for (let i = 0; i < BLOCK_ID_LOOKAHEAD_LINES && nextLineIndex + i < editor.lineCount(); i++) {
		const candidate = parseBlockIdLine(editor.getLine(nextLineIndex + i));
		if (candidate) {
			blockId = candidate;
			break;
		}
		const line = editor.getLine(nextLineIndex + i);
		if (line.trim() !== "") break; // Stop at first non-empty line that isn't a block ID
	}

	if (rows.length === 0) return null;
	return { rows, blockId };
}

/**
 * Find a table in the editor that matches the given rows (same row count and first row)
 * and return its blockId if any. Searches around the given line to avoid scanning the whole file.
 */
export function getBlockIdForMatchingTable(
	editor: Editor,
	rows: string[][],
	aroundLine: number
): string | null {
	if (!rows.length) return null;
	const lineCount = editor.lineCount();
	const start = Math.max(0, aroundLine - MATCHING_TABLE_SEARCH_RADIUS);
	const end = Math.min(lineCount - 1, aroundLine + MATCHING_TABLE_SEARCH_RADIUS);
	for (let line = start; line <= end; line++) {
		const result = getTableAtLine(editor, line);
		if (!result) continue;
		if (result.rows.length !== rows.length) continue;
		const r0 = result.rows[0];
		const d0 = rows[0];
		if (!r0 || !d0 || r0.length !== d0.length) continue;
		const firstRowMatch = r0.every((cell, i) => cell === d0[i]);
		if (!firstRowMatch) continue;
		return result.blockId ?? null;
	}
	return null;
}

/**
 * Scan the document from the start to find a table whose rows match the given rows;
 * returns its blockId if found. Used when context-menu position doesn't give a reliable line.
 */
export function findBlockIdForMatchingTableInDocument(
	editor: Editor,
	rows: string[][]
): string | null {
	if (!rows.length) return null;
	const lineCount = editor.lineCount();
	for (let line = 0; line < lineCount; line++) {
		const result = getTableAtLine(editor, line);
		if (!result) continue;
		if (result.rows.length !== rows.length) continue;
		const r0 = result.rows[0];
		const d0 = rows[0];
		if (!r0 || !d0 || r0.length !== d0.length) continue;
		const firstRowMatch = r0.every((cell, i) => cell === d0[i]);
		if (!firstRowMatch) continue;
		return result.blockId ?? null;
	}
	return null;
}

/**
 * Get table under the current cursor line.
 */
export function getTableAtCursor(editor: Editor): TableAtCursor | null {
	return getTableAtLine(editor, editor.getCursor().line);
}
