/** Check if a line is a GFM table separator (only -, :, spaces). */
function isSeparatorLine(cells: string[]): boolean {
	return cells.every((cell) => /^[\s\-:]*$/.test(cell));
}

export function extractRowsFromTableTarget(target: Element | null): string[][] | null {
	if (!(target instanceof Element)) return null;
	const table = target.closest("table");
	if (!table) return null;

	const rows: string[][] = [];
	const rowEls = Array.from(table.querySelectorAll("tr"));
	for (const rowEl of rowEls) {
		const cellEls = Array.from(rowEl.querySelectorAll("th,td"));
		if (!cellEls.length) continue;
		const cells = cellEls.map((cell) => (cell.textContent ?? "").trim());
		// Skip separator row so DOM row count matches getTableAtLine (header + data only).
		if (isSeparatorLine(cells)) continue;
		rows.push(cells);
	}

	return rows.length ? rows : null;
}
