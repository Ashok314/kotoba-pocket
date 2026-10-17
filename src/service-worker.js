import { createVocabularyStore } from "./storage.js";
import { captureSelection, showPageFeedback } from "./selection.js";
import { createController } from "./controller.js";
import { VocabularyError } from "./core.js";
import { LANGUAGE_KEY, loadTranslator, preferredLanguage } from "./i18n.js";
import { loadResource } from "./resources.js";

const store = createVocabularyStore(chrome.storage.local);

function errorCode(error) {
  if (error instanceof VocabularyError) return error.code;
  return /quota|QUOTA_BYTES/i.test(error?.message || "")
    ? "quotaExceeded"
    : "operationFailed";
}

async function localized(key) {
  try {
    return (await loadTranslator(await preferredLanguage()))(key);
  } catch {
    return (
      chrome.i18n.getMessage(key) || chrome.i18n.getMessage("operationFailed")
    );
  }
}

async function capture(tabId) {
  if (!Number.isInteger(tabId)) throw new VocabularyError("sourceTabMissing");
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: captureSelection,
  });
  return results[0]?.result || { text: "", title: "", url: "" };
}

async function notify(tabId, key, success) {
  if (!Number.isInteger(tabId)) return;
  const message = await localized(key);
  const title = await localized("openTitle");
  const theme = await loadResource("theme.json").catch(() => null);
  await Promise.allSettled([
    chrome.action.setBadgeText({ tabId, text: success ? "✓" : "!" }),
    chrome.action.setTitle({ tabId, title: `${title}: ${message}` }),
    ...(theme
      ? [
          chrome.action.setBadgeBackgroundColor({
            tabId,
            color: success ? theme.feedback.success : theme.feedback.error,
          }),
          chrome.scripting.executeScript({
            target: { tabId },
            func: showPageFeedback,
            args: [message, success, theme],
          }),
        ]
      : []),
  ]);
  setTimeout(() => {
    void Promise.allSettled([
      chrome.action.setBadgeText({ tabId, text: "" }),
      chrome.action.setTitle({ tabId, title }),
    ]);
  }, 4000);
}

const controller = createController({ store, capture, notify });

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) return;
    void localized("menuSave").then((title) => {
      chrome.contextMenus.create({
        id: "save-word",
        title,
        contexts: ["selection"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    });
  });
});

async function updateMenuLanguage() {
  await Promise.allSettled([
    chrome.contextMenus.update("save-word", {
      title: await localized("menuSave"),
    }),
    chrome.action.setTitle({ title: await localized("openTitle") }),
  ]);
}
chrome.runtime.onStartup.addListener(() => {
  void updateMenuLanguage();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[LANGUAGE_KEY]) void updateMenuLanguage();
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "save-word") return;
  void (async () => {
    let current = tab;
    try {
      current ||= (
        await chrome.tabs.query({ active: true, currentWindow: true })
      )[0];
      await controller.saveFromPage(current?.id);
    } catch (error) {
      await notify(current?.id, errorCode(error), false);
    }
  })();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "save-word") return;
  void controller
    .saveFromMenu(
      {
        text: info.selectionText || "",
        title: tab?.title || "",
        url: info.frameUrl || info.pageUrl || tab?.url || "",
      },
      tab?.id,
    )
    .catch((error) => notify(tab?.id, errorCode(error), false));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL(""))
  )
    return false;
  void (async () => {
    try {
      sendResponse({
        ok: true,
        data: await controller.message(message, message.tabId),
      });
    } catch (error) {
      sendResponse({ ok: false, errorCode: errorCode(error) });
    }
  })();
  return true;
});
