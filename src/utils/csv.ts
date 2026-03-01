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
