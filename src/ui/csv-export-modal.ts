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
	private readonly blockId: string | null;

	constructor(
		app: App,
		rows: string[][],
		plugin: CsvExportPlugin,
		sourceFile: TFile | null,
		blockId: string | null
	) {
		super(app);
		this.rows = rows;
		this.plugin = plugin;
		this.sourceFile = sourceFile;
		this.blockId = blockId;
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

		const lb = div.createEl("label", { attr: { for: "emic-csv-include-header" } });
		const cb = lb.createEl("input", {
			type: "checkbox",
			attr: { id: "emic-csv-include-header", checked: "checked" },
		});
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

	private buildFilename(): string {
		const noteName = this.sourceFile?.basename ?? "export";
		const sanitize = (s: string) =>
			s.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-") || "table";

		// Prefer block ID (^table-1-example) over first header cell
		const tableName =
			this.blockId ?? (this.rows[0]?.[0]?.trim() ? sanitize(this.rows[0][0].trim()) : null);

		if (tableName) {
			return `${noteName}-${tableName}.csv`;
		}
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const ts =
			now.getFullYear() +
			pad(now.getMonth() + 1) +
			pad(now.getDate()) +
			"-" +
			pad(now.getHours()) +
			pad(now.getMinutes()) +
			pad(now.getSeconds());
		return `${noteName}-unnamedtable-${ts}.csv`;
	}

	private async saveToFile(includeHeader: boolean): Promise<void> {
		const folder = this.plugin.settings.defaultExportFolder?.trim() ?? "";
		if (!folder) {
			new Notice("Set default export folder in Settings → Emic Table Tools.");
			return;
		}
		const content = rowsToCsv(this.rows, includeHeader);
		let filename = this.buildFilename();
		let fullPath = normalizePath(folder + "/" + filename);
		let n = 0;
		const baseName = filename.replace(/\.csv$/i, "");
		while (this.plugin.app.vault.getAbstractFileByPath(fullPath)) {
			n += 1;
			filename = baseName + "-" + n + ".csv";
			fullPath = normalizePath(folder + "/" + filename);
		}
		try {
			await this.plugin.app.vault.create(fullPath, content);
			new Notice("Saved to " + fullPath);
			this.close();
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			new Notice("Could not save file: " + message);
		}
	}
}
