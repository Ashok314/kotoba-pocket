import { normalizeSelection, readEntries, VocabularyError } from "./core.js";

export const STORAGE_KEY = "vocabulary.v1";

export function createVocabularyStore(
  area,
  { now = () => new Date().toISOString(), id = () => crypto.randomUUID() } = {},
) {
  let queue = Promise.resolve();
  const serialize = (operation) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const read = async () =>
    readEntries((await area.get(STORAGE_KEY))[STORAGE_KEY]);
  const write = (entries) =>
    area.set({ [STORAGE_KEY]: { version: 1, entries } });

  return {
    list: () => serialize(read),
    add: (selection) =>
      serialize(async () => {
        const normalized = normalizeSelection(selection);
        const entries = await read();
        if (entries.some((entry) => entry.text.trim() === normalized.text))
          throw new VocabularyError("wordAlreadySaved");
        const entry = { ...normalized, id: id(), savedAt: now() };
        await write([entry, ...entries]);
        return entry;
      }),
    remove: (entryId) =>
      serialize(async () => {
        if (typeof entryId !== "string" || !entryId)
          throw new VocabularyError("deleteWordMissing");
        const entries = await read();
        const remaining = entries.filter((entry) => entry.id !== entryId);
        if (remaining.length !== entries.length) await write(remaining);
        return remaining;
      }),
  };
}
