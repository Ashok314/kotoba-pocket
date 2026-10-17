import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const site = new URL("site/", root);
const template = await readFile(new URL("page.html", site), "utf8");
const locales = {};
for (const language of ["ja", "en"]) {
  locales[language] = JSON.parse(
    await readFile(new URL(`locales/${language}.json`, site), "utf8"),
  );
}
assert.deepEqual(Object.keys(locales.ja).sort(), Object.keys(locales.en).sort());
const escape = (text) => String(text).replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);
for (const [language, messages] of Object.entries(locales)) {
  const filename = language === "ja" ? "index.html" : "en.html";
  const values = { ...messages, homeUrl: filename };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    assert.ok(typeof values[key] === "string" && values[key], `Missing site message: ${language}.${key}`);
    return escape(values[key]).replaceAll("&lt;br&gt;", "<br>");
  });
  assert.ok(!html.includes("{{"), "Unresolved site template value");
  await writeFile(new URL(filename, site), html);
}
await mkdir(new URL("assets/", site), { recursive: true });
await copyFile(new URL("assets/icon.svg", root), new URL("assets/icon.svg", site));
console.log("Built Japanese and English landing pages with the shared brand icon.");
