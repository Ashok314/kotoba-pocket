import { readFile, writeFile, mkdir } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const theme = JSON.parse(await readFile(new URL("theme.json", root), "utf8"));
for (const group of Object.values(theme)) {
  for (const value of Object.values(group)) {
    if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))
      throw new Error("Theme colors must be hexadecimal values");
  }
}
const properties = (values) =>
  Object.entries(values)
    .map(([name, value]) => `--${name}:${value};`)
    .join("");
const tokens = `/* Generated from theme.json. */\n:root{color-scheme:light dark;${properties(theme.light)}}\n@media(prefers-color-scheme:dark){:root{${properties(theme.dark)}}}\n`;
await writeFile(new URL("tokens.css", root), tokens);
await writeFile(new URL("site/tokens.css", root), tokens);
const { primary, paper, pocket } = theme.brand;
const letterStrokes = [
  [[47, 37], [58, 37], [69, 36], [79, 34]],
  [[61, 26], [58, 38], [57, 49], [58, 59], [62, 66]],
  [[75, 42], [70, 53], [63, 62], [55, 66], [48, 64], [45, 59],
    [47, 53], [53, 48], [61, 45], [70, 45], [78, 48], [82, 54],
    [81, 60], [77, 65], [71, 68]],
];
const letter = letterStrokes.map((points) =>
  `<polyline points="${points.map((point) => point.join(",")).join(" ")}"/>`,
).join("");
const drawing = `<rect width="128" height="128" rx="29" fill="${primary}"/><rect x="35" y="17" width="58" height="78" rx="8" fill="${paper}"/><g fill="none" stroke="${primary}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${letter}</g><path d="M24 75h80v21q0 15-40 22-40-7-40-22Z" fill="${pocket}"/><path d="M29 78h70M31 84v11q0 10 33 16 33-6 33-16V84" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round" stroke-dasharray="3 4"/>`;
await writeFile(
  new URL("assets/icon.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${drawing}</svg>\n`,
);
await writeFile(
  new URL("assets/logo.svg", root),
  `<svg xmlns="http://www.w3.org/2000/svg" width="650" height="128" viewBox="0 0 650 128">${drawing}<text x="152" y="80" font-family="system-ui,sans-serif" font-size="56" font-weight="650" fill="${theme.light.text}">Kotoba Pocket</text></svg>\n`,
);

const colors = Object.fromEntries(
  Object.entries(theme.brand).map(([name, hex]) => [
    name,
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)),
  ]),
);
function rounded(x, y, left, top, width, height, radius) {
  if (x < left || y < top || x > left + width || y > top + height) return false;
  const dx = Math.max(left + radius - x, 0, x - (left + width - radius));
  const dy = Math.max(top + radius - y, 0, y - (top + height - radius));
  return dx * dx + dy * dy <= radius * radius;
}
function distance(x, y, x1, y1, x2, y2) {
  const fraction = Math.max(
    0,
    Math.min(
      1,
      ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) /
        ((x2 - x1) ** 2 + (y2 - y1) ** 2),
    ),
  );
  return Math.hypot(
    x - x1 - fraction * (x2 - x1),
    y - y1 - fraction * (y2 - y1),
  );
}
function sample(x, y) {
  if (!rounded(x, y, 0, 0, 128, 128, 29)) return null;
  let color = colors.primary;
  if (rounded(x, y, 35, 17, 58, 78, 8)) color = colors.paper;
  for (const points of letterStrokes) {
    for (let index = 1; index < points.length; index++) {
      if (distance(x, y, ...points[index - 1], ...points[index]) <= 2)
        color = colors.primary;
    }
  }
  if (x >= 24 && x <= 104 && y >= 75 &&
      y <= 118 - 0.175 * Math.abs(x - 64)) color = colors.pocket;
  if (distance(x, y, 29, 78, 99, 78) <= 1) color = colors.primary;
  if (((Math.abs(x - 31) <= 1 || Math.abs(x - 97) <= 1) &&
       y >= 84 && y <= 97 && Math.floor((y - 84) / 4) % 2 === 0) ||
      (Math.abs(y - (111 - 0.2 * Math.abs(x - 64))) <= 1 &&
       x >= 33 && x <= 95 && Math.floor(x / 4) % 2 === 0))
    color = colors.primary;
  return color;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function png(size) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const channels = [0, 0, 0];
      let covered = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const color = sample(
            ((x + (sx + 0.5) / 4) * 128) / size,
            ((y + (sy + 0.5) / 4) * 128) / size,
          );
          if (color) {
            covered++;
            color.forEach((value, channel) => (channels[channel] += value));
          }
        }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      channels.forEach(
        (sum, channel) =>
          (rows[offset + channel] = covered ? Math.round(sum / covered) : 0),
      );
      rows[offset + 3] = Math.round((covered / 16) * 255);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
await mkdir(new URL("assets/icons/", root), { recursive: true });
for (const size of [16, 32, 48, 128])
  await writeFile(new URL(`assets/icons/icon-${size}.png`, root), png(size));
console.log("Generated theme tokens, logo and icons from theme.json.");
