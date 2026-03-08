import {
	TextFileView,
	ButtonComponent,
	Notice,
	DropdownComponent,
	getIcon,
	IconName,
	Setting,
	TFile,
} from "obsidian";
import { CSVUtils, CSVParseConfig } from "./csv-utils";
import { TableHistoryManager } from "./history-manager";
import { TableUtils } from "./table-utils";
import { FileUtils } from "./file-utils";
import { i18n } from "./i18n";
import { renderEditBar } from "./view/edit-bar";
import { SearchBar } from "./view/search-bar";
import { renderTable } from "./view/table-render";
import { HighlightManager } from "./highlight-manager";
import { setupHeaderContextMenu } from "./view/header-context-menu";

export const VIEW_TYPE_CSV = "emic-csv-view";

export class CSVView extends TextFileView {
	public file: TFile | null;
	public headerEl: HTMLElement;

	tableData: string[][] = [[""]];
	tableEl: HTMLElement;
	operationEl: HTMLElement;

	private historyManager: TableHistoryManager;
	private maxHistorySize: number = 50;

	private columnWidths: number[] = [];
	private autoResize: boolean = true;

	private delimiter: string = 'auto';
	private quoteChar: string = '"';
	private originalFileDelimiter: string | null = null;

	private editBarEl: HTMLElement;
	private editInput: HTMLInputElement;
	private activeCellEl: HTMLInputElement | null = null;
	private activeRowIndex: number = -1;
	private activeColIndex: number = -1;

	private highlightManager: HighlightManager;

	private searchInput: HTMLInputElement;
	private searchResults: HTMLElement;
	private searchContainer: HTMLElement;
	private searchMatches: Array<{row: number, col: number, value: string}> = [];
	private currentSearchIndex: number = -1;

	private isSourceMode: boolean = false;
	private sourceTextarea: HTMLTextAreaElement | null = null;
	private sourceCursorPos: { start: number, end: number } = { start: 0, end: 0 };

	private searchBar: any;

	private headerContextMenuCleanup: (() => void) | null = null;

	private stickyRows: Set<number> = new Set();
	private stickyColumns: Set<number> = new Set();
	private stickyHeaders: boolean = true;
	private stickyRowNumbers: boolean = true;

	constructor(leaf: any) {
		super(leaf);
		this.historyManager = new TableHistoryManager(
			undefined,
			this.maxHistorySize
		);
		// @ts-ignore
		this.file = (this as any).file;
		// @ts-ignore
		this.headerEl = (this as any).headerEl;
		this.setupSafeSave();
	}

	getIcon(): IconName {
		return "table";
	}
	getViewData() {
		const delim = this.originalFileDelimiter || (this.delimiter === 'auto' ? undefined : this.delimiter);
		return CSVUtils.unparseCSV(this.tableData, delim ? { delimiter: delim } as any : undefined);
	}

	private originalRequestSave: () => void;

	private setupSafeSave() {
		this.originalRequestSave = this.requestSave;

		this.requestSave = async () => {
			try {
				await FileUtils.withRetry(async () => {
					this.originalRequestSave();
					return Promise.resolve();
				});
			} catch (error) {
				console.error("Failed to save CSV file after retries:", error);
				new Notice(
					`Failed to save file: ${(error as Error).message}. The file might be open in another program.`
				);
			}
		};
	}

	setViewData(data: string, clear: boolean) {
		try {
			this.tableData = CSVUtils.parseCSV(data, {
				delimiter: this.delimiter,
				quoteChar: this.quoteChar,
			});

			if (!this.originalFileDelimiter) {
				try {
					this.originalFileDelimiter = CSVUtils.detectDelimiter(data, this.quoteChar);
				} catch (e) {
					console.warn('Failed to detect original delimiter:', e);
				}
			}

			if (!this.tableData || this.tableData.length === 0) {
				this.tableData = [[""]];
			}

			this.tableData = CSVUtils.normalizeTableData(this.tableData);

			if (clear) {
				this.historyManager.reset(this.tableData);
			}

			this.refresh();
		} catch (error) {
			console.error("CSV处理错误:", error);

			this.tableData = [[""]];
			if (clear) {
				this.historyManager.reset(this.tableData);
			}
			this.refresh();
		}
	}

	private reparseAndRefresh() {
		const rawData = this.data;
		this.setViewData(rawData, false);
	}

	refresh() {
		if (!this.contentEl) return;
		this.contentEl.querySelectorAll('.csv-source-mode').forEach(el => el.remove());

		if (!this.tableData || !Array.isArray(this.tableData) || this.tableData.length === 0) {
			console.warn("Table data not properly initialized, setting default");
			this.tableData = [[""]];
		}

		const renderEditBarBridge = (row: number, col: number, cellEl: HTMLInputElement) => {
			renderEditBar({
				editBarEl: this.editBarEl,
				editInput: this.editInput,
				activeCellEl: cellEl,
				activeRowIndex: row,
				activeColIndex: col,
				tableData: this.tableData,
				onEdit: (r, c, value) => {
					this.saveSnapshot();
					const row = this.tableData[r];
					if (row) row[c] = value;
					this.requestSave();
				},
			});
		};

		renderTable({
			tableData: this.tableData,
			columnWidths: this.columnWidths,
			autoResize: this.autoResize,
			tableEl: this.tableEl,
			editInput: this.editInput,
			activeCellEl: this.activeCellEl,
			activeRowIndex: this.activeRowIndex,
			activeColIndex: this.activeColIndex,
			setActiveCell: (row, col, cellEl) => {
				this.setActiveCell(row, col, cellEl);
				renderEditBarBridge(row, col, cellEl);
			},
			saveSnapshot: () => this.saveSnapshot(),
			requestSave: () => this.requestSave(),
			setupAutoResize: (input) => this.setupAutoResize(input),
			adjustInputHeight: (input) => this.adjustInputHeight(input),
			selectRow: (rowIndex) => this.highlightManager.selectRow(rowIndex),
			selectColumn: (colIndex) => this.highlightManager.selectColumn(colIndex),
			getColumnLabel: (index) => this.getColumnLabel(index),
			setupColumnResize: (handle, columnIndex) => this.setupColumnResize(handle, columnIndex),
			insertRowAt: (rowIndex, after = false) => {
				this.saveSnapshot();
				const idx = after ? rowIndex + 1 : rowIndex;
				const firstRow = this.tableData[0];
				this.tableData.splice(idx, 0, Array(firstRow?.length ?? 0).fill(""));
				this.refresh();
				this.requestSave();
			},
			deleteRowAt: (rowIndex) => {
				if (this.tableData.length <= 1) return;
				this.saveSnapshot();
				this.tableData.splice(rowIndex, 1);
				this.refresh();
				this.requestSave();
			},
			insertColAt: (colIndex, after = false) => {
				this.saveSnapshot();
				const idx = after ? colIndex + 1 : colIndex;
				this.tableData.forEach(row => row.splice(idx, 0, ""));
				this.refresh();
				this.requestSave();
			},
			deleteColAt: (colIndex) => {
				const first = this.tableData[0];
				if (!first || first.length <= 1) return;
				this.saveSnapshot();
				this.tableData.forEach(row => row.splice(colIndex, 1));
				this.refresh();
				this.requestSave();
			},
			renderEditBar: renderEditBarBridge,
			onColumnReorder: (from, to) => {
				if (from === to) return;
				this.saveSnapshot();
				for (let row of this.tableData) {
					const [col] = row.splice(from, 1);
					row.splice(to, 0, col ?? "");
				}
				if (this.columnWidths && this.columnWidths.length > 0) {
					const [w] = this.columnWidths.splice(from, 1);
					this.columnWidths.splice(to, 0, w ?? 100);
				}
				this.refresh();
				this.requestSave();
			},
			onRowReorder: (from, to) => {
				if (from === to) return;
				this.saveSnapshot();
				const [row] = this.tableData.splice(from, 1);
				if (row) this.tableData.splice(to, 0, row);
				this.refresh();
				this.requestSave();
			},
			stickyRows: this.stickyRows,
			stickyColumns: this.stickyColumns,
			toggleRowSticky: (rowIndex: number) => this.toggleRowSticky(rowIndex),
			toggleColumnSticky: (colIndex: number) => this.toggleColumnSticky(colIndex),
		});

		requestAnimationFrame(() => {
			this.applyStickyStyles();
		});

		const topScroll = this.operationEl?.querySelector?.('.top-scroll');
		if (topScroll && this.tableEl) {
			const tableWidth = this.tableEl.offsetWidth;
			const createSpacer = () => {
				const spacer = document.createElement('div');
				spacer.style.width = tableWidth + 'px';
				spacer.style.height = '1px';
				return spacer;
			};
			while (topScroll.firstChild) topScroll.removeChild(topScroll.firstChild);
			topScroll.appendChild(createSpacer());
		}

		const tableContainer = this.tableEl.parentElement;
		if (tableContainer) {
			if ((this as any)._csvTableClickHandler) {
				tableContainer.removeEventListener('click', (this as any)._csvTableClickHandler);
			}
			const handler = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				if (
					(target.tagName === 'TH' && target.classList.contains('csv-col-number')) ||
					(target.tagName === 'TD' && target.classList.contains('csv-row-number'))
				) {
					return;
				}
				this.highlightManager.clearSelection();
			};
			(this as any)._csvTableClickHandler = handler;
			tableContainer.addEventListener('click', handler);
		}

		if (this.headerContextMenuCleanup) {
			this.headerContextMenuCleanup();
			this.headerContextMenuCleanup = null;
		}
		this.headerContextMenuCleanup = setupHeaderContextMenu(
			this.tableEl,
			{
				selectRow: (rowIndex) => this.highlightManager.selectRow(rowIndex),
				selectColumn: (colIndex) => this.highlightManager.selectColumn(colIndex),
				clearSelection: () => this.highlightManager.clearSelection(),
				onMenuClose: () => {},
				onInsertRowAbove: (rowIdx) => this.refreshInsertRow(rowIdx, false),
				onInsertRowBelow: (rowIdx) => this.refreshInsertRow(rowIdx, true),
				onDeleteRow: (rowIdx) => this.refreshDeleteRow(rowIdx),
				onMoveRowUp: (rowIdx) => this.moveRow(rowIdx, rowIdx - 1),
				onMoveRowDown: (rowIdx) => this.moveRow(rowIdx, rowIdx + 1),
				onInsertColLeft: (colIdx) => this.refreshInsertCol(colIdx, false),
				onInsertColRight: (colIdx) => this.refreshInsertCol(colIdx, true),
				onDeleteCol: (colIdx) => this.refreshDeleteCol(colIdx),
				onMoveColLeft: (colIdx) => this.moveCol(colIdx, colIdx - 1),
				onMoveColRight: (colIdx) => this.moveCol(colIdx, colIdx + 1),
			}
		);

		this.tableData[0]?.forEach((_, index) => {
			const resizeHandle = this.tableEl.querySelector(`.resize-handle[data-index='${index}']`) as HTMLElement;
			if (resizeHandle) {
				this.setupColumnResize(resizeHandle, index);
			}
		});

		this.tableData.forEach((_, rowIndex) => {
			const resizeHandleRow = this.tableEl.querySelector(`.resize-handle-row[data-row-index='${rowIndex}']`) as HTMLElement;
			if (resizeHandleRow) {
				this.setupColumnResize(resizeHandleRow, rowIndex);
			}
		});
	}

	private getColumnLabel(index: number): string {
		let result = '';
		let num = index;
		do {
			result = String.fromCharCode(65 + (num % 26)) + result;
			num = Math.floor(num / 26) - 1;
		} while (num >= 0);
		return result;
	}

	private setActiveCell(
		rowIndex: number,
		colIndex: number,
		cellEl: HTMLInputElement
	) {
		if (this.activeCellEl && this.activeCellEl.parentElement) {
			this.activeCellEl.parentElement.classList.remove("csv-active-cell");
		}

		this.activeRowIndex = rowIndex;
		this.activeColIndex = colIndex;
		this.activeCellEl = cellEl;

		if (cellEl.parentElement) {
			cellEl.parentElement.classList.add("csv-active-cell");
		}

		if (this.editInput && this.editBarEl) {
			renderEditBar({
				editBarEl: this.editBarEl,
				editInput: this.editInput,
				activeCellEl: cellEl,
				activeRowIndex: rowIndex,
				activeColIndex: colIndex,
				tableData: this.tableData,
				onEdit: (row, col, value) => {
					this.saveSnapshot();
					const r = this.tableData[row];
					if (r) r[col] = value;
					this.requestSave();
				},
			});
		}
	}

	private setupColumnResize(handle: HTMLElement, columnIndex: number) {
		let startX: number;
		let startWidth: number;

		const onMouseDown = (e: MouseEvent) => {
			startX = e.clientX;
			startWidth = this.columnWidths[columnIndex] || 100;

			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);

			e.preventDefault();
		};

		const onMouseMove = (e: MouseEvent) => {
			const width = startWidth + (e.clientX - startX);
			if (width >= 50) {
				this.columnWidths[columnIndex] = width;
				this.refresh();
			}
		};

		const onMouseUp = () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};

		handle.addEventListener("mousedown", onMouseDown);
	}

	private setupAutoResize(input: HTMLInputElement) {
		this.adjustInputHeight(input);

		input.addEventListener("input", () => {
			if (this.autoResize) {
				this.adjustInputHeight(input);
			}
		});
	}

	private adjustInputHeight(input: HTMLInputElement) {
		const lineCount = (input.value.match(/\n/g) || []).length + 1;
		const minHeight = 24;
		const lineHeight = 20;

		const newHeight = Math.max(minHeight, lineCount * lineHeight);
		input.style.height = `${newHeight}px`;
	}

	private saveSnapshot() {
		this.historyManager.push(this.tableData);
	}

	undo() {
		const prevState = this.historyManager.undo();
		if (prevState) {
			this.tableData = prevState;
			this.refresh();
			this.requestSave();
		}
	}

	redo() {
		const nextState = this.historyManager.redo();
		if (nextState) {
			this.tableData = nextState;
			this.refresh();
			this.requestSave();
		}
	}

	clear() {
		this.tableData = [[""]];
		this.historyManager.reset(this.tableData);
		this.refresh();
	}

	getViewType() {
		return VIEW_TYPE_CSV;
	}

	async onOpen() {
		try {
			const actionsEl = this.headerEl?.querySelector?.('.view-actions');
			if (actionsEl && !actionsEl.querySelector('.csv-switch-source')) {
				const btn = document.createElement('button');
				btn.className = 'clickable-icon csv-switch-source';
				btn.setAttribute('aria-label', '切换到源码模式');
				btn.innerHTML = ` `;
				btn.onclick = async () => {
					const file = this.file;
					if (!file) return;
					const leaves = this.app.workspace.getLeavesOfType('emic-csv-source-view');
					let found = false;
					for (const leaf of leaves) {
						if (leaf.view && (leaf.view as any).file && (leaf.view as any).file.path === file.path) {
							this.app.workspace.setActiveLeaf(leaf, true, true);
							found = true;
							break;
						}
					}
					if (!found) {
						const newLeaf = this.app.workspace.getLeaf(true);
						await newLeaf.openFile(file, { active: true, state: { mode: "source" } });
						await newLeaf.setViewState({
							type: "emic-csv-source-view",
							active: true,
							state: { file: file.path }
						});
						this.app.workspace.setActiveLeaf(newLeaf, true, true);
					}
				};
				actionsEl.appendChild(btn);
			}

			while (this.contentEl.firstChild) this.contentEl.removeChild(this.contentEl.firstChild);

			this.operationEl = this.contentEl.createEl("div", {
				cls: "csv-operations",
			});

			const parserSettingsEl = this.operationEl.createEl("div", {
				cls: "csv-parser-settings",
			});

			new Setting(parserSettingsEl)
				.setName(i18n.t("settings.fieldSeparator"))
				.setDesc(i18n.t("settings.fieldSeparatorDesc"))
				.addDropdown((dropdown: DropdownComponent) => {
					try {
						const mainPlugin: any = (this.app as any).plugins?.getPlugin?.('emic-table-tools');
						if (mainPlugin && mainPlugin.settings && mainPlugin.settings.preferredDelimiter) {
							this.delimiter = mainPlugin.settings.preferredDelimiter;
						}
					} catch (e) {}

					const detected = CSVUtils.detectDelimiter(this.data || '', this.quoteChar);

					dropdown.addOption('auto', `Auto (detected: ${detected})`);
					dropdown.addOption(',', ',');
					dropdown.addOption(';', ';');
					dropdown.setValue(this.delimiter || 'auto');

					dropdown.onChange(async (value) => {
						this.delimiter = value === '\\t' ? '\t' : value;
						try {
							const mainPlugin: any = (this.app as any).plugins?.getPlugin?.('emic-table-tools');
							if (mainPlugin && typeof mainPlugin.saveSettings === 'function') {
								mainPlugin.settings = { ...(mainPlugin.settings || {}), preferredDelimiter: this.delimiter };
								await mainPlugin.saveSettings();
							}
						} catch (e) {}

						this.reparseAndRefresh();
					});
				});

			new Setting(parserSettingsEl)
				.setName(i18n.t("settings.quoteChar"))
				.setDesc(i18n.t("settings.quoteCharDesc"))
				.addText((text) => {
					text.setValue(this.quoteChar)
						.setPlaceholder('默认为双引号 "')
						.onChange(async (value) => {
							this.quoteChar = value || '"';
							this.reparseAndRefresh();
						});
				});

			const buttonContainer = this.operationEl.createEl("div", {
				cls: "csv-operation-buttons",
			});
			const buttonsGroup = buttonContainer.createEl("div", {
				cls: "csv-buttons-group"
			});
			const searchBarContainer = buttonContainer.createEl("div", {
				cls: "csv-search-bar-container"
			});
			this.searchBar = new SearchBar(searchBarContainer, {
				getTableData: () => this.tableData,
				tableEl: this.tableEl,
				getColumnLabel: (index: number) => this.getColumnLabel(index),
				getCellAddress: (row: number, col: number) => this.getCellAddress(row, col),
				jumpToCell: (row: number, col: number) => this.jumpToCell(row, col),
				clearSearchHighlights: () => this.clearSearchHighlights(),
			});

			new ButtonComponent(buttonsGroup)
				.setButtonText(i18n.t("buttons.undo"))
				.setIcon("undo")
				.onClick(() => this.undo());

			new ButtonComponent(buttonsGroup)
				.setButtonText(i18n.t("buttons.redo"))
				.setIcon("redo")
				.onClick(() => this.redo());

			new ButtonComponent(buttonsGroup)
				.setButtonText(i18n.t("buttons.resetColumnWidth"))
				.onClick(() => {
					this.columnWidths = [];
					this.calculateColumnWidths();
					this.refresh();
				});

			const delimiterContainer = buttonsGroup.createEl('div', { cls: 'csv-delimiter-compact' });
			new Setting(delimiterContainer)
				.addDropdown((dropdown: DropdownComponent) => {
					try {
						const mainPlugin: any = (this.app as any).plugins?.getPlugin?.('emic-table-tools');
						if (mainPlugin && mainPlugin.settings && mainPlugin.settings.preferredDelimiter) {
							this.delimiter = mainPlugin.settings.preferredDelimiter;
						}
					} catch (e) {}

					const detected = CSVUtils.detectDelimiter(this.data || '', this.quoteChar);
					dropdown.addOption('auto', `Auto (${detected})`);
					dropdown.addOption(',', ',');
					dropdown.addOption(';', ';');
					dropdown.setValue(this.delimiter || 'auto');

					dropdown.onChange(async (value) => {
						this.delimiter = value === '\\t' ? '\t' : value;
						try {
							const mainPlugin: any = (this.app as any).plugins?.getPlugin?.('emic-table-tools');
							if (mainPlugin && typeof mainPlugin.saveSettings === 'function') {
								mainPlugin.settings = { ...(mainPlugin.settings || {}), preferredDelimiter: this.delimiter };
								await mainPlugin.saveSettings();
							}
						} catch (e) {}

						this.reparseAndRefresh();
					});
				});

			this.editBarEl = this.operationEl.createEl("div", {
				cls: "csv-edit-bar",
			});
			this.editInput = this.editBarEl.createEl("input", {
				cls: "csv-edit-input",
				attr: { placeholder: i18n.t("editBar.placeholder") },
			});
			renderEditBar({
				editBarEl: this.editBarEl,
				editInput: this.editInput,
				activeCellEl: this.activeCellEl,
				activeRowIndex: this.activeRowIndex,
				activeColIndex: this.activeColIndex,
				tableData: this.tableData,
				onEdit: (row, col, value) => {
					this.saveSnapshot();
					const r = this.tableData[row];
					if (r) r[col] = value;
					this.requestSave();
				},
			});

			const topScrollContainer = this.operationEl.createEl("div", {
				cls: "scroll-container top-scroll",
			});

			const tableWrapper = this.contentEl.createEl("div", {
				cls: "table-wrapper",
			});
			const tableContainer = tableWrapper.createEl("div", {
				cls: "table-container main-scroll",
			});
			this.tableEl = tableContainer.createEl("table", {
				cls: "emic-csv-table",
			});
			this.highlightManager = new HighlightManager(this.tableEl);

			this.setupScrollSync(topScrollContainer, tableContainer);

			if (!this.historyManager) {
				this.historyManager = new TableHistoryManager(
					this.tableData,
					this.maxHistorySize
				);
			}

			this.registerDomEvent(
				document,
				"keydown",
				(event: KeyboardEvent) => {
					if (this.app.workspace.activeLeaf !== this.leaf) return;

					if ((event.ctrlKey || event.metaKey) && event.key === "z") {
						if (event.shiftKey) {
							event.preventDefault();
							this.redo();
						} else {
							event.preventDefault();
							this.undo();
						}
					}
				}
			);

			if (
				!this.tableData ||
				!Array.isArray(this.tableData) ||
				this.tableData.length === 0
			) {
				this.tableData = [[""]];
			}

			this.refresh();

			if (this.tableEl) {
				this.tableEl.addEventListener('click', (e: MouseEvent) => {
					const target = e.target as HTMLElement;
					if (
						target.tagName === 'TH' &&
						(target.classList.contains('csv-row-header') || target.classList.contains('csv-col-header'))
					) {
						return;
					}
					this.highlightManager.clearSelection();
				});
			}

			this.operationEl.classList.add("csv-toolbar-sticky");
		} catch (error) {
			console.error("Error in onOpen:", error);
			new Notice(`Failed to open CSV view: ${(error as Error).message}`);

			while (this.contentEl.firstChild) this.contentEl.removeChild(this.contentEl.firstChild);
			const errorDiv = this.contentEl.createEl("div", {
				cls: "csv-error",
			});
			errorDiv.createEl("h3", { text: "Error opening CSV file" });
			errorDiv.createEl("p", { text: (error as Error).message });

			this.tableData = [[""]];
			this.tableEl = this.contentEl.createEl("table");
			this.refresh();
		}
	}

	setTableContent(content: string[][]) {
		this.tableData = content;
		this.refresh();
	}

	getTableContent(): string[][] {
		return this.tableData;
	}

	calculateColumnWidths() {
		this.columnWidths = TableUtils.calculateColumnWidths(this.tableData);
	}

	private setupScrollSync(topScroll: HTMLElement, mainScroll: HTMLElement) {
		mainScroll.addEventListener('scroll', () => {
			topScroll.scrollLeft = mainScroll.scrollLeft;
		});

		topScroll.addEventListener('scroll', () => {
			mainScroll.scrollLeft = topScroll.scrollLeft;
		});
	}

	async onClose() {
		const styleEl = document.head.querySelector("#csv-edit-bar-styles");
		if (styleEl) styleEl.remove();

		if (this.headerContextMenuCleanup) {
			this.headerContextMenuCleanup();
			this.headerContextMenuCleanup = null;
		}
		while (this.contentEl.firstChild) this.contentEl.removeChild(this.contentEl.firstChild);
	}

	addRow() {
		this.saveSnapshot();
		this.tableData = TableUtils.addRow(this.tableData);
		this.refresh();
		this.requestSave();
	}

	deleteRow() {
		this.saveSnapshot();
		this.tableData = TableUtils.deleteRow(this.tableData);
		this.refresh();
		this.requestSave();
	}

	addColumn() {
		this.saveSnapshot();
		this.tableData = TableUtils.addColumn(this.tableData);
		this.refresh();
		this.requestSave();
	}

	deleteColumn() {
		this.saveSnapshot();
		this.tableData = TableUtils.deleteColumn(this.tableData);
		this.refresh();
		this.requestSave();
	}

	private getCellAddress(row: number, col: number): string {
		return `${this.getColumnLabel(col)}${row + 1}`;
	}

	private jumpToCell(row: number, col: number) {
		this.clearSearchHighlights();
		const tableRows = this.tableEl?.querySelectorAll("tr");
		const targetRowIndex = row === 0 ? 1 : row + 1;
		if (tableRows && targetRowIndex < tableRows.length) {
			const targetRow = tableRows[targetRowIndex];
			if (targetRow) {
				const cells = targetRow.querySelectorAll("td, th");
				const targetCellIndex = col + 1;
				if (targetCellIndex < cells.length) {
					const targetCell = cells[targetCellIndex];
					if (targetCell) {
						const input = targetCell.querySelector("input") as HTMLInputElement;
				if (input) {
					input.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
					setTimeout(() => {
						input.focus();
						input.select();
						if (input.parentElement) {
							input.parentElement.classList.add("csv-search-current");
							setTimeout(() => {
								if (input.parentElement) {
									input.parentElement.classList.remove("csv-search-current");
								}
							}, 3000);
						}
						}, 100);
					}
				}
			}
		}
	}
	}

	private clearSearchHighlights() {
		this.tableEl?.querySelectorAll(".csv-search-current").forEach(el => {
			if (el instanceof HTMLElement) {
				el.classList.remove("csv-search-current");
			}
		});
	}

	async openSourceMode() {
		const file = this.file;
		if (!file) return;
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.openFile(file, { active: true, state: { mode: "source" } });
		await leaf.setViewState({
			type: "emic-csv-source-view",
			active: true,
			state: { file: file.path }
		});
		this.leaf.detach();
	}

	moveRow(fromIndex: number, toIndex: number) {
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.tableData.length || toIndex >= this.tableData.length) return;
		this.saveSnapshot();
		const [row] = this.tableData.splice(fromIndex, 1);
		if (row) this.tableData.splice(toIndex, 0, row);
		this.refresh();
		this.requestSave();
	}

	private toggleRowSticky(rowIndex: number) {
		if (this.stickyRows.has(rowIndex)) {
			this.stickyRows.delete(rowIndex);
		} else {
			this.stickyRows.add(rowIndex);
		}
		this.applyStickyStyles();
	}

	private toggleColumnSticky(colIndex: number) {
		if (this.stickyColumns.has(colIndex)) {
			this.stickyColumns.delete(colIndex);
		} else {
			this.stickyColumns.add(colIndex);
		}
		this.applyStickyStyles();
	}

	private applyStickyStyles() {
		if (!this.tableEl) return;

		this.tableEl.querySelectorAll('.csv-sticky-row, .csv-sticky-col, .csv-sticky-header, .csv-sticky-row-number').forEach(el => {
			el.classList.remove('csv-sticky-row', 'csv-sticky-col', 'csv-sticky-header', 'csv-sticky-row-number');
			(el as HTMLElement).style.removeProperty('left');
			(el as HTMLElement).style.removeProperty('top');
		});
		const getRowNumberWidth = (): number => {
			const firstRowNumber = this.tableEl.querySelector('tbody tr td:first-child') as HTMLElement;
			return firstRowNumber ? firstRowNumber.offsetWidth : 40;
		};

		const getHeaderHeight = (): number => {
			const headerRow = this.tableEl.querySelector('thead tr') as HTMLElement;
			return headerRow ? headerRow.offsetHeight : 30;
		};

		const calculateStickyColumnsWidth = (upToIndex: number): number => {
			let totalWidth = getRowNumberWidth();
			for (let i = 0; i < upToIndex; i++) {
				if (this.stickyColumns.has(i)) {
					const headerCell = this.tableEl.querySelector(`thead tr th:nth-child(${i + 2})`) as HTMLElement;
					if (headerCell) {
						totalWidth += headerCell.offsetWidth;
					} else {
						totalWidth += this.columnWidths[i] || 100;
					}
				}
			}
			return totalWidth;
		};

		const calculateStickyRowsHeight = (upToIndex: number): number => {
			let totalHeight = getHeaderHeight();
			for (let i = 0; i < upToIndex; i++) {
				if (this.stickyRows.has(i)) {
					const row = this.tableEl.querySelector(`tbody tr:nth-child(${i + 1})`) as HTMLElement;
					if (row) {
						totalHeight += row.offsetHeight;
					} else {
						totalHeight += 32;
					}
				}
			}
			return totalHeight;
		};

		if (this.stickyHeaders) {
			const headerCells = this.tableEl.querySelectorAll('thead tr th');
			headerCells.forEach(cell => {
				cell.classList.add('csv-sticky-header');
				(cell as HTMLElement).style.top = '0px';
			});
		}

		if (this.stickyRowNumbers) {
			const rowNumberWidth = getRowNumberWidth();

			const headerRowNumber = this.tableEl.querySelector('thead tr th:first-child') as HTMLElement;
			if (headerRowNumber) {
				headerRowNumber.classList.add('csv-sticky-row-number');
				headerRowNumber.style.left = '0px';
				headerRowNumber.style.top = '0px';
			}

			const rowNumberCells = this.tableEl.querySelectorAll('tbody tr td:first-child');
			rowNumberCells.forEach(cell => {
				cell.classList.add('csv-sticky-row-number');
				(cell as HTMLElement).style.left = '0px';
			});
		}

		const headerHeight = getHeaderHeight();
		this.stickyRows.forEach(rowIndex => {
			const stickyTop = calculateStickyRowsHeight(rowIndex);
			const rowCells = this.tableEl.querySelectorAll(`tbody tr:nth-child(${rowIndex + 1}) td`);
			rowCells.forEach(cell => {
				cell.classList.add('csv-sticky-row');
				(cell as HTMLElement).style.top = `${stickyTop}px`;
			});
		});

		this.stickyColumns.forEach(colIndex => {
			const stickyLeft = calculateStickyColumnsWidth(colIndex);

			const headerCell = this.tableEl.querySelector(`thead tr th:nth-child(${colIndex + 2})`) as HTMLElement;
			if (headerCell) {
				headerCell.classList.add('csv-sticky-col');
				headerCell.style.left = `${stickyLeft}px`;
				headerCell.style.top = '0px';
			}

			const dataCells = this.tableEl.querySelectorAll(`tbody tr td:nth-child(${colIndex + 2})`);
			dataCells.forEach(cell => {
				cell.classList.add('csv-sticky-col');
				(cell as HTMLElement).style.left = `${stickyLeft}px`;
			});
		});
	}

	moveCol(fromIndex: number, toIndex: number) {
		const first = this.tableData[0];
		if (!first || fromIndex < 0 || toIndex < 0 || fromIndex >= first.length || toIndex >= first.length) return;
		this.saveSnapshot();
		this.tableData.forEach(row => {
			const col = row.splice(fromIndex, 1)[0];
			row.splice(toIndex, 0, col ?? "");
		});
		this.refresh();
		this.requestSave();
	}

	private refreshInsertRow(rowIdx: number, after: boolean) {
		this.saveSnapshot();
		const idx = after ? rowIdx + 1 : rowIdx;
		const first = this.tableData[0];
		this.tableData.splice(idx, 0, Array(first?.length ?? 0).fill(""));
		this.refresh();
		this.requestSave();
	}
	private refreshDeleteRow(rowIdx: number) {
		if (this.tableData.length <= 1) return;
		this.saveSnapshot();
		this.tableData.splice(rowIdx, 1);
		this.refresh();
		this.requestSave();
	}
	private refreshInsertCol(colIdx: number, after: boolean) {
		this.saveSnapshot();
		const idx = after ? colIdx + 1 : colIdx;
		this.tableData.forEach(row => row.splice(idx, 0, ""));
		this.refresh();
		this.requestSave();
	}
	private refreshDeleteCol(colIdx: number) {
		const first = this.tableData[0];
		if (!first || first.length <= 1) return;
		this.saveSnapshot();
		this.tableData.forEach(row => row.splice(colIdx, 1));
		this.refresh();
		this.requestSave();
	}
}
