export class VocabularyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function normalizeSelection(selection) {
  const text = typeof selection?.text === "string" ? selection.text.trim() : "";
  if (!text) throw new VocabularyError("selectWord");
  if (text.length > 5000) throw new VocabularyError("selectionTooLong");
  let url;
  try {
    url = new URL(selection.url);
  } catch {
    throw new VocabularyError("sourceUnavailable");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new VocabularyError("restrictedPage");
  }
  return {
    text,
    title: typeof selection.title === "string" ? selection.title : "",
    url: url.href,
  };
}

export function readEntries(value) {
  if (value === undefined) return [];
  if (!value || value.version !== 1 || !Array.isArray(value.entries)) {
    throw new VocabularyError("storedDataInvalid");
  }
  const ids = new Set();
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id ||
      ids.has(entry.id) ||
      typeof entry.text !== "string" ||
      !entry.text.trim() ||
      typeof entry.title !== "string" ||
      typeof entry.url !== "string" ||
      !/^https?:\/\//i.test(entry.url) ||
      typeof entry.savedAt !== "string" ||
      !Number.isFinite(Date.parse(entry.savedAt))
    ) {
      throw new VocabularyError("storedDataInvalid");
    }
    ids.add(entry.id);
  }
  return [...value.entries].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function csvCell(value) {
  let text = String(value);
  // Spreadsheet applications can interpret even quoted cells as formulas.
  if (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(entries, headings) {
  if (!Array.isArray(headings) || headings.length !== 4)
    throw new Error("Four CSV column headings are required");
  const rows = [
    headings,
    ...entries.map(({ text, title, url, savedAt }) => [
      text,
      title,
      url,
      savedAt,
    ]),
  ];
  return (
    "\uFEFF" +
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
