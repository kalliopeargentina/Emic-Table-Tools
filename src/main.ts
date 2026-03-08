import { Menu, Plugin, Notice } from "obsidian";
import type { TFile } from "obsidian";
import { DEFAULT_SETTINGS, EmicTableToolsSettings, EmicTableToolsSettingTab } from "./settings";
import { exportTableToCsv } from "./commands/export-table-csv";
import { insertCsvAsMarkdown } from "./commands/insert-csv-as-markdown";
import { assignTableBlockId } from "./commands/assign-table-block-id";
import { transposeTable } from "./commands/transpose-table";
import { assignAllTablesBlockId } from "./commands/assign-all-tables-block-id";
import { addTransposeIcon } from "./icons";
import { cursorIsInTable } from "./utils/table-detection";
import { TableContextResolver } from "./table-context/resolver";
import { CSVView, VIEW_TYPE_CSV } from "./csv/csv-view";
import { CSVSourceView, VIEW_TYPE_CSV_SOURCE } from "./csv/csv-source-view";
import { i18n } from "./csv/i18n";
import { FileUtils } from "./csv/file-utils";

export default class EmicTableToolsPlugin extends Plugin {
	settings: EmicTableToolsSettings;
	private readonly tableContextResolver = new TableContextResolver();

	async onload() {
		await this.loadSettings();
		this.tableContextResolver.setApp(this.app);
		addTransposeIcon();

		const moment = (window as unknown as { moment?: { locale: () => string } }).moment;
		if (moment?.locale) {
			i18n.setLocale(moment.locale());
		}

		this.registerView(VIEW_TYPE_CSV, (leaf) => new CSVView(leaf));
		this.registerView(VIEW_TYPE_CSV_SOURCE, (leaf) => new CSVSourceView(leaf));
		this.registerExtensions(["csv"], VIEW_TYPE_CSV);

		this.addCommand({
			id: "emic-csv-create-new",
			name: i18n.t("commands.createNewCsv"),
			icon: "file-plus",
			callback: () => {
				const folder = this.settings.defaultExportFolder?.trim() ?? "";
				this.createNewCsvInFolder(folder);
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addItem((item) =>
					item
						.setTitle(i18n.t("contextMenu.createNewCsv"))
						.setIcon("file-plus")
						.onClick(() => {
							let defaultFolder = "";
							const fp = (file as unknown as { path?: string })?.path;
							if (typeof fp === "string") {
								const idx = fp.lastIndexOf("/");
								if (idx > 0) defaultFolder = fp.substring(0, idx);
							}
							this.createNewCsvInFolder(defaultFolder);
						})
				);
			})
		);

		this.addCommand({
			id: "export-table-csv",
			name: "Export table to CSV",
			icon: "file-spreadsheet",
			editorCheckCallback: (checking, editor) => {
				if (checking) return cursorIsInTable(editor);
				exportTableToCsv(this, this.tableContextResolver);
				return undefined;
			},
		});

		this.addCommand({
			id: "assign-table-block-id",
			name: "Asignar block-id a esta tabla",
			icon: "hash",
			editorCheckCallback: (checking, editor) => {
				if (checking) return cursorIsInTable(editor);
				assignTableBlockId(this, this.tableContextResolver);
				return undefined;
			},
		});

		this.addCommand({
			id: "assign-all-tables-block-id",
			name: "Asignar block-id a todas las tablas de esta nota que no tengan",
			icon: "list",
			editorCallback: (editor) => {
				assignAllTablesBlockId(this);
			},
		});

		this.addCommand({
			id: "transpose-table",
			name: "Transponer Tabla",
			icon: "transpose",
			editorCheckCallback: (checking, editor) => {
				if (checking) return cursorIsInTable(editor);
				transposeTable(this, this.tableContextResolver);
				return undefined;
			},
		});

		this.addCommand({
			id: "insert-csv-as-markdown",
			name: i18n.t("commands.insertCsvAsMarkdown"),
			icon: "file-spreadsheet",
			callback: () => insertCsvAsMarkdown(this),
		});

		// Capture phase improves reliability in Live Preview where internal handlers may stop bubbling.
		this.registerDomEvent(
			document,
			"contextmenu",
			(evt) => this.tableContextResolver.setContextMenuEvent(evt),
			{ capture: true }
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				const context = this.tableContextResolver.resolveForEditorMenu(editor);
				// When cursor is in a table: show table actions only. When not in a table: show insert CSV only.
				menu.addItem((item) => {
					item.setTitle("Table Tools");
					const submenu = (
						item as unknown as { setSubmenu(): Menu }
					).setSubmenu();
					if (context) {
						submenu.addItem((subItem) =>
							subItem
								.setIcon("file-spreadsheet")
								.setTitle("Export table to CSV")
								.onClick(() =>
									exportTableToCsv(
										this,
										this.tableContextResolver,
										context
									)
								)
						);
						submenu.addItem((subItem) =>
							subItem
								.setIcon("hash")
								.setTitle("Asignar block-id a esta tabla")
								.onClick(() =>
									assignTableBlockId(
										this,
										this.tableContextResolver,
										context
									)
								)
						);
						submenu.addItem((subItem) =>
							subItem
								.setIcon("transpose")
								.setTitle("Transponer Tabla")
								.onClick(() =>
									transposeTable(
										this,
										this.tableContextResolver,
										context
									)
								)
						);
					} else {
						submenu.addItem((subItem) =>
							subItem
								.setIcon("file-spreadsheet")
								.setTitle(i18n.t("commands.insertCsvAsMarkdown"))
								.onClick(() => insertCsvAsMarkdown(this, editor))
						);
					}
				});
			})
		);

		this.addSettingTab(new EmicTableToolsSettingTab(this.app, this));
	}

	// No teardown required.
	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<EmicTableToolsSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async createNewCsvInFolder(folder: string): Promise<TFile | null> {
		const baseName = "new.csv";
		let name = baseName;
		let idx = 0;
		while (
			this.app.vault.getAbstractFileByPath(
				folder ? `${folder}/${name}` : name
			)
		) {
			idx++;
			name = `new-${idx}.csv`;
			if (idx > 1000) {
				new Notice(i18n.t("modal.errors.createFailed"));
				return null;
			}
		}
		const path = folder ? `${folder}/${name}` : name;
		try {
			await FileUtils.withRetry(() => this.app.vault.create(path, ""));
			const created = this.app.vault.getAbstractFileByPath(path) as TFile | null;
			if (created) {
				await this.app.workspace.getLeaf(true).openFile(created);
			}
			return created;
		} catch (err) {
			console.error("CreateCsv: failed to create file", err);
			new Notice(i18n.t("modal.errors.createFailed"));
			return null;
		}
	}
}
