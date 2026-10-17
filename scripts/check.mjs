import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, packageJson.version);
assert.deepEqual(
  [...manifest.permissions].sort(),
  ["activeTab", "contextMenus", "scripting", "storage"].sort(),
);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.content_scripts, undefined);
assert.equal(manifest.background.type, "module");
for (const file of await readdir(new URL("src/", root))) {
  if (!file.endsWith(".js")) continue;
  const path = new URL(`src/${file}`, root);
  const result = spawnSync(process.execPath, ["--check", path.pathname], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const source = await readFile(path, "utf8");
  assert.ok(
    !/\beval\s*\(|new\s+Function\s*\(|\bXMLHttpRequest\b|\.innerHTML\s*=/.test(
      source,
    ),
    `Unwanted remote code or HTML interpretation: ${file}`,
  );
  if (file !== "resources.js")
    assert.ok(
      !/\bfetch\s*\(/.test(source),
      `Network access outside the packaged-resource loader: ${file}`,
    );
  assert.ok(
    !/[ぁ-んァ-ヶ一-龠]/u.test(source),
    `User-facing Japanese must be in a locale file: ${file}`,
  );
  assert.ok(
    !/#[0-9a-f]{3,8}\b/i.test(source),
    `Colors must come from theme.json: ${file}`,
  );
}
const html = await readFile(new URL("popup.html", root), "utf8");
for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  assert.equal(
    script[1].trim(),
    "",
    "Inline executable scripts are not allowed",
  );
}
assert.ok(!/https?:\/\//.test(html));
for (const [size, file] of Object.entries(manifest.icons)) {
  const png = await readFile(new URL(`assets/${file}`, root));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
}
await readFile(new URL(manifest.background.service_worker, root));
await readFile(new URL("site/privacy/index.html", root));
const en = JSON.parse(
  await readFile(new URL("_locales/en/messages.json", root), "utf8"),
);
const ja = JSON.parse(
  await readFile(new URL("_locales/ja/messages.json", root), "utf8"),
);
assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort());
assert.equal(manifest.default_locale, "en");
for (const catalog of [en, ja]) {
  for (const [key, value] of Object.entries(catalog))
    assert.ok(
      typeof value.message === "string" && value.message.length > 0,
      key,
    );
}
console.log(
  "Manifest, JavaScript syntax, package version, permissions, icons and local-code checks passed.",
);
