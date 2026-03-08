/**
 * Table row/column highlight and selection. Ported from csv-lite (LIUBINfighter).
 */
export class HighlightManager {
	private tableEl: HTMLElement;
	private selectedRow: number = -1;
	private selectedCol: number = -1;

	constructor(tableEl: HTMLElement) {
		this.tableEl = tableEl;
	}

	selectRow(rowIndex: number): void {
		if (this.selectedRow === rowIndex) {
			this.clearSelection();
			return;
		}
		this.clearSelection();
		this.selectedRow = rowIndex;
		this.highlightRow(rowIndex);
	}

	selectColumn(colIndex: number): void {
		if (this.selectedCol === colIndex) {
			this.clearSelection();
			return;
		}
		this.clearSelection();
		this.selectedCol = colIndex;
		this.highlightColumn(colIndex);
	}

	clearSelection(): void {
		this.selectedRow = -1;
		this.selectedCol = -1;
		this.clearHighlight();
	}

	getSelectedRow(): number {
		return this.selectedRow;
	}
	getSelectedCol(): number {
		return this.selectedCol;
	}

	setTableEl(tableEl: HTMLElement): void {
		this.tableEl = tableEl;
	}

	private highlightRow(rowIndex: number): void {
		const rows = this.tableEl?.querySelectorAll("tbody tr");
		if (rows && rows[rowIndex]) {
			(rows[rowIndex] as HTMLElement).classList.add("csv-row-selected");
		}
	}

	private highlightColumn(colIndex: number): void {
		const columnCells = this.tableEl?.querySelectorAll(
			`th:nth-child(${colIndex + 2}), td:nth-child(${colIndex + 2})`
		);
		columnCells?.forEach((cell) => {
			if (cell instanceof HTMLElement) {
				cell.classList.add("csv-col-selected");
			}
		});
	}

	private clearHighlight(): void {
		const selectedElements = this.tableEl?.querySelectorAll(
			".csv-row-selected, .csv-col-selected"
		);
		selectedElements?.forEach((el) => {
			if (el instanceof HTMLElement) {
				el.classList.remove("csv-row-selected");
				el.classList.remove("csv-col-selected");
			}
		});
	}
}
