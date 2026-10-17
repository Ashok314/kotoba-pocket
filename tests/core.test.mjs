import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSelection, readEntries, toCsv } from "../src/core.js";
import { createVocabularyStore, STORAGE_KEY } from "../src/storage.js";
import { createController } from "../src/controller.js";
import { captureSelection } from "../src/selection.js";
import { readFileSync } from "node:fs";
import { createTranslator, resolveLanguage } from "../src/i18n.js";
const enMessages = JSON.parse(
  readFileSync(new URL("../_locales/en/messages.json", import.meta.url)),
);
const jaMessages = JSON.parse(
  readFileSync(new URL("../_locales/ja/messages.json", import.meta.url)),
);
const headers = ["csvWord", "csvTitle", "csvUrl", "csvSavedAt"].map(
  (key) => enMessages[key].message,
);

const selection = {
  text: "整合性",
  title: "日本語のページ",
  url: "https://example.com/learn",
};
function memoryStorage() {
  const values = {};
  return {
    values,
    failWrite: false,
    async get(key) {
      await new Promise(setImmediate);
      return structuredClone({ [key]: values[key] });
    },
    async set(data) {
      await new Promise(setImmediate);
      if (this.failWrite) throw new Error("QUOTA_BYTES quota exceeded");
      Object.assign(values, structuredClone(data));
    },
  };
}
function storeOptions() {
  let counter = 0;
  return {
    id: () => `entry-${++counter}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, counter)).toISOString(),
  };
}

test("selected Japanese and markup remain plain text; invalid selections cannot be saved", () => {
  assert.equal(
    normalizeSelection({ ...selection, text: "  曖昧\n矛盾  " }).text,
    "曖昧\n矛盾",
  );
  assert.equal(
    normalizeSelection({ ...selection, text: "<img src=x onerror=alert(1)>" })
      .text,
    "<img src=x onerror=alert(1)>",
  );
  for (const input of [
    undefined,
    { ...selection, text: "  " },
    { ...selection, url: "javascript:alert(1)" },
    { ...selection, url: "chrome://settings" },
    { ...selection, text: "字".repeat(5001) },
  ]) {
    assert.throws(() => normalizeSelection(input));
  }
});

test("concurrent saves persist without lost updates and survive a new store instance", async () => {
  const area = memoryStorage();
  const store = createVocabularyStore(area, storeOptions());
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      store.add({ ...selection, text: `単語${i}` }),
    ),
  );
  const entries = await createVocabularyStore(area).list();
  assert.equal(entries.length, 20);
  assert.equal(new Set(entries.map(({ id }) => id)).size, 20);
  assert.equal(entries[0].text, "単語19");
  assert.equal(entries.at(-1).text, "単語0");
});

test("a failed write preserves saved data and the queue recovers", async () => {
  const area = memoryStorage();
  const store = createVocabularyStore(area, storeOptions());
  await store.add(selection);
  area.failWrite = true;
  await assert.rejects(store.add({ ...selection, text: "保存失敗" }), /quota/);
  assert.equal((await store.list()).length, 1);
  area.failWrite = false;
  await store.add({ ...selection, text: "再試行" });
  assert.equal((await store.list()).length, 2);
});

test("save and delete share a queue, and deleting does not alter other entries", async () => {
  const store = createVocabularyStore(memoryStorage(), storeOptions());
  const first = await store.add(selection);
  await Promise.all([
    store.add({ ...selection, text: "残る単語" }),
    store.remove(first.id),
  ]);
  assert.deepEqual(
    (await store.list()).map(({ text }) => text),
    ["残る単語"],
  );
  assert.equal((await store.remove("not-found")).length, 1);
});

test("unrecognized stored data is rejected without overwriting it", async () => {
  const area = memoryStorage();
  area.values[STORAGE_KEY] = { version: 99, entries: [] };
  const store = createVocabularyStore(area, storeOptions());
  await assert.rejects(store.add(selection), /storedDataInvalid/);
  assert.equal(area.values[STORAGE_KEY].version, 99);
  assert.throws(() =>
    readEntries({ version: 1, entries: [{ text: "broken" }] }),
  );
});

test("CSV preserves Japanese, escapes quotes and newlines, and protects formula-like cells", () => {
  const entries = [
    {
      text: '曖昧,"引用"\n改行',
      title: '=IMPORTXML("url")',
      url: selection.url,
      savedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  const original = structuredClone(entries);
  const csv = toCsv(entries, headers);
  assert.ok(csv.startsWith('\uFEFF"Word or phrase"'));
  assert.ok(csv.includes('"曖昧,""引用""\n改行"'));
  assert.ok(csv.includes('"\'=IMPORTXML(""url"")"'));
  assert.ok(csv.endsWith("\r\n"));
  assert.deepEqual(entries, original);
  for (const text of ["+SUM(1,1)", "-1+1", "@SUM(1)", "  =1", "\tformula"]) {
    assert.ok(
      toCsv([{ ...entries[0], text }], headers).includes(
        `"'${text.replaceAll('"', '""')}"`,
      ),
    );
  }
});

test("save button, shortcut, and context menu use the same stored-entry behavior", async () => {
  const store = createVocabularyStore(memoryStorage(), storeOptions());
  const feedback = [];
  const controller = createController({
    store,
    capture: async (tabId) => {
      assert.equal(tabId, 7);
      return selection;
    },
    notify: async (...args) => feedback.push(args),
  });
  await controller.message({ type: "save" }, 7);
  await assert.rejects(controller.saveFromPage(7), /wordAlreadySaved/);
  await assert.rejects(controller.saveFromMenu(selection, 7), /wordAlreadySaved/);
  const saved = await controller.message({ type: "list" });
  assert.equal(saved.length, 1);
  assert.ok(
    saved.every(
      ({ text, title, url }) =>
        text === selection.text &&
        title === selection.title &&
        url === selection.url,
    ),
  );
  assert.equal(feedback.length, 1);
  assert.ok(feedback.every(([, , success]) => success));
});

test("no success feedback is emitted for empty selection or failed persistence", async () => {
  const area = memoryStorage();
  const store = createVocabularyStore(area, storeOptions());
  const controller = createController({
    store,
    capture: async () => ({ ...selection, text: "" }),
    notify: async () =>
      assert.fail("Save failed, so success feedback must not run"),
  });
  await assert.rejects(controller.saveFromPage(7), /selectWord/);
  area.failWrite = true;
  await assert.rejects(controller.saveFromMenu(selection, 7), /quota/);
  assert.equal((await store.list()).length, 0);
});

test("preview does not save, and message handling rejects unknown operations", async () => {
  const store = createVocabularyStore(memoryStorage());
  const controller = createController({
    store,
    capture: async () => selection,
    notify: async () => {},
  });
  assert.deepEqual(await controller.message({ type: "preview" }, 7), selection);
  assert.equal((await store.list()).length, 0);
  await assert.rejects(
    controller.message({ type: "unknown" }),
    /unknownOperation/,
  );
});

test("selection capture supports page text and text fields without reading password inputs", () => {
  const originalDocument = globalThis.document;
  const originalLocation = globalThis.location;
  const document = {
    title: "テスト",
    activeElement: null,
    getSelection: () => ({ toString: () => "選択範囲" }),
  };
  globalThis.document = document;
  globalThis.location = { href: selection.url };
  try {
    assert.equal(captureSelection().text, "選択範囲");
    document.activeElement = {
      tagName: "TEXTAREA",
      value: "先頭ことば末尾",
      selectionStart: 2,
      selectionEnd: 5,
    };
    assert.equal(captureSelection().text, "ことば");
    document.activeElement = {
      tagName: "INPUT",
      type: "password",
      value: "secret",
      selectionStart: 0,
      selectionEnd: 6,
    };
    assert.equal(captureSelection().text, "");
  } finally {
    globalThis.document = originalDocument;
    globalThis.location = originalLocation;
  }
});

test("locale catalogs have matching keys, explicit overrides and contextual substitutions", () => {
  assert.deepEqual(
    Object.keys(enMessages).sort(),
    Object.keys(jaMessages).sort(),
  );
  assert.equal(resolveLanguage(undefined, "ja-JP"), "ja");
  assert.equal(resolveLanguage("en", "ja-JP"), "en");
  assert.equal(resolveLanguage(undefined, "fr-FR"), "en");
  assert.equal(
    createTranslator(enMessages)("deleteLabel", { word: "言葉" }),
    "Delete “言葉”",
  );
  assert.equal(createTranslator(jaMessages)("saved"), "単語を保存しました。");
  assert.throws(
    () => createTranslator(enMessages)("missing"),
    /Missing translation/,
  );
  assert.ok(
    toCsv(
      [],
      ["csvWord", "csvTitle", "csvUrl", "csvSavedAt"].map(
        (key) => jaMessages[key].message,
      ),
    ).includes("単語・フレーズ"),
  );
});


test("duplicate words from any site preserve the original record across store reloads", async () => {
  const area = memoryStorage();
  const store = createVocabularyStore(area, storeOptions());
  const original = await store.add(selection);
  const snapshot = structuredClone(area.values);
  area.failWrite = true;
  const reloaded = createVocabularyStore(area);
  await assert.rejects(
    reloaded.add({ ...selection, text: `  ${selection.text}  `, url: "https://other.example/", title: "Other" }),
    /wordAlreadySaved/,
  );
  assert.deepEqual(area.values, snapshot);
  assert.deepEqual(await reloaded.list(), [original]);
  area.failWrite = false;
  await store.remove(original.id);
  await store.add(selection);
  assert.equal((await store.list()).length, 1);
});

test("simultaneous duplicate saves persist once and leave the queue usable", async () => {
  const store = createVocabularyStore(memoryStorage(), storeOptions());
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => store.add(selection)),
  );
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const failures = results.filter(({ status }) => status === "rejected");
  assert.equal(failures.length, 19);
  assert.ok(failures.every(({ reason }) => reason.code === "wordAlreadySaved"));
  await store.add({ ...selection, text: "different" });
  await store.add({ ...selection, text: "Different" });
  assert.equal((await store.list()).length, 3);
});
