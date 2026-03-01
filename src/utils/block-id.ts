import type { Editor } from "obsidian";

/** Block ID allowed chars (must match table-detection parseBlockIdLine). */
const BLOCK_ID_CHARS = /[a-zA-Z0-9_-]/;

/**
 * Normalize file basename for use in block IDs: only [a-zA-Z0-9_-].
 * Replaces invalid chars with '-', collapses multiple dashes, trims.
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
			// Accents and other chars: skip or replace with -
			if (out.length > 0 && out[out.length - 1] !== "-") out += "-";
		}
	}
	out = out.replace(/-+/g, "-").replace(/^-|-$/g, "");
	return out || "note";
}

/** Escape string for use inside a RegExp character-safe (literal match). */
function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scan the editor for block-id lines matching ^{sanitizedBasename}-tabla-(\d+)$
 * and return the next number to use (max + 1, or 1 if none).
 */
export function getNextTableNumberInNote(
	editor: Editor,
	sanitizedBasename: string
): number {
	const prefix = sanitizedBasename + "-tabla-";
	const escaped = escapeRegex(prefix);
	const re = new RegExp("^\\^(" + escaped + ")(\\d+)\\s*$");
	let max = 0;
	const lineCount = editor.lineCount();
	for (let i = 0; i < lineCount; i++) {
		const line = editor.getLine(i);
		const m = line.trim().match(re);
		if (m) {
			const n = parseInt(m[2] ?? "0", 10);
			if (!Number.isNaN(n) && n > max) max = n;
		}
	}
	return max + 1;
}
