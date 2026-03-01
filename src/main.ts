import type { Editor } from "obsidian";
import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";
import { exportRowsToCsv, exportTableToCsv } from "./commands/export-table-csv";
import { cursorIsInTable, getTableAtLine } from "./utils/table-detection";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private lastContextMenuPos: {
		x: number;
		y: number;
		ts: number;
		targetIsTable: boolean;
		target: Element | null;
	} | null = null;

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

		const onContextMenu = (evt: MouseEvent) => {
			const composedPath = typeof evt.composedPath === "function" ? evt.composedPath() : [];
			const pointTargets =
				typeof document.elementsFromPoint === "function"
					? document.elementsFromPoint(evt.clientX, evt.clientY)
					: [];
			const bestTarget =
				pointTargets.find((el) => el.classList.contains("table-cell-wrapper")) ??
				pointTargets.find((el) => el.matches("td,th")) ??
				pointTargets.find((el) => el.classList.contains("cm-table-widget")) ??
				pointTargets.find((el) => el.closest("table") !== null) ??
				(evt.target instanceof Element ? evt.target : null);
			const targetIsTable =
				(bestTarget instanceof Element && bestTarget.closest("table") !== null) ||
				pointTargets.some((el) => el.closest("table") !== null) ||
				composedPath.some(
					(node) => node instanceof Element && (node.matches("table") || node.closest("table"))
				);
			this.lastContextMenuPos = {
				x: evt.clientX,
				y: evt.clientY,
				ts: Date.now(),
				targetIsTable,
				target: bestTarget,
			};
		};
		// Capture phase improves reliability in Live Preview where internal handlers may stop bubbling.
		this.registerDomEvent(document, "contextmenu", onContextMenu, { capture: true });

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				const preferredLine = this.resolvePreferredLine(editor);
				const domRows = this.extractRowsFromClickedTable();
				if (typeof preferredLine === "number" || !!domRows?.length) {
					menu.addItem((item) =>
						item
							.setTitle("Export table to CSV")
							.onClick(() => {
								if (typeof preferredLine === "number") {
									exportTableToCsv(this, preferredLine);
								} else if (domRows?.length) {
									exportRowsToCsv(this, domRows);
								}
							})
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

	private resolvePreferredLine(editor: Editor): number | undefined {
		const recentContextMenu =
			this.lastContextMenuPos && Date.now() - this.lastContextMenuPos.ts < 15000
				? this.lastContextMenuPos
				: null;

		// Strict right-click mode:
		// If menu came from a mouse contextmenu, only show export when the click target is in a table.
		if (recentContextMenu) {
			if (!recentContextMenu.targetIsTable) {
				return undefined;
			}

			// Prefer DOM-based mapping first (most reliable for rendered Live Preview widgets),
			// then fallback to coordinate mapping.
			const fromDom = this.mapTargetToLine(editor, recentContextMenu.target);
			const fromPointLineEl = this.mapLineElementAtPointToLine(
				editor,
				recentContextMenu.x,
				recentContextMenu.y
			);
			const fromCoords = this.mapCoordsToLine(editor, recentContextMenu.x, recentContextMenu.y);

			const mappedLine =
				typeof fromDom === "number"
					? fromDom
					: typeof fromPointLineEl === "number"
						? fromPointLineEl
						: fromCoords;
			if (typeof mappedLine === "number") {
				// Small probe only; do not scan far away and accidentally match another table.
				for (const delta of [0, -1, 1]) {
					const probe = mappedLine + delta;
					if (getTableAtLine(editor, probe)) {
						return probe;
					}
				}
			}

			// Last strict fallback: probe nearby click coordinates (small offsets) to account for
			// table widget hitboxes that don't map directly at exact click x/y.
			const fromCoordProbes = this.findTableFromCoordProbes(
				editor,
				recentContextMenu.x,
				recentContextMenu.y
			);
			if (typeof fromCoordProbes === "number") {
				return fromCoordProbes;
			}

			return undefined;
		}

		const cursorLine = editor.getCursor().line;
		if (getTableAtLine(editor, cursorLine)) return cursorLine;
		return undefined;
	}

	private mapTargetToLine(editor: Editor, target: EventTarget | null): number | undefined {
		if (!(target instanceof Node)) return undefined;
		const cmAny = (editor as unknown as { cm?: any }).cm;
		const cm6 = cmAny?.cm ?? cmAny;
		if (!cm6 || typeof cm6.posAtDOM !== "function") return undefined;
		if (!cm6.dom || typeof cm6.dom.contains !== "function") return undefined;
		if (!cm6.dom.contains(target)) {
			return undefined;
		}
		try {
			const offset = cm6.posAtDOM(target, 0);
			if (typeof offset !== "number") return undefined;
			const line = cm6.state?.doc?.lineAt?.(offset)?.number;
			return typeof line === "number" ? line - 1 : undefined;
		} catch {
			return undefined;
		}
	}

	private mapLineElementAtPointToLine(editor: Editor, x: number, y: number): number | undefined {
		const cmAny = (editor as unknown as { cm?: any }).cm;
		const cm6 = cmAny?.cm ?? cmAny;
		if (!cm6 || typeof cm6.posAtDOM !== "function" || !cm6.dom?.contains) return undefined;
		const els =
			typeof document.elementsFromPoint === "function"
				? document.elementsFromPoint(x, y)
				: [];
		const lineEl = els.find(
			(el) => el.classList.contains("cm-line") && cm6.dom.contains(el)
		);
		if (!lineEl) return undefined;
		try {
			const offset = cm6.posAtDOM(lineEl, 0);
			if (typeof offset !== "number") return undefined;
			const line = cm6.state?.doc?.lineAt?.(offset)?.number;
			return typeof line === "number" ? line - 1 : undefined;
		} catch {
			return undefined;
		}
	}

	private findTableFromCoordProbes(editor: Editor, x: number, y: number): number | undefined {
		const offsets: Array<[number, number]> = [
			[0, 0],
			[12, 0],
			[24, 0],
			[-12, 0],
			[0, 8],
			[0, -8],
			[12, 8],
			[12, -8],
			[24, 8],
			[24, -8],
		];

		for (const [dx, dy] of offsets) {
			const line = this.mapCoordsToLine(editor, x + dx, y + dy);
			if (typeof line !== "number") continue;
			for (const delta of [0, -1, 1]) {
				const probe = line + delta;
				if (getTableAtLine(editor, probe)) {
					return probe;
				}
			}
		}

		return undefined;
	}

	private mapCoordsToLine(editor: Editor, x: number, y: number): number | undefined {
		const cmAny = (editor as unknown as { cm?: any }).cm;

		// CM6 path (preferred)
		const cm6 = cmAny?.cm ?? cmAny;
		if (cm6 && typeof cm6.posAtCoords === "function") {
			const preciseOffset = cm6.posAtCoords({ x, y }, true);
			const offset = typeof preciseOffset === "number" ? preciseOffset : cm6.posAtCoords({ x, y });
			if (typeof offset === "number") {
				const line = cm6.state?.doc?.lineAt?.(offset)?.number;
				return typeof line === "number" ? line - 1 : undefined; // CM is 1-based line numbers.
			}
		}

		// CM5 fallback path (for editor wrappers exposing coordsChar)
		if (cmAny && typeof cmAny.coordsChar === "function") {
			const pos = cmAny.coordsChar({ left: x, top: y });
			const line = pos?.line;
			return typeof line === "number" ? line : undefined;
		}
		return undefined;
	}

	private extractRowsFromClickedTable(): string[][] | null {
		const target = this.lastContextMenuPos?.target;
		if (!(target instanceof Element)) return null;
		const table = target.closest("table");
		if (!table) return null;

		const rows: string[][] = [];
		const rowEls = Array.from(table.querySelectorAll("tr"));
		for (const rowEl of rowEls) {
			const cellEls = Array.from(rowEl.querySelectorAll("th,td"));
			if (!cellEls.length) continue;
			rows.push(cellEls.map((cell) => (cell.textContent ?? "").trim()));
		}

		return rows.length ? rows : null;
	}

}
