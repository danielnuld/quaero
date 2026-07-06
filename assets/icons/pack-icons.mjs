#!/usr/bin/env node
// Reproducible packer for the Quaero application icons (issue #190).
//
// Input: a directory of square PNG rasterizations of the brand mark named
//   s<size>.png (s16.png, s32.png, ...). These come from the brand source
//   assets/brand/quaero-mark-solid.svg — rasterize with any SVG tool, e.g.
//   `rsvg-convert -w 256 -h 256 quaero-mark-solid.svg > s256.png`.
//
// Output (into the target dir, default assets/icons/):
//   quaero.ico   — Windows multi-resolution icon (PNG-compressed entries,
//                  read by Windows Vista+; embedded in quaero.exe via the .rc)
//   quaero.icns  — macOS icon (PNG entries)
//   hicolor/<n>x<n>/apps/quaero.png — Linux hicolor theme PNGs
//
// No third-party dependencies: the ICO/ICNS containers are assembled by hand
// and the PNG payloads are embedded verbatim.
//
// Usage: node pack-icons.mjs [srcDir] [outDir]

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = process.argv[2] ?? join(here, "src");
const outDir = process.argv[3] ?? here;

const ICO_SIZES = [16, 32, 48, 64, 128, 256];
const ICNS_SIZES = [16, 32, 64, 128, 256, 512];
const HICOLOR_SIZES = [16, 32, 48, 64, 128, 256, 512];

function loadPng(size) {
  const buf = readFileSync(join(srcDir, `s${size}.png`));
  // Sanity: PNG signature + IHDR dimensions must match the requested size.
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`s${size}.png is not a PNG`);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== size || h !== size) throw new Error(`s${size}.png is ${w}x${h}, expected ${size}`);
  return buf;
}

// --- Windows .ico (PNG entries) -------------------------------------------
function buildIco(sizes) {
  const imgs = sizes.map((s) => ({ size: s, data: loadPng(s) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(imgs.length, 4);

  const dir = Buffer.alloc(16 * imgs.length);
  let offset = 6 + dir.length;
  imgs.forEach((img, i) => {
    const e = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 0); // width (0 == 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1); // height
    dir.writeUInt8(0, e + 2); // palette
    dir.writeUInt8(0, e + 3); // reserved
    dir.writeUInt16LE(1, e + 4); // planes
    dir.writeUInt16LE(32, e + 6); // bit count
    dir.writeUInt32LE(img.data.length, e + 8); // bytes in resource
    dir.writeUInt32LE(offset, e + 12); // offset
    offset += img.data.length;
  });
  return Buffer.concat([header, dir, ...imgs.map((i) => i.data)]);
}

// --- macOS .icns (PNG entries) --------------------------------------------
const ICNS_TYPES = { 16: "icp4", 32: "icp5", 64: "icp6", 128: "ic07", 256: "ic08", 512: "ic09" };
function buildIcns(sizes) {
  const blocks = sizes.map((s) => {
    const data = loadPng(s);
    const head = Buffer.alloc(8);
    head.write(ICNS_TYPES[s], 0, "ascii");
    head.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([head, data]);
  });
  const body = Buffer.concat(blocks);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "quaero.ico"), buildIco(ICO_SIZES));
writeFileSync(join(outDir, "quaero.icns"), buildIcns(ICNS_SIZES));
for (const s of HICOLOR_SIZES) {
  const dst = join(outDir, "hicolor", `${s}x${s}`, "apps");
  mkdirSync(dst, { recursive: true });
  copyFileSync(join(srcDir, `s${s}.png`), join(dst, "quaero.png"));
}
console.log(`icons written to ${outDir} (ico ${ICO_SIZES.length} sizes, icns ${ICNS_SIZES.length} sizes, hicolor ${HICOLOR_SIZES.length} sizes)`);
