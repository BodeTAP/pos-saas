/**
 * Generate PWA icons dari SVG sederhana menggunakan Canvas API (Node.js built-in via @napi-rs/canvas)
 * Jalankan: node scripts/generate-icons.mjs
 *
 * Karena tidak ada @napi-rs/canvas, kita buat SVG placeholder yang bisa dikonversi manual
 * atau pakai tool online seperti https://realfavicongenerator.net
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "../public/icons");

mkdirSync(iconsDir, { recursive: true });

// Generate SVG icon — shopping cart dengan background biru
function generateSVG(size, maskable = false) {
  const padding = maskable ? size * 0.15 : size * 0.1;
  const iconSize = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = maskable ? size / 2 : size * 0.45;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <${maskable ? `rect width="${size}" height="${size}" fill="#2563eb"` : `circle cx="${cx}" cy="${cy}" r="${r}" fill="#2563eb"`}/>
  <g transform="translate(${cx - iconSize * 0.35}, ${cy - iconSize * 0.35}) scale(${iconSize * 0.007})">
    <!-- Shopping Cart Icon -->
    <path d="M6 2 L3 6 L3 20 C3 21.1 3.9 22 5 22 L19 22 C20.1 22 21 21.1 21 20 L21 8 C21 6.9 20.1 6 19 6 L7.72 6 L6.53 2 Z" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16 10 C16 12.21 14.21 14 12 14 C9.79 14 8 12.21 8 10" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <!-- Simpler cart icon centered -->
  <g fill="none" stroke="white" stroke-width="${size * 0.04}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${cx - size * 0.28} ${cy - size * 0.18} L${cx - size * 0.18} ${cy + size * 0.18} L${cx + size * 0.28} ${cy + size * 0.18}" />
    <path d="M${cx - size * 0.18} ${cy + size * 0.18} L${cx + size * 0.28} ${cy + size * 0.18} L${cx + size * 0.32} ${cy - size * 0.05} L${cx - size * 0.12} ${cy - size * 0.05}" />
    <circle cx="${cx - size * 0.08}" cy="${cy + size * 0.28}" r="${size * 0.05}" fill="white" stroke="none"/>
    <circle cx="${cx + size * 0.18}" cy="${cy + size * 0.28}" r="${size * 0.05}" fill="white" stroke="none"/>
  </g>
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate regular icons
for (const size of sizes) {
  const svg = generateSVG(size, false);
  writeFileSync(join(iconsDir, `icon-${size}x${size}.svg`), svg);
  console.log(`✓ Generated icon-${size}x${size}.svg`);
}

// Generate maskable icons
for (const size of [192, 512]) {
  const svg = generateSVG(size, true);
  writeFileSync(join(iconsDir, `icon-maskable-${size}x${size}.svg`), svg);
  console.log(`✓ Generated icon-maskable-${size}x${size}.svg`);
}

// Generate placeholder screenshot
const screenshotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f3f4f6"/>
  <rect x="0" y="0" width="240" height="720" fill="#ffffff"/>
  <rect x="240" y="0" width="1040" height="64" fill="#ffffff"/>
  <text x="640" y="380" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#9ca3af">POS SaaS Screenshot</text>
</svg>`;
writeFileSync(join(iconsDir, "screenshot-pos.svg"), screenshotSvg);

console.log("\n✅ SVG icons generated in public/icons/");
console.log("\n📌 Untuk PNG, konversi SVG ke PNG menggunakan:");
console.log("   - https://realfavicongenerator.net (upload icon-512x512.svg)");
console.log("   - atau: npm install -g sharp-cli && sharp -i public/icons/icon-512x512.svg -o public/icons/icon-512x512.png resize 512 512");
console.log("\n💡 Untuk development, SVG icons sudah cukup untuk testing PWA install prompt.");
