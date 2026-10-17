import { VocabularyError } from "./core.js";

export function createController({ store, capture, notify }) {
  async function save(selection, tabId) {
    const entry = await store.add(selection);
    await notify(tabId, "saved", true);
    return entry;
  }
  return {
    saveFromPage: async (tabId) => save(await capture(tabId), tabId),
    saveFromMenu: (selection, tabId) => save(selection, tabId),
    message: async (message, tabId) => {
      switch (message?.type) {
        case "preview":
          return capture(tabId);
        case "save":
          return save(await capture(tabId), tabId);
        case "list":
          return store.list();
        case "remove":
          return store.remove(message.id);
        default:
          throw new VocabularyError("unknownOperation");
      }
    },
  };
}
