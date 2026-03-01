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
	const cells = parseRowLine(line);
	if (cells.length === 0) return false;
	// Single cell like |a| or |a| is valid
	return cells.some((c) => c.length > 0) || cells.length >= 2;
}

/** True if cursor is in a table data/header row (not on a separator line). */
export function cursorIsInTable(editor: Editor): boolean {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	const cells = parseRowLine(line);
	if (cells.length === 0) return false;
	if (isSeparatorLine(cells)) return true; // still "in table"
	return isTableRow(line);
}

/**
 * Get the full table at the cursor as rows of cell strings (header + data; separator excluded).
 * Returns null if cursor is not inside a table.
 */
export function getTableAtCursor(editor: Editor): string[][] | null {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	const cells = parseRowLine(line);
	if (cells.length === 0 || !isTableRow(line)) return null;

	const lineCount = editor.lineCount();
	const rows: string[][] = [];

	// Scan upward to find table start
	let startLine = cursor.line;
	while (startLine > 0) {
		const prevLine = editor.getLine(startLine - 1);
		const prevCells = parseRowLine(prevLine);
		if (prevCells.length === 0 || !isTableRow(prevLine)) break;
		startLine--;
	}

	// Scan downward to find table end and collect all table lines
	let endLine = cursor.line;
	while (endLine < lineCount - 1) {
		const nextLine = editor.getLine(endLine + 1);
		const nextCells = parseRowLine(nextLine);
		if (nextCells.length === 0 || !isTableRow(nextLine)) break;
		endLine++;
	}

	for (let i = startLine; i <= endLine; i++) {
		const rowLine = editor.getLine(i);
		const rowCells = parseRowLine(rowLine);
		if (rowCells.length === 0) continue;
		if (isSeparatorLine(rowCells)) continue; // skip separator
		rows.push(rowCells);
	}

	if (rows.length === 0) return null;
	return rows;
}
