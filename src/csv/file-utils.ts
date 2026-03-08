/**
 * File operations with retry logic. Ported from csv-lite (LIUBINfighter).
 */
import { Notice } from "obsidian";

export class FileUtils {
	static async withRetry<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		delayMs: number = 500
	): Promise<T> {
		let lastError: Error = new Error("Unknown error occurred");
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;
				const isFileBusyError =
					error instanceof Error &&
					(error.message.includes("EBUSY") ||
						error.message.includes("busy") ||
						error.message.includes("locked"));
				if (!isFileBusyError || attempt === maxRetries) break;
				if (attempt === 0) {
					new Notice(
						`File is busy. Retrying... (${attempt + 1}/${maxRetries})`
					);
				}
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}
		throw lastError;
	}
}
