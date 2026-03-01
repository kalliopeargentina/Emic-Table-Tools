import type { Editor } from "obsidian";

/** Block ID allowed chars (must match table-detection parseBlockIdLine). */
const BLOCK_ID_CHARS = /[a-zA-Z0-9_-]/;

/**
 * Normalize file basename for use in block IDs: only [a-zA-Z0-9_-].
 * Replaces invalid chars with '-', collapses multiple dashes, trims.
 * Kept for potential future use (e.g. CSV export filename).
 */
export function sanitizeBasenameForBlockId(basename: string): string {
	if (!basename) return "note";
	let out = "";
	for (let i = 0; i < basename.length; i++) {
		const c = basename.charAt(i);
		if (BLOCK_ID_CHARS.test(c)) {
			out += c;
		} else if (c === " " || c === "." || c === "\t") {
			if (out.length > 0 && out[out.length - 1] !== "-") out += "-";
		} else {
			if (out.length > 0 && out[out.length - 1] !== "-") out += "-";
		}
	}
	out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
	return out || "note";
}

/**
 * Scan the editor for block-id lines matching ^tabla-(\d+)$
 * and return the next number to use (max + 1, or 1 if none).
 */
export function getNextTableNumberInNote(editor: Editor): number {
	const re = /^\^tabla-(\d+)\s*$/;
	let max = 0;
	const lineCount = editor.lineCount();
	for (let i = 0; i < lineCount; i++) {
		const line = editor.getLine(i);
		const m = line.trim().match(re);
		if (m) {
			const n = parseInt(m[1] ?? "0", 10);
			if (!Number.isNaN(n) && n > max) max = n;
		}
	}
	return max + 1;
}
