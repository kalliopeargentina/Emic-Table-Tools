import type { App } from "obsidian";
import type { TFile } from "obsidian";
import { Modal, normalizePath, Notice } from "obsidian";
import { rowsToCsv } from "../utils/csv";

export interface CsvExportPlugin {
	app: App;
	settings: { defaultExportFolder: string };
}

export class CsvExportModal extends Modal {
	private readonly rows: string[][];
	private readonly plugin: CsvExportPlugin;
	private readonly sourceFile: TFile | null;

	constructor(app: App, rows: string[][], plugin: CsvExportPlugin, sourceFile: TFile | null) {
		super(app);
		this.rows = rows;
		this.plugin = plugin;
		this.sourceFile = sourceFile;
	}

	onOpen(): void {
		this.setTitle("Export table to CSV");
		const { contentEl } = this;
		const div = contentEl.createDiv({ cls: "emic-table-tools-csv-export" });

		const ta = div.createEl("textarea", {
			attr: { readonly: "true", rows: "12" },
		});
		ta.value = rowsToCsv(this.rows, true);
		ta.addEventListener("click", () => ta.select());

		const lb = div.createEl("label");
		const cb = lb.createEl("input", { type: "checkbox", attr: { checked: "checked" } });
		lb.createSpan().setText(" Include table headers");
		cb.addEventListener("change", () => {
			ta.value = rowsToCsv(this.rows, cb.checked);
		});
		div.appendChild(lb);

		const btnWrap = div.createDiv({ cls: "emic-table-tools-csv-actions" });
		const saveBtn = btnWrap.createEl("button", { text: "Save to file" });
		saveBtn.addEventListener("click", () => this.saveToFile(cb.checked));
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async saveToFile(includeHeader: boolean): Promise<void> {
		const folder = this.plugin.settings.defaultExportFolder?.trim() ?? "";
		if (!folder) {
			new Notice("Set default export folder in Settings → Emic Table Tools.");
			return;
		}
		const content = rowsToCsv(this.rows, includeHeader);
		const baseName = (this.sourceFile?.basename ?? "export") + "-table";
		let filename = baseName + ".csv";
		let fullPath = normalizePath(folder + "/" + filename);
		let n = 0;
		while (this.plugin.app.vault.getAbstractFileByPath(fullPath)) {
			n += 1;
			filename = baseName + "-" + n + ".csv";
			fullPath = normalizePath(folder + "/" + filename);
		}
		try {
			await this.plugin.app.vault.create(fullPath, content);
			new Notice("Saved to " + fullPath);
		} catch (e) {
			new Notice("Could not save file: " + (e instanceof Error ? e.message : String(e)));
		}
	}
}
