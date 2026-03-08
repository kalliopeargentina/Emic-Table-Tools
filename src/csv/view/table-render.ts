import { TableUtils } from "../table-utils";
import { CSVUtils } from "../csv-utils";
import { i18n } from "../i18n";
import { setIcon } from "obsidian";
import { containsUrl, createUrlDisplay } from "../url-utils";

export interface TableRenderOptions {
	tableData: string[][];
	columnWidths: number[];
	autoResize: boolean;
	tableEl: HTMLElement;
	editInput: HTMLInputElement;
	activeCellEl: HTMLInputElement | null;
	activeRowIndex: number;
	activeColIndex: number;
	setActiveCell: (row: number, col: number, cellEl: HTMLInputElement) => void;
	saveSnapshot: () => void;
	requestSave: () => void;
	setupAutoResize: (input: HTMLInputElement) => void;
	adjustInputHeight: (input: HTMLInputElement) => void;
	selectRow: (rowIndex: number) => void;
	selectColumn: (colIndex: number) => void;
	getColumnLabel: (index: number) => string;
	setupColumnResize: (handle: HTMLElement, columnIndex: number) => void;
	insertRowAt: (rowIndex: number, after?: boolean) => void;
	deleteRowAt: (rowIndex: number) => void;
	insertColAt: (colIndex: number, after?: boolean) => void;
	deleteColAt: (colIndex: number) => void;
	renderEditBar?: (row: number, col: number, cellEl: HTMLInputElement) => void;
	onColumnReorder?: (from: number, to: number) => void;
	onRowReorder?: (from: number, to: number) => void;
	stickyRows?: Set<number>;
	stickyColumns?: Set<number>;
	toggleRowSticky?: (rowIndex: number) => void;
	toggleColumnSticky?: (colIndex: number) => void;
}

export function renderTable(options: TableRenderOptions): void {
	const {
		tableData,
		columnWidths,
		autoResize,
		tableEl,
		editInput,
		activeCellEl,
		activeRowIndex,
		activeColIndex,
		setActiveCell,
		saveSnapshot,
		requestSave,
		setupAutoResize,
		adjustInputHeight,
		selectRow,
		selectColumn,
		getColumnLabel,
		setupColumnResize,
		insertRowAt,
		deleteRowAt,
		insertColAt,
		deleteColAt,
		renderEditBar,
		onColumnReorder,
		onRowReorder,
		stickyRows,
		stickyColumns,
		toggleRowSticky,
		toggleColumnSticky,
	} = options;

	tableEl.innerHTML = "";

	const dragState: { type: "row" | "col" | null; index: number | null } = {
		type: null,
		index: null,
	};
	function setDragState(type: "row" | "col" | null, index: number | null): void {
		dragState.type = type;
		dragState.index = index;
		tableEl.classList.remove("csv-dragging-row", "csv-dragging-col");
		if (type === "row") tableEl.classList.add("csv-dragging-row");
		if (type === "col") tableEl.classList.add("csv-dragging-col");
	}

	if (columnWidths.length === 0 && tableData[0]) {
		const widths = TableUtils.calculateColumnWidths(tableData);
		columnWidths.splice(0, columnWidths.length, ...widths);
	}

	const headerRow = tableEl.createEl("thead").createEl("tr");
	const cornerTh = headerRow.createEl("th", { cls: "csv-corner-cell" });

	if (tableData[0]) {
		tableData[0].forEach((headerCell, index) => {
			const th = headerRow.createEl("th", {
				cls: "csv-col-number",
				attr: {
					style: `width: ${columnWidths[index] || 100}px`,
					draggable: "true",
				},
			});
			th.textContent = getColumnLabel(index);
			th.onclick = (e) => {
				e.stopPropagation();
				selectColumn(index);
			};

			if (toggleColumnSticky) {
				const isSticky = stickyColumns?.has(index) ?? false;
				const pinBtn = th.createEl("button", {
					cls: `csv-pin-btn csv-pin-col ${isSticky ? "pinned" : ""}`,
					attr: {
						title: isSticky ? "Unpin column" : "Pin column",
					},
				});
				setIcon(pinBtn, isSticky ? "pin-off" : "pin");
				pinBtn.onclick = (e) => {
					e.stopPropagation();
					toggleColumnSticky(index);
				};
			}

			th.ondragstart = (e) => {
				e.dataTransfer?.setData("text/col-index", String(index));
				th.classList.add("dragging");
				setDragState("col", index);
				requestSave();
			};
			th.ondragend = () => {
				th.classList.remove("dragging");
				setDragState(null, null);
				requestSave();
			};
			th.ondragover = (e) => {
				e.preventDefault();
				th.classList.add("drag-over");
			};
			th.ondragleave = () => th.classList.remove("drag-over");
			th.ondrop = (e) => {
				e.preventDefault();
				th.classList.remove("drag-over");
				setDragState(null, null);
				const from = Number(e.dataTransfer?.getData("text/col-index"));
				const to = index;
				if (onColumnReorder && from !== to) {
					onColumnReorder(from, to);
				}
			};

			if (dragState.type !== "col") {
				const insertLeft = th.createEl("button", {
					cls: "csv-insert-col-btn left",
				});
				insertLeft.innerText = "+";
				insertLeft.title = i18n.t("buttons.insertColBefore");
				insertLeft.onclick = (e) => {
					e.stopPropagation();
					insertColAt(index, false);
				};
				const insertRight = th.createEl("button", {
					cls: "csv-insert-col-btn right",
				});
				insertRight.innerText = "+";
				insertRight.title = i18n.t("buttons.insertColAfter");
				insertRight.onclick = (e) => {
					e.stopPropagation();
					insertColAt(index, true);
				};
				const delCol = th.createEl("button", { cls: "csv-del-col-btn" });
				delCol.innerText = "-";
				delCol.title = i18n.t("buttons.deleteColumn");
				delCol.onclick = (e) => {
					e.stopPropagation();
					deleteColAt(index);
				};
			}

			if (dragState.type === "col" && dragState.index !== null) {
				const firstRow = tableData[0];
				const colEnd = firstRow
					? Math.min(firstRow.length - 1, dragState.index + 2)
					: 0;
				const colStart = Math.max(0, dragState.index - 2);
				if (index >= colStart && index <= colEnd) {
					th.classList.add("csv-dragging-highlight");
				}
			}

			const resizeHandle = th.createEl("div", {
				cls: "resize-handle",
				attr: { "data-index": String(index) },
			});
			setupColumnResize(resizeHandle, index);
		});
	}

	const tableBody = tableEl.createEl("tbody");

	for (let i = 0; i < tableData.length; i++) {
		const row = tableData[i];
		if (!row) continue;
		const tableRow = tableBody.createEl("tr");
		const rowNumberCell = tableRow.createEl("td", {
			cls: "csv-row-number",
			attr: { draggable: "true" },
		});
		rowNumberCell.textContent = String(i);
		rowNumberCell.onclick = (e) => {
			e.stopPropagation();
			selectRow(i);
		};

		if (toggleRowSticky) {
			const isSticky = stickyRows?.has(i) ?? false;
			const pinBtn = rowNumberCell.createEl("button", {
				cls: `csv-pin-btn csv-pin-row ${isSticky ? "pinned" : ""}`,
				attr: {
					title: isSticky ? "Unpin row" : "Pin row",
				},
			});
			setIcon(pinBtn, isSticky ? "pin-off" : "pin");
			pinBtn.onclick = (e) => {
				e.stopPropagation();
				toggleRowSticky(i);
			};
		}

		rowNumberCell.ondragstart = (e) => {
			e.dataTransfer?.setData("text/row-index", String(i));
			rowNumberCell.classList.add("dragging");
			setDragState("row", i);
			requestSave();
		};
		rowNumberCell.ondragend = () => {
			rowNumberCell.classList.remove("dragging");
			setDragState(null, null);
			requestSave();
		};
		rowNumberCell.ondragover = (e) => {
			e.preventDefault();
			rowNumberCell.classList.add("drag-over");
		};
		rowNumberCell.ondragleave = () => rowNumberCell.classList.remove("drag-over");
		rowNumberCell.ondrop = (e) => {
			e.preventDefault();
			rowNumberCell.classList.remove("drag-over");
			setDragState(null, null);
			const from = Number(e.dataTransfer?.getData("text/row-index"));
			const to = i;
			if (onRowReorder && from !== to) {
				onRowReorder(from, to);
			}
		};

		if (dragState.type !== "row") {
			const insertAbove = rowNumberCell.createEl("button", {
				cls: "csv-insert-row-btn above",
			});
			insertAbove.innerText = "+";
			insertAbove.title = i18n.t("buttons.insertRowBefore");
			insertAbove.onclick = (e) => {
				e.stopPropagation();
				insertRowAt(i, false);
			};
			const insertBelow = rowNumberCell.createEl("button", {
				cls: "csv-insert-row-btn below",
			});
			insertBelow.innerText = "+";
			insertBelow.title = i18n.t("buttons.insertRowAfter");
			insertBelow.onclick = (e) => {
				e.stopPropagation();
				insertRowAt(i, true);
			};
			const delRow = rowNumberCell.createEl("button", {
				cls: "csv-del-row-btn",
			});
			delRow.innerText = "-";
			delRow.title = i18n.t("buttons.deleteRow");
			delRow.onclick = (e) => {
				e.stopPropagation();
				deleteRowAt(i);
			};
		}

		if (dragState.type === "row" && dragState.index !== null) {
			const rowStart = Math.max(0, dragState.index - 2);
			const rowEnd = Math.min(tableData.length - 1, dragState.index + 2);
			if (i >= rowStart && i <= rowEnd) {
				rowNumberCell.classList.add("csv-dragging-highlight");
				Array.from(tableRow.children).forEach((td) => {
					(td as HTMLElement).classList.add("csv-dragging-highlight");
				});
			}
		}

		row.forEach((cell, j) => {
			const td = tableRow.createEl("td", {
				attr: { style: `width: ${columnWidths[j] ?? 100}px` },
			});

			const input = td.createEl("input", {
				cls: "csv-cell-input",
				attr: { value: cell },
			});

			const hasUrl = containsUrl(cell);
			let displayEl: HTMLElement | null = null;

			const enterEditMode = (): void => {
				const display = td.querySelector(".csv-cell-display") as HTMLElement;
				if (display) display.style.display = "none";
				input.style.display = "block";
				input.focus();
			};

			if (hasUrl) {
				displayEl = createUrlDisplay(cell, enterEditMode);
				td.insertBefore(displayEl, input);
			}

			setupAutoResize(input);

			if (hasUrl && displayEl) {
				input.style.display = "none";
				displayEl.style.display = "block";
			}

			input.oninput = (ev) => {
				const target = ev.currentTarget;
				if (!(target instanceof HTMLInputElement)) return;
				saveSnapshot();
				const r = tableData[i];
				if (r) r[j] = target.value;
				if (activeCellEl === target && editInput) {
					editInput.value = target.value;
				}
				if (renderEditBar) renderEditBar(i, j, target);
				requestSave();
				if (autoResize) adjustInputHeight(target);

				const newHasUrl = containsUrl(target.value);
				const tdEl = target.parentElement;
				if (tdEl) {
					const existingDisplay = tdEl.querySelector(".csv-cell-display");
					if (newHasUrl) {
						if (existingDisplay) existingDisplay.remove();
						const inputEl = target;
						const newDisplay = createUrlDisplay(target.value, () => {
							const disp = tdEl.querySelector(
								".csv-cell-display"
							) as HTMLElement;
							if (disp) disp.style.display = "none";
							inputEl.style.display = "block";
							inputEl.focus();
						});
						tdEl.insertBefore(newDisplay, target);
					} else if (existingDisplay) {
						existingDisplay.remove();
					}
				}
			};

			input.onfocus = (ev) => {
				const target = ev.currentTarget;
				if (!(target instanceof HTMLInputElement)) return;
				setActiveCell(i, j, target);
				const tdEl = target.parentElement;
				if (tdEl) {
					const display = tdEl.querySelector(
						".csv-cell-display"
					) as HTMLElement;
					if (display) {
						display.style.display = "none";
						target.style.display = "block";
					}
				}
			};

			input.onblur = (ev) => {
				const target = ev.currentTarget;
				if (!(target instanceof HTMLInputElement)) return;
				const tdEl = target.parentElement;
				if (tdEl) {
					const display = tdEl.querySelector(
						".csv-cell-display"
					) as HTMLElement;
					if (display && containsUrl(target.value)) {
						display.style.display = "block";
						target.style.display = "none";
					}
				}
			};
		});
	}

	const deselectActiveHeader = (): void => {
		const activeHeaders = tableEl.querySelectorAll(
			".csv-col-number.active, .csv-row-number.active"
		);
		activeHeaders.forEach((header) => header.classList.remove("active"));
	};

	document.addEventListener("click", (e) => {
		const target = e.target as HTMLElement | null;
		const isHeaderClick = target?.closest(".csv-col-number, .csv-row-number");
		if (!isHeaderClick) deselectActiveHeader();
	});
}
