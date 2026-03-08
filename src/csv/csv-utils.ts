/**
 * CSV parse/unparse and delimiter detection.
 * Ported from csv-lite (LIUBINfighter) – no papaparse dependency.
 */
import { Notice } from "obsidian";
import { i18n } from "./i18n";

export interface CSVParseConfig {
	header: boolean;
	dynamicTyping: boolean;
	skipEmptyLines: boolean;
	delimiter?: string;
	quoteChar: string;
	escapeChar: string;
}

export interface UnparseConfig {
	delimiter?: string;
	newline?: string;
}

export class CSVUtils {
	static defaultConfig: CSVParseConfig = {
		header: false,
		dynamicTyping: false,
		skipEmptyLines: false,
		delimiter: "auto",
		quoteChar: '"',
		escapeChar: '"',
	};

	/**
	 * Detect delimiter from content (comma, semicolon, tab, pipe).
	 */
	static detectDelimiter(csvString: string, quoteChar = '"'): string {
		if (!csvString || csvString.length === 0) return ",";
		const candidates = [",", ";", "\t", "|"];
		const records: string[] = [];
		let cur = "";
		let inQuote = false;
		for (let i = 0; i < csvString.length; i++) {
			const ch = csvString[i];
			if (ch === quoteChar) {
				if (i + 1 < csvString.length && csvString[i + 1] === quoteChar) {
					cur += quoteChar;
					i++;
					continue;
				}
				inQuote = !inQuote;
				cur += ch;
				continue;
			}
			if (!inQuote && ch === "\n") {
				records.push(cur);
				cur = "";
				continue;
			}
			if (!inQuote && ch === "\r") continue;
			cur += ch;
		}
		if (cur.length > 0) records.push(cur);
		const sample = records
			.map((r) => r)
			.filter((r) => r.trim().length > 0)
			.slice(0, 20);
		if (sample.length === 0) return ",";

		function countFields(record: string, delim: string): number {
			let inQ = false;
			let count = 0;
			for (let i = 0; i < record.length; i++) {
				const ch = record[i];
				if (ch === quoteChar) {
					if (i + 1 < record.length && record[i + 1] === quoteChar) {
						i++;
						continue;
					}
					inQ = !inQ;
					continue;
				}
				if (!inQ && ch === delim) count++;
			}
			return count + 1;
		}

		let best: {
			delim: string;
			score: number;
			avgFields: number;
			consistency: number;
		} | null = null;
		for (const d of candidates) {
			const counts = sample.map((r) => countFields(r, d));
			const avg =
				counts.reduce((a, b) => a + b, 0) / counts.length;
			const variance =
				counts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) /
				counts.length;
			const score = (avg > 1 ? avg : 0) - variance * 0.1;
			if (!best || score > best.score) {
				best = { delim: d, score, avgFields: avg, consistency: variance };
			}
		}
		if (best && best.avgFields >= 1.5) {
			return best.delim;
		}
		return ",";
	}

	/**
	 * Parse CSV string into a 2D string array (RFC 4180-style).
	 */
	static parseCSV(
		csvString: string,
		config?: Partial<CSVParseConfig>
	): string[][] {
		try {
			const parseConfig = { ...this.defaultConfig, ...config };
			let delimiter = parseConfig.delimiter;
			if (!delimiter || delimiter === "auto") {
				delimiter = this.detectDelimiter(
					csvString,
					parseConfig.quoteChar
				);
			}
			const quoteChar = parseConfig.quoteChar;
			const rows: string[][] = [];
			let row: string[] = [];
			let field = "";
			let inQuote = false;
			for (let i = 0; i < csvString.length; i++) {
				const ch = csvString[i];
				if (ch === quoteChar) {
					if (inQuote && i + 1 < csvString.length && csvString[i + 1] === quoteChar) {
						field += quoteChar;
						i++;
						continue;
					}
					inQuote = !inQuote;
					continue;
				}
				if (!inQuote) {
					if (ch === "\n" || ch === "\r") {
						row.push(field);
						rows.push(row);
						row = [];
						field = "";
						if (ch === "\r" && i + 1 < csvString.length && csvString[i + 1] === "\n") i++;
						continue;
					}
					if (ch === delimiter) {
						row.push(field);
						field = "";
						continue;
					}
				}
				field += ch;
			}
			row.push(field);
			if (row.length > 0 || field !== "") rows.push(row);
			return rows.length > 0 ? rows : [[""]];
		} catch (error) {
			console.error("CSV parse error:", error);
			new Notice(i18n.t("csv.parsingFailed"));
			return [[""]];
		}
	}

	/**
	 * Unparse 2D array to CSV string.
	 */
	static unparseCSV(data: string[][], config?: UnparseConfig): string {
		const delim = config?.delimiter ?? ",";
		const newline = config?.newline ?? "\n";
		function escape(field: string): string {
			const s = String(field);
			if (/[,"\r\n]/.test(s) || s.includes(quoteChar)) {
				return quoteChar + s.replace(new RegExp(quoteChar, "g"), quoteChar + quoteChar) + quoteChar;
			}
			return s;
		}
		const quoteChar = '"';
		return data.map((row) => row.map(escape).join(delim)).join(newline);
	}

	static normalizeTableData(tableData: string[][]): string[][] {
		if (!tableData || tableData.length === 0) return [[""]];
		let maxCols = 0;
		for (const row of tableData) {
			if (row) maxCols = Math.max(maxCols, row.length);
		}
		return tableData.map((row) => {
			const newRow = row ? [...row] : [];
			while (newRow.length < maxCols) newRow.push("");
			return newRow;
		});
	}
}
