import type { App } from "obsidian";
import type { Editor } from "obsidian";
import type { ResolvedTableContext } from "../types";
import { extractRowsFromTableTarget } from "./dom-table";
import {
	mapCoordsToLine,
	mapLineElementAtPointToLine,
	mapTargetToLine,
	probeCoordLines,
} from "./editor-position";
import { getTableAtCursor, getTableAtLine, getBlockIdForMatchingTable, findBlockIdForMatchingTableInDocument } from "../utils/table-detection";
import { MarkdownView } from "obsidian";

/** How long (ms) we consider the last context-menu position valid for resolving the table. */
const CONTEXT_MENU_FRESHNESS_MS = 15000;

/** Deltas from mapped line to try when resolving table from context menu (click position can be off by several lines). */
const CONTEXT_MENU_LINE_DELTAS = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5];

interface ContextMenuSnapshot {
	x: number;
	y: number;
	ts: number;
	targetIsTable: boolean;
	target: Element | null;
}

export class TableContextResolver {
	private lastContextMenuPos: ContextMenuSnapshot | null = null;
	private app: App | null = null;

	setApp(app: App): void {
		this.app = app;
	}

	setContextMenuEvent(evt: MouseEvent): void {
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
	}

	/**
	 * Use when the table context comes from the editor context menu (right-click).
	 * Relies on a recent context-menu event to map click position to the table.
	 */
	resolveForEditorMenu(editor: Editor): ResolvedTableContext | null {
		const recentContextMenu =
			this.lastContextMenuPos && Date.now() - this.lastContextMenuPos.ts < CONTEXT_MENU_FRESHNESS_MS
				? this.lastContextMenuPos
				: null;

		if (recentContextMenu) {
			if (!recentContextMenu.targetIsTable) return null;

			const fromDom = mapTargetToLine(editor, recentContextMenu.target);
			const fromPointLineEl = mapLineElementAtPointToLine(
				editor,
				recentContextMenu.x,
				recentContextMenu.y
			);
			const fromCoords = mapCoordsToLine(editor, recentContextMenu.x, recentContextMenu.y);
			const mappedLine =
				typeof fromDom === "number"
					? fromDom
					: typeof fromPointLineEl === "number"
						? fromPointLineEl
						: fromCoords;

			if (typeof mappedLine === "number") {
				const deltas =
					mappedLine === 0 && editor.lineCount() > 10
						? Array.from({ length: Math.min(51, editor.lineCount()) }, (_, i) => i)
						: CONTEXT_MENU_LINE_DELTAS;
				const markdown = this.resolveMarkdownNearLine(editor, mappedLine, deltas);
				if (markdown) return markdown;
			}

			const probeLines = probeCoordLines(editor, recentContextMenu.x, recentContextMenu.y);

			for (const line of probeLines) {
				const deltas =
					line === 0 && editor.lineCount() > 10
						? Array.from({ length: Math.min(51, editor.lineCount()) }, (_, i) => i)
						: CONTEXT_MENU_LINE_DELTAS;
				const markdown = this.resolveMarkdownNearLine(editor, line, deltas);
				if (markdown) return markdown;
			}

			const domRows = extractRowsFromTableTarget(recentContextMenu.target);
			if (domRows?.length) {
				const candidates: number[] = [];
				if (typeof mappedLine === "number") candidates.push(mappedLine);
				for (const ln of probeLines) {
					if (!candidates.includes(ln)) candidates.push(ln);
				}
				const cursorLine = editor.getCursor().line;
				if (!candidates.includes(cursorLine)) candidates.push(cursorLine);

				// When click was in preview or a different pane, the menu's editor may not contain the target.
				// Use the editor that actually contains the clicked element so we search the right file.
				const editorToSearch = this.getEditorContainingTarget(recentContextMenu.target) ?? editor;

				let blockId: string | null = null;
				for (const center of candidates) {
					blockId = getBlockIdForMatchingTable(editorToSearch, domRows, center);
					if (blockId !== null) break;
				}
				if (blockId === null) {
					blockId = findBlockIdForMatchingTableInDocument(editorToSearch, domRows);
				}
				return {
					source: "dom",
					rows: domRows,
					blockId,
				};
			}

			return null;
		}

		return this.resolveForCommand(editor);
	}

	/**
	 * Use when the table context comes from a command (e.g. palette) with cursor in the table.
	 * Resolves the table at the current cursor line.
	 */
	resolveForCommand(editor: Editor): ResolvedTableContext | null {
		const result = getTableAtCursor(editor);
		if (!result) return null;
		return {
			source: "markdown",
			rows: result.rows,
			blockId: result.blockId,
			preferredLine: editor.getCursor().line,
		};
	}

	/**
	 * Find the editor whose pane contains the given DOM node (e.g. the table cell we right-clicked).
	 * When the click is in Reading view or another split, the menu's editor may be wrong; this finds the right one.
	 */
	private getEditorContainingTarget(target: Element | null): Editor | null {
		if (!this.app || !(target instanceof Element)) return null;
		let found: Editor | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) return;
			if (!view.containerEl.contains(target)) return;
			found = view.editor;
		});
		return found;
	}

	private resolveMarkdownNearLine(
		editor: Editor,
		line: number,
		deltas: number[]
	): ResolvedTableContext | null {
		for (const delta of deltas) {
			const probe = line + delta;
			const result = getTableAtLine(editor, probe);
			if (result) {
				return {
					source: "markdown",
					rows: result.rows,
					blockId: result.blockId,
					preferredLine: probe,
				};
			}
		}
		return null;
	}
}
