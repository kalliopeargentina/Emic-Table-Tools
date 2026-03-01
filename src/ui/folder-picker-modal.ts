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
	private readonly allPaths: string[] = [];
	private readonly onChoose: (path: string) => void;
	private listEl: HTMLDivElement;
	private searchInput: HTMLInputElement;

	constructor(app: App, initialSearch: string, onChoose: (path: string) => void) {
		super(app);
		this.onChoose = onChoose;
		const root = this.app.vault.getRoot();
		collectFolderPaths(root, this.allPaths);

		this.searchInput = document.createElement("input");
		this.searchInput.type = "text";
		this.searchInput.placeholder = "Type to search folders…";
		this.searchInput.value = initialSearch ?? "";
		this.searchInput.className = "emic-table-tools-folder-search";
	}

	onOpen(): void {
		this.setTitle("Choose export folder");
		const { contentEl } = this;
		contentEl.appendChild(this.searchInput);
		this.listEl = contentEl.createDiv({ cls: "emic-table-tools-folder-list" });

		const render = () => {
			const q = (this.searchInput.value ?? "").trim().toLowerCase();
			const paths = q
				? this.allPaths.filter((p) => p.toLowerCase().includes(q))
				: [...this.allPaths];
			this.listEl.innerHTML = "";
			for (const path of paths) {
				const item = this.listEl.createDiv({ cls: "emic-table-tools-folder-item" });
				item.setText(path || "(vault root)");
				item.addEventListener("click", () => {
					this.onChoose(path);
					this.close();
				});
			}
		};

		this.searchInput.addEventListener("input", render);
		this.searchInput.addEventListener("keydown", (evt) => {
			if (evt.key === "Escape") this.close();
		});
		render();
		this.searchInput.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
