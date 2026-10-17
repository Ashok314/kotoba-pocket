import { toCsv } from "./core.js";
import { STORAGE_KEY } from "./storage.js";
import {
  LANGUAGE_KEY,
  loadTranslator,
  preferredLanguage,
  resolveLanguage,
} from "./i18n.js";

const list = document.getElementById("entries");
const saveButton = document.getElementById("save");
const exportButton = document.getElementById("export");
const moreButton = document.getElementById("more");
const languageSelect = document.getElementById("language");
const status = document.getElementById("status");
const preview = document.getElementById("selection");
let entries = [];
let tabId;
let visibleCount = 50;
let busy = false;
let loaded = false;
let pageSupported = false;
let selectedText = "";
let previewKey = "previewLoading";
let shortcut = "";
let language = resolveLanguage(null, chrome.i18n.getUILanguage());
let t = (key) => chrome.i18n.getMessage(key);

function setStatus(text, error = false) {
  status.textContent = text;
  status.classList.toggle("error", error);
}

async function send(type, extra = {}) {
  const result = await chrome.runtime.sendMessage({ type, tabId, ...extra });
  if (!result?.ok) throw new Error(t(result?.errorCode || "operationFailed"));
  return result.data;
}

function render() {
  document.getElementById("count").textContent = loaded
    ? entries.length.toLocaleString(language)
    : "—";
  document
    .getElementById("count")
    .setAttribute("aria-label", t("countLabel", { count: entries.length }));
  document.getElementById("empty").hidden = !loaded || entries.length > 0;
  saveButton.disabled = busy || !pageSupported || !loaded;
  exportButton.disabled = busy || !loaded || !entries.length;
  list.replaceChildren();
  for (const entry of entries.slice(0, visibleCount)) {
    const item = document.createElement("li");
    item.className = "entry";
    const top = document.createElement("div");
    top.className = "entry-top";
    const word = document.createElement("p");
    word.className = "word";
    word.textContent = entry.text;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete";
    remove.textContent = t("deleteButton");
    remove.setAttribute(
      "aria-label",
      t("deleteLabel", { word: entry.text.slice(0, 40) }),
    );
    remove.disabled = busy;
    remove.addEventListener("click", () =>
      run(async () => {
        entries = await send("remove", { id: entry.id });
        render();
        setStatus(t("deleted"));
        (list.querySelector("button") || saveButton).focus();
      }),
    );
    top.append(word, remove);
    const source = document.createElement("a");
    source.className = "source";
    source.textContent = entry.title || new URL(entry.url).hostname;
    source.title = entry.url;
    source.href = entry.url;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    const date = document.createElement("time");
    date.dateTime = entry.savedAt;
    date.textContent = new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(entry.savedAt));
    item.append(top, source, date);
    list.append(item);
  }
  moreButton.hidden = entries.length <= visibleCount;
}

function renderSelection() {
  preview.textContent = selectedText || t(previewKey);
  preview.classList.toggle("placeholder", !selectedText);
  const button = document.getElementById("shortcut-settings");
  button.textContent = shortcut || t("shortcutUnset");
  button.title = t(shortcut ? "shortcutTitle" : "shortcutHint");
}

async function setLanguage(value) {
  language = resolveLanguage(value);
  t = await loadTranslator(language);
  document.documentElement.lang = language;
  document.title = t("extensionName");
  languageSelect.value = language;
  languageSelect.setAttribute("aria-label", t("languageLabel"));
  for (const element of document.querySelectorAll("[data-i18n]"))
    element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll("[data-i18n-title]"))
    element.title = t(element.dataset.i18nTitle);
  document.getElementById("privacy-link").href = `privacy/${language}.html`;
  renderSelection();
  render();
}

async function run(operation) {
  if (busy) return;
  busy = true;
  render();
  try {
    await operation();
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : t("operationFailed"),
      true,
    );
  } finally {
    busy = false;
    render();
  }
}

async function refresh() {
  entries = await send("list");
  loaded = true;
  render();
}

saveButton.addEventListener("click", () =>
  run(async () => {
    await send("save");
    await refresh();
    setStatus(t("saved"));
  }),
);

exportButton.addEventListener("click", () =>
  run(async () => {
    const current = await send("list");
    if (!current.length) throw new Error(t("nothingToExport"));
    const headings = ["csvWord", "csvTitle", "csvUrl", "csvSavedAt"].map(
      (key) => t(key),
    );
    const url = URL.createObjectURL(
      new Blob([toCsv(current, headings)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `kotoba-pocket-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(t("exportStarted"));
  }),
);

moreButton.addEventListener("click", () => {
  visibleCount += 50;
  render();
});

document.getElementById("shortcut-settings").addEventListener("click", () => {
  void chrome.tabs
    .create({ url: "chrome://extensions/shortcuts" })
    .catch(() => setStatus(t("shortcutError"), true));
});

languageSelect.addEventListener("change", () =>
  run(async () => {
    const nextLanguage = languageSelect.value;
    await chrome.storage.local.set({ [LANGUAGE_KEY]: nextLanguage });
    await setLanguage(nextLanguage);
    setStatus("");
  }),
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    void refresh().catch((error) =>
      setStatus(
        t(error instanceof VocabularyError ? error.code : "operationFailed"),
        true,
      ),
    );
  }
});

async function initialize() {
  await setLanguage(await preferredLanguage());
  const active = (
    await chrome.tabs.query({ active: true, currentWindow: true })
  )[0];
  tabId = active?.id;
  await refresh();
  try {
    const selected = await send("preview");
    selectedText = selected.text?.trim() || "";
    previewKey = "selectWord";
    pageSupported = Number.isInteger(tabId);
  } catch {
    previewKey = "previewUnavailable";
  }
  try {
    shortcut =
      (await chrome.commands.getAll()).find(({ name }) => name === "save-word")
        ?.shortcut || "";
  } catch {
    /* The button and context menu remain available. */
  }
  renderSelection();
  render();
}

void initialize().catch((error) => {
  previewKey = "loadFailed";
  renderSelection();
  setStatus(error.message || t("operationFailed"), true);
});
