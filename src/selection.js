export function captureSelection() {
  function read(document) {
    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement)
      focused = focused.shadowRoot.activeElement;
    if (focused?.tagName === "INPUT" && focused.type === "password") return "";
    if (focused?.tagName === "IFRAME") {
      try {
        if (focused.contentDocument) return read(focused.contentDocument);
      } catch {
        /* Cross-origin frames remain outside temporary page access. */
      }
    }
    if (
      (focused?.tagName === "TEXTAREA" || focused?.tagName === "INPUT") &&
      typeof focused.selectionStart === "number" &&
      typeof focused.selectionEnd === "number"
    ) {
      return focused.value.slice(focused.selectionStart, focused.selectionEnd);
    }
    return document.getSelection()?.toString() || "";
  }
  return { text: read(document), title: document.title, url: location.href };
}

export function showPageFeedback(message, success, theme) {
  document.getElementById("kotoba-pocket-feedback")?.remove();
  const host = document.createElement("div");
  host.id = "kotoba-pocket-feedback";
  host.style.cssText =
    "all:initial;position:fixed;right:24px;bottom:24px;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  const colors = matchMedia("(prefers-color-scheme:dark)").matches
    ? theme.dark
    : theme.light;
  style.textContent = `div{box-sizing:border-box;max-width:min(360px,calc(100vw - 48px));padding:14px 18px;border:1px solid ${colors.border};border-radius:14px;background:${colors.surface};color:${colors.text};box-shadow:0 8px 30px ${theme.feedback.shadow};font:500 14px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}span{margin-right:8px;font-weight:700;color:${success ? colors.accent : colors.error}}`;
  const box = document.createElement("div");
  box.setAttribute("role", success ? "status" : "alert");
  const icon = document.createElement("span");
  icon.textContent = success ? "✓" : "!";
  box.append(icon, document.createTextNode(message));
  root.append(style, box);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 4000);
}
