import { MarkdownView, Notice, type Plugin } from "obsidian";
import type { ResolvedTableContext } from "../types";
import { TableContextResolver } from "../table-context/resolver";
import {
	getTableAtLine,
	findTableBoundsForMatchingRows,
} from "../utils/table-detection";

/**
 * Transpose a matrix (rows become columns). Missing cells filled with "".
 */
function transposeMatrix(rows: string[][]): string[][] {
	if (rows.length === 0) return [];
	const maxCols = Math.max(0, ...rows.map((r) => r.length));
	if (maxCols === 0) return [];
	const transposed: string[][] = [];
	for (let j = 0; j < maxCols; j++) {
		transposed.push(rows.map((row) => row[j] ?? ""));
	}
	return transposed;
}

/**
 * Build GFM table markdown from rows (header + body), with aligned columns.
 */
function rowsToGFMTable(rows: string[][]): string {
	if (rows.length === 0) return "";
	const colCount = Math.max(0, ...rows.map((r) => r.length));
	if (colCount === 0) return "";
	const widths: number[] = [];
	for (let j = 0; j < colCount; j++) {
		widths[j] = Math.max(
			1,
			...rows.map((r) => (r[j] ?? "").length)
		);
	}
	const pad = (cell: string, w: number) => cell.padEnd(w);
	const line = (cells: string[]) =>
		"| " +
		cells.map((c, j) => pad(c, widths[j] ?? 1)).join(" | ") +
		" |";
	const separator =
		"| " +
		widths.map((w) => "---".padEnd(Math.max(3, w), "-")).join(" | ") +
		" |";
	const firstRow = rows[0];
	const header = line(
		(firstRow ?? []).slice(0, colCount).map((c) => c ?? "")
	);
	const body = rows.slice(1).map((row) =>
		line(
			Array.from({ length: colCount }, (_, j) => row[j] ?? "")
		)
	);
	return [header, separator, ...body].join("\n");
}

export function transposeTable(
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

	let result: {
		startLine: number;
		endLine: number;
		rows: string[][];
		blockId: string | null;
	} | null;
	if (resolved.preferredLine != null) {
		result = getTableAtLine(editor, resolved.preferredLine);
	} else {
		result = findTableBoundsForMatchingRows(editor, resolved.rows);
	}

	if (!result) {
		new Notice("No table under click/cursor.");
		return;
	}

	if (result.rows.length === 0) {
		new Notice("Table has no rows.");
		return;
	}

	const transposed = transposeMatrix(result.rows);
	if (transposed.length === 0) {
		new Notice("Table has no columns.");
		return;
	}

	const newTableText = rowsToGFMTable(transposed);
	const from = { line: result.startLine, ch: 0 };
	const to = {
		line: result.endLine,
		ch: editor.getLine(result.endLine).length,
	};
	editor.replaceRange(newTableText, from, to);

	new Notice("Tabla transpuesta.");
}
