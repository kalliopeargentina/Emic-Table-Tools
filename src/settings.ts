import {App, PluginSettingTab, Setting} from "obsidian";
import EmicTableToolsPlugin from "./main";
import { FolderPickerModal } from "./ui/folder-picker-modal";

export interface EmicTableToolsSettings {
	defaultExportFolder: string;
	preferredDelimiter?: "auto" | "," | ";" | "\\t";
	openCsvAfterExport?: boolean;
}

export const DEFAULT_SETTINGS: EmicTableToolsSettings = {
	defaultExportFolder: "",
	preferredDelimiter: "auto",
	openCsvAfterExport: true,
};

export class EmicTableToolsSettingTab extends PluginSettingTab {
	plugin: EmicTableToolsPlugin;

	constructor(app: App, plugin: EmicTableToolsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Default export folder')
			.setDesc('Folder where CSV files are saved when you click "Save to file" in the export modal.')
			.addText((text) =>
				text
					.setPlaceholder('(none)')
					.setValue(this.plugin.settings.defaultExportFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultExportFolder = value ?? '';
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn.setButtonText('Choose folder').onClick(() => {
					new FolderPickerModal(this.app, this.plugin.settings.defaultExportFolder, (path) => {
						this.plugin.settings.defaultExportFolder = path;
						this.plugin.saveSettings();
						this.display();
					}).open();
				})
			);

		new Setting(containerEl)
			.setName('Preferred CSV delimiter')
			.setDesc('Default delimiter when opening CSV files (Auto uses detected value).')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('auto', 'Auto')
					.addOption(',', 'Comma')
					.addOption(';', 'Semicolon')
					.addOption('\\t', 'Tab')
					.setValue(this.plugin.settings.preferredDelimiter ?? 'auto')
					.onChange(async (value) => {
						this.plugin.settings.preferredDelimiter = value as EmicTableToolsSettings['preferredDelimiter'];
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Open CSV after export')
			.setDesc('After exporting a table to CSV, open the new file in the CSV view.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openCsvAfterExport !== false)
					.onChange(async (value) => {
						this.plugin.settings.openCsvAfterExport = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
