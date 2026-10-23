// Generates clean flat product illustrations (SVG) into the frontend's public/products folder.
// Used for catalogue items we have no photograph for. Run: npm run seed (it calls this first).
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = resolve(process.env.PRODUCT_ART_DIR || join(here, "..", "..", "shopSphere", "public", "products"));
const PHOTO_DIR = resolve(process.env.PRODUCT_PHOTO_DIR || join(here, "..", "..", "..", "shopsphere products"));

const shapes = {
    earbuds: (c) => `
        <g transform="translate(400 400)">
          <rect x="-190" y="-30" width="380" height="190" rx="70" fill="${c.dark}"/>
          <rect x="-190" y="-30" width="380" height="60" rx="30" fill="${c.main}"/>
          <circle cx="-80" cy="70" r="26" fill="${c.accent}"/><circle cx="80" cy="70" r="26" fill="${c.accent}"/>
          <g fill="${c.light}"><ellipse cx="-70" cy="-130" rx="45" ry="55"/><rect x="-100" y="-110" width="20" height="95" rx="10"/>
          <ellipse cx="70" cy="-130" rx="45" ry="55"/><rect x="80" y="-110" width="20" height="95" rx="10"/></g>
        </g>`,
    mic: (c) => `
        <g transform="translate(400 400)">
          <rect x="-70" y="-230" width="140" height="250" rx="70" fill="${c.main}"/>
          <g stroke="${c.dark}" stroke-width="6" opacity=".45"><path d="M-70-170H70M-70-130H70M-70-90H70M-70-50H70"/></g>
          <path d="M-120-20v30a120 120 0 0 0 240 0v-30" fill="none" stroke="${c.dark}" stroke-width="18" stroke-linecap="round"/>
          <rect x="-12" y="130" width="24" height="90" fill="${c.dark}"/><rect x="-110" y="212" width="220" height="30" rx="15" fill="${c.accent}"/>
        </g>`,
    keyboard: (c) => {
        let keys = "";
        for (let r = 0; r < 4; r += 1) for (let k = 0; k < 11; k += 1) keys += `<rect x="${-215 + k * 40}" y="${-70 + r * 48}" width="34" height="38" rx="7" fill="${r === 0 && k % 4 === 0 ? c.accent : c.light}"/>`;
        return `<g transform="translate(400 420)"><rect x="-250" y="-120" width="500" height="250" rx="26" fill="${c.dark}"/>${keys}<rect x="-130" y="122" width="260" height="0" /></g>`;
    },
    mouse: (c) => `
        <g transform="translate(400 400)">
          <path d="M-110 20C-110-150-60-220 0-220S110-150 110 20c0 130-50 210-110 210S-110 150-110 20Z" fill="${c.main}"/>
          <path d="M0-220v150M-110-60H110" stroke="${c.dark}" stroke-width="8" fill="none"/>
          <rect x="-14" y="-170" width="28" height="70" rx="14" fill="${c.accent}"/>
        </g>`,
    monitor: (c) => `
        <g transform="translate(400 380)">
          <rect x="-280" y="-200" width="560" height="330" rx="22" fill="${c.dark}"/>
          <rect x="-262" y="-182" width="524" height="294" rx="10" fill="${c.main}"/>
          <path d="M-262 60 -120-40l90 70 110-110 182 150v42h-524Z" fill="${c.accent}" opacity=".85"/><circle cx="170" cy="-100" r="30" fill="${c.light}"/>
          <rect x="-24" y="130" width="48" height="90" fill="${c.dark}"/><rect x="-120" y="212" width="240" height="26" rx="13" fill="${c.dark}"/>
        </g>`,
    bulb: (c) => `
        <g transform="translate(400 390)">
          <path d="M0-230a140 140 0 0 0-90 247c20 20 28 40 28 70h124c0-30 8-50 28-70A140 140 0 0 0 0-230Z" fill="${c.light}"/>
          <path d="M-30 120 0 20l30 100" fill="none" stroke="${c.accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="-62" y="95" width="124" height="28" rx="8" fill="${c.dark}"/><rect x="-54" y="128" width="108" height="28" rx="8" fill="${c.main}"/><rect x="-40" y="160" width="80" height="28" rx="12" fill="${c.dark}"/>
          <g stroke="${c.accent}" stroke-width="12" stroke-linecap="round"><path d="M-210-90h-50M210-90h50M-160-210l-36-36M160-210l36-36"/></g>
        </g>`,
    lamp: (c) => `
        <g transform="translate(400 400)">
          <ellipse cx="-30" cy="220" rx="140" ry="22" fill="${c.dark}"/>
          <path d="M-30 210 40 20 -40-120" fill="none" stroke="${c.dark}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M-110-150 10-250l120 90Z" fill="${c.main}" transform="rotate(-18 -40 -150)"/>
          <path d="M-90-160h120l30 60H-60Z" fill="${c.light}" opacity=".8" transform="rotate(-18 -40 -150)"/>
          <circle cx="-30" cy="205" r="14" fill="${c.accent}"/>
        </g>`,
    plug: (c) => `
        <g transform="translate(400 400)">
          <rect x="-150" y="-190" width="300" height="360" rx="60" fill="${c.light}"/>
          <rect x="-150" y="-190" width="300" height="360" rx="60" fill="none" stroke="${c.dark}" stroke-width="10"/>
          <rect x="-70" y="-90" width="26" height="70" rx="8" fill="${c.dark}"/><rect x="44" y="-90" width="26" height="70" rx="8" fill="${c.dark}"/>
          <path d="M-30 50a40 40 0 1 0 60 0" fill="none" stroke="${c.dark}" stroke-width="14" stroke-linecap="round"/><path d="M0 20v50" stroke="${c.dark}" stroke-width="14" stroke-linecap="round"/>
          <circle cx="0" cy="130" r="10" fill="${c.accent}"/>
        </g>`,
    camera: (c) => `
        <g transform="translate(400 400)">
          <rect x="-230" y="-140" width="460" height="200" rx="40" fill="${c.light}"/>
          <rect x="-200" y="-110" width="400" height="140" rx="26" fill="${c.dark}"/>
          <circle cx="0" cy="-40" r="58" fill="${c.main}"/><circle cx="0" cy="-40" r="30" fill="${c.dark}"/><circle cx="-12" cy="-52" r="9" fill="${c.light}"/>
          <circle cx="150" cy="-70" r="9" fill="${c.accent}"/>
          <rect x="-24" y="60" width="48" height="90" fill="${c.dark}"/><rect x="-100" y="140" width="200" height="30" rx="15" fill="${c.main}"/>
        </g>`,
    backpack: (c) => `
        <g transform="translate(400 410)">
          <path d="M-70-210a70 70 0 0 1 140 0" fill="none" stroke="${c.dark}" stroke-width="20" stroke-linecap="round"/>
          <rect x="-170" y="-200" width="340" height="420" rx="90" fill="${c.main}"/>
          <rect x="-125" y="20" width="250" height="150" rx="40" fill="${c.dark}" opacity=".35"/>
          <path d="M-100 20h200" stroke="${c.accent}" stroke-width="14" stroke-linecap="round"/>
          <rect x="-110" y="-130" width="220" height="80" rx="30" fill="${c.dark}" opacity=".25"/>
          <rect x="-14" y="48" width="28" height="36" rx="8" fill="${c.accent}"/>
        </g>`,
    watch: (c) => `
        <g transform="translate(400 400)">
          <rect x="-70" y="-300" width="140" height="600" rx="40" fill="${c.dark}"/>
          <circle cx="0" cy="0" r="165" fill="${c.main}"/><circle cx="0" cy="0" r="140" fill="${c.light}"/>
          <g stroke="${c.dark}" stroke-width="8" stroke-linecap="round"><path d="M0-122v22M0 122v-22M-122 0h22M122 0h-22"/></g>
          <path d="M0 0V-80" stroke="${c.dark}" stroke-width="12" stroke-linecap="round"/><path d="M0 0 60 30" stroke="${c.accent}" stroke-width="10" stroke-linecap="round"/>
          <circle cx="0" cy="0" r="12" fill="${c.dark}"/><rect x="165" y="-24" width="30" height="48" rx="10" fill="${c.main}"/>
        </g>`,
    sunglasses: (c) => `
        <g transform="translate(400 400)">
          <path d="M-250-60h500" stroke="${c.dark}" stroke-width="20" stroke-linecap="round"/>
          <path d="M-210-60v70c0 70 60 110 120 90 50-17 60-60 60-100v-60Z" fill="${c.main}"/>
          <path d="M210-60v70c0 70-60 110-120 90-50-17-60-60-60-100v-60Z" fill="${c.main}"/>
          <path d="M-190-30 -120 20M30-30 100 20" stroke="${c.light}" stroke-width="12" stroke-linecap="round" opacity=".7"/>
          <path d="M-30-60c10-30 50-30 60 0" fill="none" stroke="${c.dark}" stroke-width="16" stroke-linecap="round"/>
        </g>`,
    mat: (c) => `
        <g transform="translate(400 410)">
          <rect x="-250" y="-70" width="500" height="320" rx="30" fill="${c.main}" transform="skewX(-12)"/>
          <path d="M-250-70h500" stroke="${c.accent}" stroke-width="6" transform="skewX(-12)"/>
          <ellipse cx="-250" cy="-120" rx="75" ry="120" fill="${c.dark}"/><ellipse cx="-250" cy="-120" rx="40" ry="70" fill="${c.main}"/>
          <path d="M-160 20h330M-190 90h330M-220 160h330" stroke="${c.light}" stroke-width="10" stroke-linecap="round" opacity=".5"/>
        </g>`,
    bottle: (c) => `
        <g transform="translate(400 400)">
          <rect x="-48" y="-260" width="96" height="60" rx="16" fill="${c.dark}"/>
          <path d="M-70-200h140v30c40 40 50 70 50 120V210a40 40 0 0 1-40 40h-160a40 40 0 0 1-40-40V-50c0-50 10-80 50-120Z" fill="${c.main}"/>
          <rect x="-90" y="-30" width="180" height="120" rx="14" fill="${c.light}" opacity=".9"/>
          <path d="M-50 20h100M-50 56h60" stroke="${c.dark}" stroke-width="12" stroke-linecap="round"/>
          <path d="M-90-100v300" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".25"/>
        </g>`,
    dumbbell: (c) => `
        <g transform="translate(400 400) rotate(-18)">
          <rect x="-190" y="-26" width="380" height="52" rx="14" fill="${c.dark}"/>
          <rect x="-260" y="-110" width="80" height="220" rx="22" fill="${c.main}"/><rect x="-310" y="-70" width="56" height="140" rx="16" fill="${c.dark}"/>
          <rect x="180" y="-110" width="80" height="220" rx="22" fill="${c.main}"/><rect x="254" y="-70" width="56" height="140" rx="16" fill="${c.dark}"/>
          <path d="M-150-26v52M150-26v52" stroke="${c.accent}" stroke-width="10"/>
        </g>`,
    shoe: (c) => `
        <g transform="translate(400 410)">
          <path d="M-270 130V-10c0-30 10-50 40-60l60-20c20-6 30-20 36-40l8-40c50 40 100 60 160 90 60 30 110 50 170 80 30 15 36 40 36 60v60Z" fill="${c.main}"/>
          <rect x="-282" y="120" width="568" height="56" rx="28" fill="${c.light}"/>
          <path d="M-120-60 -80-20M-70-80 -30-40M-20-100 20-60" stroke="${c.light}" stroke-width="10" stroke-linecap="round"/>
          <path d="M-60 60C60 20 150 60 240 110" fill="none" stroke="${c.accent}" stroke-width="16" stroke-linecap="round"/>
        </g>`,
    kettle: (c) => `
        <g transform="translate(400 410)">
          <path d="M-150 220V-20c0-100 60-150 150-150s150 50 150 150v240Z" fill="${c.main}"/>
          <path d="M150 20c90-30 120 10 120 60 0 60-30 90-120 90" fill="none" stroke="${c.dark}" stroke-width="22" stroke-linecap="round"/>
          <path d="M-150 60c-60-10-100-70-120-120" fill="none" stroke="${c.main}" stroke-width="40" stroke-linecap="round"/>
          <rect x="-40" y="-220" width="80" height="50" rx="22" fill="${c.dark}"/><rect x="-170" y="212" width="340" height="30" rx="15" fill="${c.dark}"/>
          <path d="M-100-40v200" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity=".25"/>
        </g>`,
    mug: (c) => `
        <g transform="translate(400 410)">
          <path d="M-140-120h250v250c0 70-50 100-125 100S-140 200-140 130Z" fill="${c.main}"/>
          <path d="M110-60c110-10 110 140 0 130" fill="none" stroke="${c.main}" stroke-width="30" stroke-linecap="round"/>
          <ellipse cx="-15" cy="-120" rx="125" ry="26" fill="${c.dark}"/><ellipse cx="-15" cy="-122" rx="105" ry="17" fill="${c.accent}"/>
          <path d="M-90 20 -40 90" stroke="${c.light}" stroke-width="12" stroke-linecap="round" opacity=".5"/>
        </g>`,
    board: (c) => `
        <g transform="translate(400 400) rotate(-10)">
          <rect x="-230" y="-150" width="460" height="300" rx="60" fill="${c.main}"/>
          <circle cx="170" cy="-95" r="26" fill="${c.dark}" opacity=".5"/>
          <path d="M-190-90c80 30 120-30 200 0s100-20 170 0M-190 0c80 30 120-30 200 0s100-20 170 0M-190 90c80 30 120-30 200 0s100-20 170 0" fill="none" stroke="${c.accent}" stroke-width="8" opacity=".6"/>
        </g>`,
    airfryer: (c) => `
        <g transform="translate(400 410)">
          <rect x="-190" y="-230" width="380" height="450" rx="110" fill="${c.main}"/>
          <rect x="-150" y="-190" width="300" height="130" rx="40" fill="${c.dark}"/>
          <circle cx="-70" cy="-125" r="26" fill="${c.accent}"/><circle cx="10" cy="-125" r="26" fill="${c.light}" opacity=".8"/><rect x="60" y="-140" width="60" height="30" rx="15" fill="${c.light}" opacity=".6"/>
          <rect x="-150" y="-20" width="300" height="190" rx="50" fill="${c.dark}" opacity=".85"/><rect x="-60" y="30" width="120" height="24" rx="12" fill="${c.light}"/>
        </g>`,
};

const palettes = {
    audio: { bg: ["#ede9fe", "#c4b5fd"], main: "#6d28d9", accent: "#f59e0b", dark: "#1f1b3a", light: "#f5f3ff" },
    computers: { bg: ["#e0f2fe", "#93c5fd"], main: "#1d4ed8", accent: "#22d3ee", dark: "#0f172a", light: "#eff6ff" },
    "smart-home": { bg: ["#fef3c7", "#fcd34d"], main: "#d97706", accent: "#0ea5e9", dark: "#3b2a0a", light: "#fffbeb" },
    accessories: { bg: ["#fce7f3", "#f9a8d4"], main: "#be185d", accent: "#fbbf24", dark: "#3b0a24", light: "#fff1f9" },
    fitness: { bg: ["#dcfce7", "#86efac"], main: "#15803d", accent: "#f97316", dark: "#052e16", light: "#f0fdf4" },
    "home-kitchen": { bg: ["#ffedd5", "#fdba74"], main: "#c2410c", accent: "#14b8a6", dark: "#431407", light: "#fff7ed" },
};

// variant tweaks give gallery images (front, alternate colourway, close-up)
const variants = [
    { id: "a", scale: 1, rotate: 0, hue: 0 },
    { id: "b", scale: 0.92, rotate: 0, hue: 1 },
    { id: "c", scale: 1.45, rotate: 0, hue: 0, shift: [0, 60] },
];

function svg(shape, category, variant) {
    const p = palettes[category];
    const swap = variant.hue ? { ...p, main: p.accent, accent: p.main } : p;
    const [bg1, bg2] = p.bg;
    const [sx, sy] = variant.shift || [0, 0];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-hidden="true">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <circle cx="650" cy="150" r="220" fill="#fff" opacity=".22"/><circle cx="120" cy="700" r="160" fill="#fff" opacity=".16"/>
  <ellipse cx="400" cy="660" rx="${210 * variant.scale}" ry="20" fill="#000" opacity=".12"/>
  <g transform="translate(${400 + sx} ${400 + sy}) scale(${variant.scale}) translate(-400 -400)">${shapes[shape](swap)}</g>
</svg>`;
}

/** @param {{slug:string, art:string, category:string}[]} products */
export function generateProductArt(products) {
    mkdirSync(OUT_DIR, { recursive: true });
    const photos = { "photo-1.jpeg": "nimbus-smart-speaker.jpg", "photo-2.jpg": "aurora-wireless-headphones.jpg", "photo-3.jpg": "zenbook-air-14-laptop.jpg", "photo-4.jpg": "felt-card-holder-wallet.jpg" };
    for (const [from, to] of Object.entries(photos)) {
        const src = join(PHOTO_DIR, from);
        if (existsSync(src)) copyFileSync(src, join(OUT_DIR, to));
    }
    for (const product of products) {
        if (!product.art) continue;
        for (const v of variants) {
            writeFileSync(join(OUT_DIR, `${product.slug}-${v.id}.svg`), svg(product.art, product.category, v));
        }
    }
    return OUT_DIR;
}
