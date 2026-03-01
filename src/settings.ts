import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";
import { FolderPickerModal } from "./ui/folder-picker-modal";

export interface MyPluginSettings {
	mySetting: string;
	defaultExportFolder: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
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
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default export folder')
			.setDesc('Folder where CSV files are saved when you click "Save to file" in the export modal.')
			.addText((text) =>
				text
					.setPlaceholder('(none)')
					.setValue(this.plugin.settings.defaultExportFolder)
					.setDisabled(true)
			)
			.addButton((btn) =>
				btn.setButtonText('Choose folder').onClick(() => {
					new FolderPickerModal(this.app, (path) => {
						this.plugin.settings.defaultExportFolder = path;
						this.plugin.saveSettings();
						this.display();
					}).open();
				})
			);
	}
}
