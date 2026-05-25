/**
 * Generate PWA icons (PNG) dari SVG menggunakan sharp.
 * Jalankan: node scripts/generate-icons.mjs
 *
 * Output: public/icons/
 *   - icon-{size}x{size}.png (any purpose, lingkaran biru)
 *   - icon-maskable-{size}x{size}.png (full square, untuk Android adaptive)
 *   - screenshot-pos.png + screenshot-pos-mobile.png
 */

import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "../public/icons");

mkdirSync(iconsDir, { recursive: true });

// Brand color
const BRAND_COLOR = "#2563eb";

/**
 * SVG icon — shopping cart dengan background biru.
 * `maskable` = full square (untuk Android adaptive icon dengan safe zone 80%).
 */
function generateSVG(size, maskable = false) {
  const cx = size / 2;
  const cy = size / 2;
  // Maskable: konten di tengah dengan safe zone 80% — Android akan crop edge
  const safeRadius = maskable ? size * 0.4 : size * 0.45;
  const cartScale = maskable ? size * 0.5 : size * 0.55;

  const background = maskable
    ? `<rect width="${size}" height="${size}" fill="${BRAND_COLOR}"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${safeRadius}" fill="${BRAND_COLOR}"/>`;

  // Shopping cart icon — drawing path manual untuk kontrol penuh
  const cartCx = cx;
  const cartCy = cy;
  const cw = cartScale * 0.6;
  const ch = cartScale * 0.5;
  const sw = size * 0.04;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background}
  <g fill="none" stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${cartCx - cw / 2 - sw} ${cartCy - ch / 2} L${cartCx - cw / 2 + sw * 1.5} ${cartCy - ch / 2} L${cartCx - cw / 2 + sw * 3} ${cartCy + ch / 4} L${cartCx + cw / 2} ${cartCy + ch / 4}" />
    <path d="M${cartCx - cw / 2 + sw * 1.5} ${cartCy - ch / 4} L${cartCx + cw / 2 + sw} ${cartCy - ch / 4} L${cartCx + cw / 2} ${cartCy + ch / 4}" />
  </g>
  <circle cx="${cartCx - cw / 4}" cy="${cartCy + ch / 4 + sw * 1.5}" r="${sw * 1.2}" fill="white"/>
  <circle cx="${cartCx + cw / 4}" cy="${cartCy + ch / 4 + sw * 1.5}" r="${sw * 1.2}" fill="white"/>
</svg>`;
}

async function svgToPng(svg, outputPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outputPath);
}

// Sizes untuk PWA standard
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

console.log("🎨 Generating PWA icons (PNG)...\n");

// Regular icons (any purpose)
for (const size of sizes) {
  const svg = generateSVG(size, false);
  const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
  await svgToPng(svg, outputPath, size);
  console.log(`✓ icon-${size}x${size}.png`);
}

// Maskable icons (untuk Android adaptive)
for (const size of [192, 512]) {
  const svg = generateSVG(size, true);
  const outputPath = join(iconsDir, `icon-maskable-${size}x${size}.png`);
  await svgToPng(svg, outputPath, size);
  console.log(`✓ icon-maskable-${size}x${size}.png`);
}

// Screenshot landscape (1280x720) — placeholder ringan
const screenshotLandscape = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f9fafb"/>
  <rect x="0" y="0" width="240" height="720" fill="#1e293b"/>
  <rect x="240" y="0" width="1040" height="64" fill="#ffffff" stroke="#e5e7eb" stroke-width="1"/>
  <text x="280" y="40" font-family="-apple-system, sans-serif" font-size="18" font-weight="600" fill="#111827">Kasir (POS)</text>
  <g transform="translate(280, 100)">
    <rect x="0" y="0" width="280" height="48" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
    <text x="20" y="30" font-family="sans-serif" font-size="14" fill="#9ca3af">Cari produk...</text>
  </g>
  <g transform="translate(280, 170)">
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
      const x = (i % 4) * 240;
      const y = Math.floor(i / 4) * 160;
      return `<rect x="${x}" y="${y}" width="220" height="140" rx="12" fill="#ffffff" stroke="#e5e7eb"/>`;
    }).join("\n    ")}
  </g>
  <rect x="60" y="120" width="120" height="40" rx="8" fill="#2563eb"/>
  <text x="80" y="146" font-family="sans-serif" font-size="14" font-weight="600" fill="#ffffff">POS SaaS</text>
  <text x="640" y="680" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#9ca3af">Halaman Kasir POS</text>
</svg>`;

await svgToPng(screenshotLandscape, join(iconsDir, "screenshot-pos.png"), 1280);
// Sharp resize landscape to keep aspect — gunakan width
await sharp(Buffer.from(screenshotLandscape))
  .resize(1280, 720)
  .png({ compressionLevel: 9 })
  .toFile(join(iconsDir, "screenshot-pos.png"));
console.log("✓ screenshot-pos.png (1280x720)");

// Screenshot mobile (390x844 — iPhone 14 size)
const screenshotMobile = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">
  <rect width="390" height="844" fill="#f9fafb"/>
  <rect x="0" y="0" width="390" height="64" fill="#2563eb"/>
  <text x="195" y="40" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="#ffffff">POS SaaS</text>
  <g transform="translate(16, 80)">
    <rect width="358" height="48" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
    <text x="20" y="30" font-family="sans-serif" font-size="14" fill="#9ca3af">Cari produk...</text>
  </g>
  <g transform="translate(16, 150)">
    ${[0, 1, 2, 3, 4, 5].map((i) => {
      const x = (i % 2) * 184;
      const y = Math.floor(i / 2) * 200;
      return `<rect x="${x}" y="${y}" width="170" height="180" rx="12" fill="#ffffff" stroke="#e5e7eb"/>
      <rect x="${x + 12}" y="${y + 12}" width="146" height="100" rx="8" fill="#f3f4f6"/>
      <rect x="${x + 12}" y="${y + 124}" width="100" height="14" rx="4" fill="#1e293b"/>
      <rect x="${x + 12}" y="${y + 146}" width="60" height="12" rx="4" fill="#9ca3af"/>`;
    }).join("\n    ")}
  </g>
</svg>`;

await sharp(Buffer.from(screenshotMobile))
  .resize(390, 844)
  .png({ compressionLevel: 9 })
  .toFile(join(iconsDir, "screenshot-pos-mobile.png"));
console.log("✓ screenshot-pos-mobile.png (390x844)");

console.log("\n✅ Semua icons berhasil di-generate di public/icons/");
console.log("\n💡 PNG sudah siap dipakai untuk PWA install di iOS, Android, dan Chrome.");
