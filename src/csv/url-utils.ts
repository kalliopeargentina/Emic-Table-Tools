/**
 * URL detection and rendering in cells. Ported from csv-lite (LIUBINfighter).
 */
const URL_PATTERN =
	/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

export function containsUrl(text: string): boolean {
	return new RegExp(URL_PATTERN.source).test(text) ||
		new RegExp(MARKDOWN_LINK_PATTERN.source).test(text);
}

export interface TextSegment {
	text: string;
	isUrl: boolean;
	url?: string;
	displayText?: string;
}

export function parseTextWithUrls(text: string): TextSegment[] {
	const segments: TextSegment[] = [];
	interface Match {
		index: number;
		length: number;
		displayText: string;
		url: string;
	}
	const matches: Match[] = [];
	let mdMatch: RegExpExecArray | null;
	const markdownRegex = new RegExp(MARKDOWN_LINK_PATTERN);
	while ((mdMatch = markdownRegex.exec(text)) !== null) {
		matches.push({
			index: mdMatch.index,
			length: mdMatch[0].length,
			displayText: mdMatch[1] ?? "",
			url: mdMatch[2] ?? "",
		});
	}
	const urlRegex = new RegExp(URL_PATTERN);
	let urlMatch: RegExpExecArray | null;
	while ((urlMatch = urlRegex.exec(text)) !== null) {
		const isPartOfMarkdown = matches.some(
			(m) =>
				urlMatch!.index >= m.index &&
				urlMatch!.index < m.index + m.length
		);
		if (!isPartOfMarkdown) {
			matches.push({
				index: urlMatch.index,
				length: urlMatch[0].length,
				displayText: urlMatch[0],
				url: urlMatch[0],
			});
		}
	}
	matches.sort((a, b) => a.index - b.index);
	let lastIndex = 0;
	for (const match of matches) {
		if (match.index > lastIndex) {
			segments.push({
				text: text.substring(lastIndex, match.index),
				isUrl: false,
			});
		}
		segments.push({
			text: match.displayText,
			isUrl: true,
			url: match.url,
			displayText: match.displayText,
		});
		lastIndex = match.index + match.length;
	}
	if (lastIndex < text.length) {
		segments.push({ text: text.substring(lastIndex), isUrl: false });
	}
	if (segments.length === 0) {
		segments.push({ text, isUrl: false });
	}
	return segments;
}

export function createUrlDisplay(
	text: string,
	onClick?: () => void
): HTMLElement {
	const display = document.createElement("div");
	display.className = "csv-cell-display";
	const segments = parseTextWithUrls(text);
	for (const segment of segments) {
		if (segment.isUrl && segment.url) {
			const link = document.createElement("a");
			link.href = segment.url;
			link.textContent = segment.displayText || segment.text;
			link.className = "csv-cell-link";
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			link.onclick = (e) => e.stopPropagation();
			display.appendChild(link);
		} else {
			const span = document.createElement("span");
			span.textContent = segment.text;
			display.appendChild(span);
		}
	}
	if (onClick) {
		const editBtn = document.createElement("span");
		editBtn.className = "csv-cell-edit-btn";
		editBtn.textContent = "\u270E";
		editBtn.title = "Click to edit";
		editBtn.onclick = (e) => {
			e.stopPropagation();
			onClick();
		};
		display.appendChild(editBtn);
		display.onclick = (e) => {
			if ((e.target as HTMLElement).tagName !== "A") onClick();
		};
	}
	return display;
}
