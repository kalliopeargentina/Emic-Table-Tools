import { Notice, MarkdownView, TFile, FuzzySuggestModal, Modal, Setting } from "obsidian";
import type { App, Editor, Plugin, WorkspaceLeaf } from "obsidian";
import { csvRowsToMarkdownTable } from "../utils/csv";
import { CSVView, VIEW_TYPE_CSV } from "../csv/csv-view";
import { CSVUtils } from "../csv/csv-utils";
import { i18n } from "../csv/i18n";

export type DelimiterOption = "auto" | "," | ";" | "\\t";

export interface InsertCsvOptions {
	delimiter: DelimiterOption;
	firstRowAsHeader: boolean;
}

class CsvFileSuggestModal extends FuzzySuggestModal<TFile> {
	private readonly onSelect: (file: TFile | null) => void;
	private chosen = false;
	private files: TFile[] = [];

	constructor(app: App, files: TFile[], onSelect: (file: TFile | null) => void) {
		super(app);
		this.files = files;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		super.onOpen();
		this.setTitle(i18n.t("modal.chooseCsvFile"));
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.chosen = true;
		this.onSelect(item);
	}

	onClose(): void {
		// Defer so onChooseItem (from click) runs first; only resolve null if nothing was selected.
		setTimeout(() => {
			if (!this.chosen) this.onSelect(null);
		}, 0);
	}
}

/**
 * Modal to choose delimiter and "first row as header" before inserting CSV.
 * When showDelimiter is false (e.g. data from CSV view), only the checkbox is shown.
 */
function showInsertCsvOptionsModal(
	plugin: Plugin,
	options: {
		showDelimiter: boolean;
		initialDelimiter: DelimiterOption;
		initialFirstRowAsHeader: boolean;
		onConfirm: (opts: InsertCsvOptions) => void;
		onCancel: () => void;
	}
): void {
	const modal = new Modal(plugin.app);
	modal.setTitle(i18n.t("insertCsv.optionsTitle"));

	let delimiter: DelimiterOption = options.initialDelimiter;
	let firstRowAsHeader = options.initialFirstRowAsHeader;

	modal.contentEl.createDiv({ cls: "emic-insert-csv-options" });

	if (options.showDelimiter) {
		new Setting(modal.contentEl)
			.setName(i18n.t("insertCsv.delimiter"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", "Auto")
					.addOption(",", "Comma")
					.addOption(";", "Semicolon")
					.addOption("\\t", "Tab")
					.setValue(delimiter)
					.onChange((v) => {
						delimiter = v as DelimiterOption;
					})
			);
	}

	new Setting(modal.contentEl)
		.setName(i18n.t("insertCsv.firstRowAsHeader"))
		.addToggle((toggle) =>
			toggle.setValue(firstRowAsHeader).onChange((v) => {
				firstRowAsHeader = v;
			})
		);

	const buttonContainer = modal.contentEl.createDiv({ cls: "emic-insert-csv-buttons" });
	buttonContainer.createEl("button", { text: i18n.t("insertCsv.insertButton"), cls: "mod-cta" }).addEventListener("click", () => {
		modal.close();
		options.onConfirm({ delimiter, firstRowAsHeader });
	});
	buttonContainer.createEl("button", { text: i18n.t("insertCsv.cancelButton") }).addEventListener("click", () => {
		modal.close();
		options.onCancel();
	});

	modal.onClose = () => {
		modal.contentEl.empty();
	};
	modal.open();
}

/**
 * Get CSV rows from an open CSV view, or null if none.
 */
function getCsvDataFromOpenView(plugin: Plugin): string[][] | null {
	const active = plugin.app.workspace.activeLeaf?.view;
	if (active instanceof CSVView && active.tableData?.length) {
		return active.tableData;
	}
	const leaves = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_CSV);
	const view = leaves[0]?.view;
	if (view instanceof CSVView && view.tableData?.length) {
		return view.tableData;
	}
	return null;
}

/**
 * Find the MarkdownView that owns the given editor.
 */
function getMarkdownViewForEditor(plugin: Plugin, editor: Editor): MarkdownView | null {
	let found: MarkdownView | null = null;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (leaf.view instanceof MarkdownView && leaf.view.editor === editor) {
			found = leaf.view;
		}
	});
	return found;
}

/**
 * Find a markdown editor to insert into: active if it's markdown, else first markdown leaf.
 */
function getTargetMarkdownView(plugin: Plugin): MarkdownView | null {
	const active = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (active) return active;
	let found: MarkdownView | null = null;
	plugin.app.workspace.iterateAllLeaves((leaf) => {
		if (found) return;
		if (leaf.view instanceof MarkdownView) {
			found = leaf.view as MarkdownView;
		}
	});
	return found;
}

/**
 * Perform the actual table insert into the given markdown view.
 */
function doInsert(
	plugin: Plugin,
	editor: Editor | undefined,
	markdownView: MarkdownView,
	rows: string[][],
	firstRowAsHeader: boolean
): void {
	if (!editor) {
		let targetLeaf: WorkspaceLeaf | null = null;
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view === markdownView) targetLeaf = leaf;
		});
		if (targetLeaf) {
			plugin.app.workspace.revealLeaf(targetLeaf);
		}
	}
	const tableStr = csvRowsToMarkdownTable(rows, firstRowAsHeader);
	const targetEditor = markdownView.editor;
	const cursor = targetEditor.getCursor();
	const insert = "\n\n" + tableStr + "\n\n";
	targetEditor.replaceRange(insert, cursor);
	targetEditor.setCursor({ line: cursor.line + 2, ch: 0 });
	new Notice(i18n.t("insertCsv.tableInserted"));
}

/**
 * Map delimiter option to value for CSVUtils.parseCSV.
 */
function delimiterOptionToValue(opt: DelimiterOption): string | undefined {
	if (opt === "\\t") return "\t";
	if (opt === "auto" || !opt) return undefined;
	return opt;
}

/**
 * Insert CSV (from open view or picked file) as markdown table into the target note.
 * @param editor - If provided (e.g. from context menu), insert into this editor's note.
 */
export async function insertCsvAsMarkdown(plugin: Plugin, editor?: Editor): Promise<void> {
	const markdownView = editor
		? getMarkdownViewForEditor(plugin, editor)
		: getTargetMarkdownView(plugin);
	if (!markdownView) {
		new Notice(i18n.t("insertCsv.openNoteFirst"));
		return;
	}

	const rowsFromView = getCsvDataFromOpenView(plugin);
	const settings = (plugin as { settings?: { preferredDelimiter?: string } }).settings;
	const preferredDelimiter = (settings?.preferredDelimiter ?? "auto") as DelimiterOption;

	if (rowsFromView) {
		// Data from open CSV view: show options (first row as header only).
		showInsertCsvOptionsModal(plugin, {
			showDelimiter: false,
			initialDelimiter: preferredDelimiter,
			initialFirstRowAsHeader: true,
			onConfirm: (opts) => {
				doInsert(plugin, editor, markdownView, rowsFromView, opts.firstRowAsHeader);
			},
			onCancel: () => {},
		});
		return;
	}

	// No CSV view: show file picker, then options (delimiter + first row as header).
	const files = plugin.app.vault.getFiles().filter((f) => f.extension === "csv");
	if (!files.length) {
		new Notice(i18n.t("insertCsv.noCsvFiles"));
		return;
	}
	const chosen = await chooseCsvFile(plugin, files);
	if (!chosen) {
		new Notice(i18n.t("insertCsv.cancelled"));
		return;
	}

	showInsertCsvOptionsModal(plugin, {
		showDelimiter: true,
		initialDelimiter: preferredDelimiter,
		initialFirstRowAsHeader: true,
		onConfirm: async (opts) => {
			const content = await plugin.app.vault.read(chosen);
			const delim = delimiterOptionToValue(opts.delimiter);
			try {
				const rows = CSVUtils.parseCSV(content, {
					delimiter: delim ?? "auto",
					quoteChar: '"',
				});
				if (!rows?.length) {
					new Notice(i18n.t("insertCsv.emptyCsv"));
					return;
				}
				doInsert(plugin, editor, markdownView, rows, opts.firstRowAsHeader);
			} catch (e) {
				new Notice(
					i18n.t("insertCsv.parseError", { message: (e as Error).message })
				);
			}
		},
		onCancel: () => {
			new Notice(i18n.t("insertCsv.cancelled"));
		},
	});
}

function chooseCsvFile(plugin: Plugin, files: TFile[]): Promise<TFile | null> {
	return new Promise((resolve) => {
		let settled = false;
		const onSelect = (file: TFile | null) => {
			if (settled) return;
			settled = true;
			resolve(file);
		};
		const modal = new CsvFileSuggestModal(plugin.app, files, onSelect);
		modal.open();
	});
}
