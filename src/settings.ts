import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";
import { FolderPickerModal } from "./ui/folder-picker-modal";

export interface MyPluginSettings {
	defaultExportFolder: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	defaultExportFolder: ''
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
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
	}
}
