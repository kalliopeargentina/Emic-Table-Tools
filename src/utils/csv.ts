/**
 * Convert rows to RFC 4180-style CSV string.
 * Fields containing comma, quote, or newline are wrapped in " and internal " escaped as "".
 * Rows joined with \r\n.
 */
export function rowsToCsv(rows: string[][], includeHeader: boolean): string {
	let data = rows;
	if (!includeHeader && rows.length > 0) {
		data = rows.slice(1);
	}
	if (data.length === 0) return "";

	function escape(field: string): string {
		const s = String(field);
		if (/[,"\r\n]/.test(s)) {
			return '"' + s.replace(/"/g, '""') + '"';
		}
		return s;
	}

	return data.map((row) => row.map(escape).join(",")).join("\r\n");
}

/**
 * Convert a 2D array of cells to a GFM (GitHub Flavored Markdown) table string.
 * Escapes pipe characters in cell content so they don't break the table.
 * @param firstRowAsHeader - If true (default), first row is the header line above the separator. If false, an empty header row is added and all rows are data.
 */
export function csvRowsToMarkdownTable(
	rows: string[][],
	firstRowAsHeader: boolean = true
): string {
	if (!rows.length) return "";

	function escapeCell(cell: string): string {
		return String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ");
	}

	const numCols = Math.max(...rows.map((r) => r.length), 1);
	const normalize = (row: string[]): string[] => {
		const out = [...row];
		while (out.length < numCols) out.push("");
		return out.slice(0, numCols);
	};

	const headerRow: string[] = firstRowAsHeader
		? (rows[0] as string[])
		: (Array.from({ length: numCols }) as string[]).fill("");
	const bodyRows = firstRowAsHeader ? rows.slice(1) : rows;

	const lines = [headerRow, ...bodyRows].map((row: string[]) => {
		const cells = normalize(row).map(escapeCell);
		return "| " + cells.join(" | ") + " |";
	});

	const sep = "| " + Array(numCols).fill("---").join(" | ") + " |";

	if (lines.length === 0) return "";
	if (lines.length === 1) return lines[0] + "\n" + sep;

	return lines[0] + "\n" + sep + "\n" + lines.slice(1).join("\n");
}
