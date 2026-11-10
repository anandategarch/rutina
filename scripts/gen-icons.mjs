/**
 * Render ikon PWA Rutina — PERSIS sama dengan .brand-mark di aplikasi:
 * - kotak radius 12/42 = 28.57%
 * - gradien 140deg #34D399 → #059669
 * - daun 22/42 = 52.38% dari kotak, stroke 2/24 viewBox
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

// rasio brand mark (dari rutina.html .brand-mark)
const RADIUS = 12 / 42;      // 0.285714
const LEAF = 22 / 42;        // 0.523810
// CSS linear-gradient(140deg) ≈ vektor objectBoundingBox (spec CSS images-3)
const GRAD = `x1="0.047" y1="-0.0396" x2="0.953" y2="1.0396"`;

const leafPaths = `<path d="M4.5 19.5C4.5 11 9 5.5 19.5 4.5c-.5 10-4.5 15-15 15z"/><path d="M4.5 19.5C8 14 11 11 15.5 8.5"/>`;

function svg(size, { fullBleed }) {
  const rx = fullBleed ? 0 : size * RADIUS;
  const s = (size * LEAF) / 24;
  const t = (size - 24 * s) / 2;
  const rect = fullBleed
    ? `<rect width="${size}" height="${size}" fill="url(#g)"/>`
    : `<rect width="${size}" height="${size}" rx="${rx.toFixed(2)}" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="g" ${GRAD}><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#059669"/></linearGradient></defs>
${rect}
<g transform="translate(${t.toFixed(2)} ${t.toFixed(2)}) scale(${s.toFixed(4)})" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${leafPaths}</g>
</svg>`;
}

async function render(size, opts, ...files) {
  const buf = await sharp(Buffer.from(svg(size, opts)))
    .resize(size, size)
    .png()
    .toBuffer();
  for (const f of files) writeFileSync(`${OUT}/${f}`, buf);
  console.log(`✓ ${size}px ${opts.fullBleed ? "full-bleed" : "rounded  "} → ${files.join(", ")}`);
}

// "any" — kotak lengkung transparan (tampil persis seperti plate logo di aplikasi)
await render(512, { fullBleed: false }, "icon-512.png", "icon-512");
await render(192, { fullBleed: false }, "icon-192.png", "icon-192");
// "maskable" — full-bleed, daun tetap 52% (aman di safe-zone 80%)
await render(512, { fullBleed: true }, "maskable-512.png");
// iOS apple-touch — full-bleed (iOS membulatkan sendiri)
await render(180, { fullBleed: true }, "apple-touch-icon.png", "apple-180");

// logo.svg resmi — versi rounded 512 (untuk favicon SVG & ikon Next)
writeFileSync(
  "public/logo.svg",
  svg(512, { fullBleed: false })
);
console.log("✓ logo.svg (rounded brand-true 512)");

// varian SVG untuk ikon PWA (dipakai layout.tsx di repo)
writeFileSync(`${OUT}/icon.svg`, svg(512, { fullBleed: false }));
writeFileSync(`${OUT}/icon-maskable.svg`, svg(512, { fullBleed: true }));
console.log("✓ icons/icon.svg + icons/icon-maskable.svg (brand-true)");
