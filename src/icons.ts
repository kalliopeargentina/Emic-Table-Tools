import { addIcon } from "obsidian";

/** Transpose icon (from Advanced Tables for Obsidian, GPL-3.0). viewBox 0 0 100 100 for Obsidian/mobile. */
const TRANSPOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="scale(3.125)" fill="currentColor"><path d="m19 26h-5v-2h5a5.0055 5.0055 0 0 0 5-5v-5h2v5a7.0078 7.0078 0 0 1-7 7z"/><path d="M8,30H4a2.0023,2.0023,0,0,1-2-2V14a2.0023,2.0023,0,0,1,2-2H8a2.0023,2.0023,0,0,1,2,2V28A2.0023,2.0023,0,0,1,8,30ZM4,14V28H8V14Z"/><path d="M28,10H14a2.0023,2.0023,0,0,1-2-2V4a2.0023,2.0023,0,0,1,2-2H28a2.0023,2.0023,0,0,1,2,2V8A2.0023,2.0023,0,0,1,28,10ZM14,4V8H28V4Z"/></g></svg>`;

export function addTransposeIcon(): void {
	addIcon("transpose", TRANSPOSE_ICON);
}
