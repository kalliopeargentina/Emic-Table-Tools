import { TableUtils } from "../table-utils";
import { i18n } from "../i18n";

export interface EditBarOptions {
	editBarEl: HTMLElement;
	editInput: HTMLInputElement;
	activeCellEl: HTMLInputElement | null;
	activeRowIndex: number;
	activeColIndex: number;
	tableData: string[][];
	onEdit: (row: number, col: number, value: string) => void;
}

export function renderEditBar(options: EditBarOptions): void {
	const {
		editBarEl,
		editInput,
		activeCellEl,
		activeRowIndex,
		activeColIndex,
		tableData,
		onEdit,
	} = options;

	if (activeCellEl) {
		editInput.value = activeCellEl.value;
		const cellAddress = TableUtils.getCellAddress(activeRowIndex, activeColIndex);
		editBarEl.setAttribute("data-cell-address", cellAddress);
		if (!activeCellEl.value) {
			editInput.placeholder = cellAddress;
		} else {
			editInput.placeholder = "";
		}
	} else {
		editInput.value = "";
		editInput.placeholder = i18n.t("editBar.placeholder");
		editBarEl.removeAttribute("data-cell-address");
	}

	editInput.oninput = null;
	editInput.oninput = () => {
		if (
			activeCellEl &&
			activeRowIndex >= 0 &&
			activeColIndex >= 0
		) {
			activeCellEl.value = editInput.value;
			if (tableData[activeRowIndex]?.[activeColIndex] !== editInput.value) {
				onEdit(activeRowIndex, activeColIndex, editInput.value);
			}
		}
	};
}
