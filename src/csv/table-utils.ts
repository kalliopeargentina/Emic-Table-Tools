import { Notice } from "obsidian";
import { i18n } from "./i18n";

export class TableUtils {
	static calculateColumnWidths(tableData: string[][]): number[] {
		if (!tableData || tableData.length === 0 || !tableData[0]) return [];
		const columnWidths = tableData[0].map(() => 100);
		tableData.forEach((row) => {
			row.forEach((cell, index) => {
				const estimatedWidth = Math.max(
					50,
					Math.min(300, cell.length * 10)
				);
				const current = columnWidths[index];
				columnWidths[index] = Math.max(
					current ?? 100,
					estimatedWidth
				);
			});
		});
		return columnWidths;
	}

	static addRow(tableData: string[][]): string[][] {
		const colCount = (tableData.length > 0 ? tableData[0]?.length : undefined) ?? 1;
		const newRow = Array(colCount).fill("");
		return [...tableData, newRow];
	}

	static deleteRow(tableData: string[][]): string[][] {
		if (tableData.length <= 1) {
			new Notice(i18n.t("tableMessages.atLeastOneRow"));
			return tableData;
		}
		return tableData.slice(0, -1);
	}

	static addColumn(tableData: string[][]): string[][] {
		return tableData.map((row) => [...row, ""]);
	}

	static deleteColumn(tableData: string[][]): string[][] {
		if (!tableData[0] || tableData[0].length <= 1) {
			new Notice(i18n.t("tableMessages.atLeastOneColumn"));
			return tableData;
		}
		return tableData.map((row) => row.slice(0, -1));
	}

	static addColumnToLeft(
		tableData: string[][],
		columnIndex: number
	): string[][] {
		if (!tableData || tableData.length === 0) return [];
		return tableData.map((row) => {
			const newRow = [...row];
			newRow.splice(columnIndex, 0, "");
			return newRow;
		});
	}

	static addColumnToRight(
		tableData: string[][],
		columnIndex: number
	): string[][] {
		if (!tableData || tableData.length === 0) return [];
		return tableData.map((row) => {
			const newRow = [...row];
			newRow.splice(columnIndex + 1, 0, "");
			return newRow;
		});
	}

	static getColumnLabel(index: number): string {
		let label = "";
		let n = index;
		while (n >= 0) {
			label = String.fromCharCode(65 + (n % 26)) + label;
			n = Math.floor(n / 26) - 1;
		}
		return label;
	}

	static getCellAddress(rowIndex: number, colIndex: number): string {
		const colAddress = this.getColumnLabel(colIndex);
		const rowAddress = rowIndex + 1;
		return `${colAddress}${rowAddress}`;
	}

	static getTableData(tableEl: HTMLElement): string[][] {
		const rows = Array.from(tableEl.querySelectorAll("tr"));
		return rows.map((row) => {
			const cells = Array.from(row.querySelectorAll("td, th"));
			return cells.map((cell) => cell.textContent || "");
		});
	}
}
