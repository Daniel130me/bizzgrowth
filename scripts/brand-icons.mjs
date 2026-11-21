/**
 * brand-icons.mjs: builds Nellovia's favicon and app icons from the brand mark.
 * Run from bizzgrowth/: node scripts/brand-icons.mjs
 *
 * The mark is an "N" drawn as one line that climbs, dips (what's holding the business back),
 * then rises past where it started into an arrow: the next step. It is also drawn in
 * src/components/brand/logo.tsx (MARK_PATH); change both together.
 *
 * Writes:
 *   src/app/icon.svg          favicon for modern browsers
 *   src/app/favicon.ico       16/32/48 px for older browsers
 *   src/app/apple-icon.png    180 px home-screen icon (full bleed; iOS rounds the corners)
 *   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png   for the web app manifest
 *   docs/brand/*.svg          the chosen mark and the two alternates
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

export const BLUE = "#1DA1F2";
const MARK_PATH = "M8 23.5V11L20.5 23.5V8.6M16.4 12.7L20.5 8.6L24.6 12.7";
const line = (d, w, color = "#fff") =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A 32×32 mark: the glyph on a blue tile. rx 0 = full bleed; scale shrinks the glyph about the centre. */
function mark({ rx = 8, scale = 1, glyph = line(MARK_PATH, 3.4) } = {}) {
  const g = scale === 1 ? glyph : `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${glyph}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${rx}" fill="${BLUE}"/>${g}</svg>\n`;
}

// Alternates kept for the owner to compare (docs/brand/index.html).
const LENS = line("M19.5 19.5L25 25", 3.8) + `<circle cx="14" cy="14" r="7.4" fill="none" stroke="#fff" stroke-width="3"/>` + line("M10.4 16.4L13 13.8L14.8 15.4L17.6 12", 2.3);
const BUBBLE =
  `<path d="M9.5 7.5h13a4 4 0 0 1 4 4v7.5a4 4 0 0 1-4 4h-7.2l-5 3.9c-.5.4-1.2 0-1.2-.6V23h.4a4 4 0 0 1-4-4v-7.5a4 4 0 0 1 4-4z" fill="#fff"/>` +
  line("M9.8 18.4l3.9-3.9 3 2.6 5.5-5.5", 2.6, BLUE);

const png = (svg, px) => sharp(Buffer.from(svg), { density: Math.max(72, (72 * px) / 8) }).resize(px, px).png({ compressionLevel: 9 }).toBuffer();

/** ICO container holding PNG images (supported by every browser that still asks for favicon.ico). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ px, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(px >= 256 ? 0 : px, e);
    head.writeUInt8(px >= 256 ? 0 : px, e + 1);
    head.writeUInt16LE(1, e + 4); // colour planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

async function main() {
  mkdirSync(root("public/icons"), { recursive: true });
  mkdirSync(root("docs/brand"), { recursive: true });

  const tile = mark();
  writeFileSync(root("src/app/icon.svg"), tile);
  const sizes = [16, 32, 48];
  writeFileSync(root("src/app/favicon.ico"), ico(await Promise.all(sizes.map(async (px) => ({ px, data: await png(tile, px) })))));
  writeFileSync(root("src/app/apple-icon.png"), await png(mark({ rx: 0, scale: 0.92 }), 180));
  writeFileSync(root("public/icons/icon-192.png"), await png(tile, 192));
  writeFileSync(root("public/icons/icon-512.png"), await png(tile, 512));
  // Maskable: full bleed, glyph kept inside the central safe circle (40% radius).
  writeFileSync(root("public/icons/icon-maskable-512.png"), await png(mark({ rx: 0, scale: 0.84 }), 512));

  writeFileSync(root("docs/brand/nellovia-mark.svg"), tile);
  writeFileSync(root("docs/brand/nellovia-mark-glyph.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${line(MARK_PATH, 3.4, BLUE)}</svg>\n`);
  writeFileSync(root("docs/brand/alternate-lens.svg"), mark({ glyph: LENS }));
  writeFileSync(root("docs/brand/alternate-bubble.svg"), mark({ glyph: BUBBLE }));
  console.log("brand icons written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
