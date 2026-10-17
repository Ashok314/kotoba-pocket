import { loadResource } from "./resources.js";

export const LANGUAGE_KEY = "ui.language";
const catalogCache = new Map();

export function resolveLanguage(preference, browserLanguage = "en") {
  if (preference === "ja" || preference === "en") return preference;
  return browserLanguage.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function createTranslator(messages) {
  return (key, substitutions = {}) => {
    const message = messages[key]?.message;
    if (typeof message !== "string")
      throw new Error(`Missing translation: ${key}`);
    return message.replace(/\{(\w+)\}/g, (_, name) =>
      String(substitutions[name] ?? `{${name}}`),
    );
  };
}

export async function loadTranslator(language) {
  const locale = resolveLanguage(language);
  if (!catalogCache.has(locale)) {
    const pending = (async () => {
      return createTranslator(
        await loadResource(`_locales/${locale}/messages.json`),
      );
    })();
    catalogCache.set(locale, pending);
    pending.catch(() => catalogCache.delete(locale));
  }
  return catalogCache.get(locale);
}

export async function preferredLanguage() {
  const settings = await chrome.storage.local.get(LANGUAGE_KEY);
  return resolveLanguage(settings[LANGUAGE_KEY], chrome.i18n.getUILanguage());
}
