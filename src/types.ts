export interface ResolvedTableContext {
	source: "markdown" | "dom";
	rows: string[][];
	blockId: string | null;
	preferredLine?: number;
}
