/**
 * CSV source (raw text) view. Ported from csv-lite (LIUBINfighter).
 */
import {
	TextFileView,
	WorkspaceLeaf,
	TFile,
} from "obsidian";
import { VIEW_TYPE_CSV } from "./csv-view";
import {
	EditorState,
	Extension,
	RangeSetBuilder,
} from "@codemirror/state";
import {
	EditorView,
	keymap,
	placeholder,
	lineNumbers,
	drawSelection,
	Decoration,
	ViewPlugin,
	ViewUpdate,
	DecorationSet,
} from "@codemirror/view";
import {
	defaultKeymap,
	history,
	historyKeymap,
} from "@codemirror/commands";

export const VIEW_TYPE_CSV_SOURCE = "emic-csv-source-view";

const separatorHighlightPlugin = ViewPlugin.fromClass(
	class SepPlugin {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = getSeparatorDecorations(view);
		}
		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = getSeparatorDecorations(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations }
);

function getSeparatorDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const sepRegex = /[;, ]/g;
	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		let match: RegExpExecArray | null;
		while ((match = sepRegex.exec(text)) !== null) {
			const start = from + match.index;
			builder.add(
				start,
				start + 1,
				Decoration.mark({ class: "csv-separator-highlight" })
			);
		}
	}
	return builder.finish();
}

export class CSVSourceView extends TextFileView {
	private editor: EditorView;
	public file: TFile | null;
	public headerEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.file = (this as unknown as { file: TFile | null }).file;
		this.headerEl = (this as unknown as { headerEl: HTMLElement }).headerEl;
	}

	getViewType(): string {
		return VIEW_TYPE_CSV_SOURCE;
	}

	getDisplayText(): string {
		return this.file ? `CSV source: ${this.file.basename}` : "CSV source";
	}

	getIcon(): string {
		return "file-code";
	}

	async onOpen(): Promise<void> {
		const actionsEl = this.headerEl?.querySelector?.(".view-actions");
		if (actionsEl && !actionsEl.querySelector(".csv-switch-table")) {
			const btn = document.createElement("button");
			btn.className = "clickable-icon csv-switch-table";
			btn.setAttribute("aria-label", "Switch to table mode");
			btn.innerHTML = " ";
			btn.onclick = async () => {
				const file = this.file;
				if (!file) return;
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CSV);
				let found = false;
				for (const leaf of leaves) {
					const v = leaf.view as unknown as { file?: TFile };
					if (v?.file?.path === file.path) {
						this.app.workspace.setActiveLeaf(leaf, true, true);
						found = true;
						break;
					}
				}
				if (!found) {
					const newLeaf = this.app.workspace.getLeaf(true);
					await newLeaf.openFile(file, { active: true });
					await newLeaf.setViewState({
						type: VIEW_TYPE_CSV,
						active: true,
						state: { file: file.path },
					});
					this.app.workspace.setActiveLeaf(newLeaf, true, true);
				}
			};
			actionsEl.appendChild(btn);
		}

		const container = this.containerEl.children[1] as HTMLElement;
		while (container.firstChild) container.removeChild(container.firstChild);

		const editorContainer = container.createDiv({
			cls: "csv-source-editor-container",
		});
		const cmContainer = editorContainer.createDiv({
			cls: "csv-source-cm-container",
		});

		const extensions: Extension[] = [
			lineNumbers(),
			drawSelection(),
			history(),
			keymap.of([...defaultKeymap, ...historyKeymap]),
			separatorHighlightPlugin,
			placeholder("Enter CSV source..."),
			EditorView.lineWrapping,
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.save();
				}
			}),
		];

		const state = EditorState.create({
			doc: (this as unknown as { data: string }).data || "",
			extensions,
		});

		this.editor = new EditorView({
			state,
			parent: cmContainer,
		});

		this.addEditorStyles();
		setTimeout(() => this.editor.focus(), 10);
	}

	private addEditorStyles(): void {
		const style = document.createElement("style");
		style.textContent = `
			.csv-source-editor-container { height: 100%; display: flex; flex-direction: column; }
			.csv-source-cm-container { flex: 1; overflow: auto; height: 100%; }
			.csv-source-cm-container .cm-editor { height: 100%; }
			.csv-source-cm-container .cm-scroller { font-family: var(--font-monospace); font-size: 14px; line-height: 1.5; }
			.csv-source-cm-container .cm-content { padding: 12px; }
			.cm-line .csv-separator-highlight { color: var(--color-accent); font-weight: bold; background: var(--background-modifier-active-hover); border-radius: 2px; }
			.csv-source-cm-container .cm-cursor { border-left: 2px solid var(--color-accent); background: none; opacity: 1; z-index: 10; }
			.csv-source-cm-container .cm-gutters { background: var(--background-secondary); color: var(--text-faint); border-right: 1px solid var(--background-modifier-border); }
		`;
		document.head.appendChild(style);
		this.register(() => {
			if (style.parentNode) document.head.removeChild(style);
		});
	}

	async onClose(): Promise<void> {
		await this.save();
	}

	getViewData(): string {
		return this.editor ? this.editor.state.doc.toString() : ((this as unknown as { data: string }).data ?? "");
	}

	setViewData(data: string, clear: boolean): void {
		if (clear) this.clear();
		(this as unknown as { data: string }).data = data;
		if (this.editor) {
			this.editor.dispatch({
				changes: {
					from: 0,
					to: this.editor.state.doc.length,
					insert: data,
				},
			});
		}
	}

	clear(): void {
		(this as unknown as { data: string }).data = "";
		if (this.editor) {
			this.editor.dispatch({
				changes: {
					from: 0,
					to: this.editor.state.doc.length,
					insert: "",
				},
			});
		}
	}
}
