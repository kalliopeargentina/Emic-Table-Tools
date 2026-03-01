import type { App } from "obsidian";
import { Modal, TFolder } from "obsidian";

function collectFolderPaths(folder: TFolder, paths: string[]): void {
	paths.push(folder.path);
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectFolderPaths(child, paths);
		}
	}
}

export class FolderPickerModal extends Modal {
	private readonly onChoose: (path: string) => void;

	constructor(app: App, onChoose: (path: string) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	onOpen(): void {
		this.setTitle("Choose export folder");
		const { contentEl } = this;
		const paths: string[] = [];
		const root = this.app.vault.getRoot();
		collectFolderPaths(root, paths);

		const list = contentEl.createDiv({ cls: "emic-table-tools-folder-list" });
		for (const path of paths) {
			const item = list.createDiv({ cls: "emic-table-tools-folder-item" });
			item.setText(path || "(vault root)");
			item.addEventListener("click", () => {
				this.onChoose(path);
				this.close();
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
