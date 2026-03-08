import { zhCN } from "./zh-cn";
import { enUS } from "./en";
import { esES } from "./es";

export const LOCALE = {
	"zh-cn": zhCN,
	en: enUS,
	es: esES,
};

export type Locale = keyof typeof LOCALE;

export class I18n {
	private locale: Locale = "en";

	constructor(locale?: string) {
		this.setLocale(locale || "en");
	}

	setLocale(locale: string): void {
		const lowerLocale = locale.toLowerCase();
		let targetLocale: Locale = "en";
		if (lowerLocale.startsWith("zh")) {
			targetLocale = "zh-cn";
		} else if (lowerLocale.startsWith("en")) {
			targetLocale = "en";
		} else if (lowerLocale.startsWith("es")) {
			targetLocale = "es";
		}
		if (targetLocale in LOCALE) {
			this.locale = targetLocale;
		} else {
			this.locale = "en";
		}
	}

	t(key: string, params?: Record<string, string | number>): string {
		let translatedText = this.getTranslation(key, this.locale);
		if (translatedText === null && this.locale !== "en") {
			translatedText = this.getTranslation(key, "en");
		}
		let result: string = translatedText ?? key;
		if (params) {
			for (const [paramKey, value] of Object.entries(params)) {
				result = result.replace(
					new RegExp(`\\{${paramKey}\\}`, "g"),
					String(value)
				);
			}
		}
		return result;
	}

	private getTranslation(key: string, locale: Locale): string | null {
		const translation = LOCALE[locale] as Record<string, unknown>;
		const keys = key.split(".");
		let result: unknown = translation;
		for (const k of keys) {
			if (result && typeof result === "object" && k in result) {
				result = (result as Record<string, unknown>)[k];
			} else {
				return null;
			}
		}
		return typeof result === "string" ? result : null;
	}

	getCurrentLocale(): Locale {
		return this.locale;
	}
}

export const i18n = new I18n();

export { enUS } from "./en";
export { zhCN } from "./zh-cn";
export { esES } from "./es";
