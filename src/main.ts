import { Menu, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, EmicTableToolsSettings, EmicTableToolsSettingTab } from "./settings";
import { exportTableToCsv } from "./commands/export-table-csv";
import { cursorIsInTable } from "./utils/table-detection";
import { TableContextResolver } from "./table-context/resolver";

export default class EmicTableToolsPlugin extends Plugin {
	settings: EmicTableToolsSettings;
	private readonly tableContextResolver = new TableContextResolver();

	async onload() {
		await this.loadSettings();
		this.tableContextResolver.setApp(this.app);

		this.addCommand({
			id: "export-table-csv",
			name: "Export table to CSV",
			editorCheckCallback: (checking, editor) => {
				if (checking) return cursorIsInTable(editor);
				exportTableToCsv(this, this.tableContextResolver);
				return undefined;
			},
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
				if (context) {
					menu.addItem((item) => {
						item.setTitle("Table Tools");
						// Internal Obsidian API: setSubmenu() returns the submenu to add items to.
						const submenu = (
							item as unknown as { setSubmenu(): Menu }
						).setSubmenu();
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
					});
				}
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
}
