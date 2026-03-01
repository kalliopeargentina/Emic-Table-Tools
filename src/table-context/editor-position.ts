import type { Editor } from "obsidian";

export function mapTargetToLine(editor: Editor, target: EventTarget | null): number | undefined {
	if (!(target instanceof Node)) return undefined;
	const cmAny = (editor as unknown as { cm?: any }).cm;
	const cm6 = cmAny?.cm ?? cmAny;
	if (!cm6 || typeof cm6.posAtDOM !== "function") return undefined;
	if (!cm6.dom || typeof cm6.dom.contains !== "function") return undefined;
	if (!cm6.dom.contains(target)) return undefined;
	try {
		const offset = cm6.posAtDOM(target, 0);
		if (typeof offset !== "number") return undefined;
		const line = cm6.state?.doc?.lineAt?.(offset)?.number;
		return typeof line === "number" ? line - 1 : undefined;
	} catch {
		return undefined;
	}
}

export function mapLineElementAtPointToLine(editor: Editor, x: number, y: number): number | undefined {
	const cmAny = (editor as unknown as { cm?: any }).cm;
	const cm6 = cmAny?.cm ?? cmAny;
	if (!cm6 || typeof cm6.posAtDOM !== "function" || !cm6.dom?.contains) return undefined;
	const els =
		typeof document.elementsFromPoint === "function"
			? document.elementsFromPoint(x, y)
			: [];
	const lineEl = els.find((el) => el.classList.contains("cm-line") && cm6.dom.contains(el));
	if (!lineEl) return undefined;
	try {
		const offset = cm6.posAtDOM(lineEl, 0);
		if (typeof offset !== "number") return undefined;
		const line = cm6.state?.doc?.lineAt?.(offset)?.number;
		return typeof line === "number" ? line - 1 : undefined;
	} catch {
		return undefined;
	}
}

export function mapCoordsToLine(editor: Editor, x: number, y: number): number | undefined {
	try {
		const cmAny = (editor as unknown as { cm?: any }).cm;

		// CM6 path (preferred)
		const cm6 = cmAny?.cm ?? cmAny;
		if (cm6 && typeof cm6.posAtCoords === "function") {
			const preciseOffset = cm6.posAtCoords({ x, y }, true);
			const offset = typeof preciseOffset === "number" ? preciseOffset : cm6.posAtCoords({ x, y });
			if (typeof offset === "number") {
				const line = cm6.state?.doc?.lineAt?.(offset)?.number;
				return typeof line === "number" ? line - 1 : undefined;
			}
		}

		// CM5 fallback path (for editor wrappers exposing coordsChar)
		if (cmAny && typeof cmAny.coordsChar === "function") {
			const pos = cmAny.coordsChar({ left: x, top: y });
			const line = pos?.line;
			return typeof line === "number" ? line : undefined;
		}

		return undefined;
	} catch {
		return undefined;
	}
}

/** Pixel offsets used to probe around (x,y) when mapping coords to line numbers. */
const COORD_PROBE_OFFSETS: Array<[number, number]> = [
	[0, 0],
	[12, 0],
	[24, 0],
	[-12, 0],
	[0, 8],
	[0, -8],
	[12, 8],
	[12, -8],
	[24, 8],
	[24, -8],
];

export function probeCoordLines(editor: Editor, x: number, y: number): number[] {
	const lines: number[] = [];
	for (const [dx, dy] of COORD_PROBE_OFFSETS) {
		const line = mapCoordsToLine(editor, x + dx, y + dy);
		if (typeof line === "number" && !lines.includes(line)) {
			lines.push(line);
		}
	}
	return lines;
}
