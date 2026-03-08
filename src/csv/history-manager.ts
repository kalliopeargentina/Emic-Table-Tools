import { Notice } from "obsidian";
import { i18n } from "./i18n";

export class HistoryManager<T> {
	private history: T[] = [];
	private currentIndex: number = -1;
	private maxSize: number;

	constructor(initialState?: T, maxSize: number = 50) {
		this.maxSize = maxSize;
		if (initialState) {
			this.push(initialState);
		}
	}

	push(state: T): void {
		if (this.currentIndex < this.history.length - 1) {
			this.history = this.history.slice(0, this.currentIndex + 1);
		}
		this.history.push(this.cloneState(state));
		if (this.history.length > this.maxSize) {
			this.history.shift();
		} else {
			this.currentIndex++;
		}
	}

	undo(): T | null {
		if (this.canUndo()) {
			this.currentIndex--;
			new Notice(i18n.t("notifications.undo"));
			return this.getCurrentState();
		}
		new Notice(i18n.t("notifications.noMoreUndo"));
		return null;
	}

	redo(): T | null {
		if (this.canRedo()) {
			this.currentIndex++;
			new Notice(i18n.t("notifications.redo"));
			return this.getCurrentState();
		}
		new Notice(i18n.t("notifications.noMoreRedo"));
		return null;
	}

	getCurrentState(): T | null {
		if (
			this.currentIndex >= 0 &&
			this.currentIndex < this.history.length
		) {
			const state = this.history[this.currentIndex];
			return state != null ? this.cloneState(state) : null;
		}
		return null;
	}

	canUndo(): boolean {
		return this.currentIndex > 0;
	}

	canRedo(): boolean {
		return this.currentIndex < this.history.length - 1;
	}

	reset(initialState?: T): void {
		this.history = [];
		this.currentIndex = -1;
		if (initialState) {
			this.push(initialState);
		}
	}

	protected cloneState(state: T): T {
		if (Array.isArray(state)) {
			if (state.length > 0 && Array.isArray(state[0])) {
				return state.map((row) => [...row]) as unknown as T;
			}
			return [...state] as unknown as T;
		}
		if (typeof state === "object" && state !== null) {
			return JSON.parse(JSON.stringify(state));
		}
		return state;
	}
}

export class TableHistoryManager extends HistoryManager<string[][]> {
	protected override cloneState(state: string[][]): string[][] {
		return state.map((row) => [...row]);
	}
}
