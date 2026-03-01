import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";
import { exportTableToCsv } from "./commands/export-table-csv";
import { cursorIsInTable } from "./utils/table-detection";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "export-table-csv",
			name: "Export table to CSV",
			editorCheckCallback: (checking, editor) => {
				if (checking) return cursorIsInTable(editor);
				exportTableToCsv(this);
				return undefined;
			},
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				if (cursorIsInTable(editor)) {
					menu.addItem((item) =>
						item.setTitle("Export table to CSV").onClick(() => exportTableToCsv(this))
					);
				}
			})
		);

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyPluginSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
