import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("extension/", root);
await rm(output, { force: true, recursive: true });
await mkdir(new URL("src/", output), { recursive: true });
await mkdir(new URL("icons/", output), { recursive: true });
await mkdir(new URL("privacy/", output), { recursive: true });
for (const locale of ["en", "ja"]) {
  await mkdir(new URL(`_locales/${locale}/`, output), { recursive: true });
  await copyFile(
    new URL(`_locales/${locale}/messages.json`, root),
    new URL(`_locales/${locale}/messages.json`, output),
  );
}
for (const file of [
  "manifest.json",
  "popup.html",
  "popup.css",
  "tokens.css",
  "theme.json",
]) {
  await copyFile(new URL(file, root), new URL(file, output));
}
for (const file of await readdir(new URL("src/", root))) {
  if (file.endsWith(".js"))
    await copyFile(
      new URL(`src/${file}`, root),
      new URL(`src/${file}`, output),
    );
}
for (const file of await readdir(new URL("assets/icons/", root))) {
  if (file.endsWith(".png"))
    await copyFile(
      new URL(`assets/icons/${file}`, root),
      new URL(`icons/${file}`, output),
    );
}
await writeFile(
  new URL("privacy/ja.html", output),
  await readFile(new URL("site/privacy/index.html", root)),
);
await writeFile(
  new URL("privacy/en.html", output),
  await readFile(new URL("site/privacy/en.html", root)),
);
console.log(`Unpacked extension: ${output.pathname}`);
