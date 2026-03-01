import type { App } from "obsidian";
import { Modal } from "obsidian";
import { rowsToCsv } from "../utils/csv";

export class CsvExportModal extends Modal {
	private readonly rows: string[][];

	constructor(app: App, rows: string[][]) {
		super(app);
		this.rows = rows;
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
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
