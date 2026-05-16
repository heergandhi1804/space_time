// level2_assets.js
// Procedural texture generation for Level 2

const TEX_W = 512, TEX_H = 256;

function drawSunTexture(ctx, seed) {
    const img = ctx.createImageData(TEX_W, TEX_H);
    for (let y = 0; y < TEX_H; y++) {
        for (let x = 0; x < TEX_W; x++) {
            const n = fbm(x / 14, y / 14, seed, 5);
            const granule = fbm(x / 4, y / 4, seed + 50, 3) * 0.25;
            const v = Math.min(1, n * 0.7 + granule + 0.35);
            const r = Math.round(255 * Math.min(1, v + 0.1));
            const g = Math.round(190 * v + 60);
            const b = Math.round(60 * v);
            const i = (y * TEX_W + x) * 4;
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function drawRockyTexture(ctx, seed, baseHex, darkHex, lightHex, craterDensity = 0.3) {
    const img = ctx.createImageData(TEX_W, TEX_H);
    const baseR = (baseHex >> 16) & 0xff, baseG = (baseHex >> 8) & 0xff, baseB = baseHex & 0xff;
    const darkR = (darkHex >> 16) & 0xff, darkG = (darkHex >> 8) & 0xff, darkB = darkHex & 0xff;
    const lightR = (lightHex >> 16) & 0xff, lightG = (lightHex >> 8) & 0xff, lightB = lightHex & 0xff;
    for (let y = 0; y < TEX_H; y++) {
        for (let x = 0; x < TEX_W; x++) {
            const n = fbm(x / 22, y / 18, seed, 5);
            const detail = fbm(x / 6, y / 6, seed + 100, 3);
            let r, g, b;
            if (n < 0.4) {
                const t = n / 0.4;
                r = darkR + (baseR - darkR) * t;
                g = darkG + (baseG - darkG) * t;
                b = darkB + (baseB - darkB) * t;
            } else {
                const t = (n - 0.4) / 0.6;
                r = baseR + (lightR - baseR) * t;
                g = baseG + (lightG - baseG) * t;
                b = baseB + (lightB - baseB) * t;
            }
            const shade = 0.85 + detail * 0.3;
            r *= shade; g *= shade; b *= shade;
            const i = (y * TEX_W + x) * 4;
            img.data[i] = Math.min(255, r); img.data[i + 1] = Math.min(255, g);
            img.data[i + 2] = Math.min(255, b); img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const craters = Math.floor(craterDensity * 80);
    for (let k = 0; k < craters; k++) {
        const cx = Math.random() * TEX_W, cy = Math.random() * TEX_H, cr = 2 + Math.random() * 8;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(0.7, 'rgba(0,0,0,0.15)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    }
}

function drawEarthTexture(ctx, seed) {
    const img = ctx.createImageData(TEX_W, TEX_H);
    for (let y = 0; y < TEX_H; y++) {
        for (let x = 0; x < TEX_W; x++) {
            const continent = fbm(x / 30, y / 22, seed, 5);
            const detail = fbm(x / 8, y / 8, seed + 30, 3);
            const latFactor = Math.abs(y / TEX_H - 0.5) * 2;
            let r, g, b;
            if (continent < 0.48) {
                const depth = continent / 0.48;
                r = 20 + depth * 40; g = 60 + depth * 60; b = 130 + depth * 70;
            } else {
                const land = (continent - 0.48) / 0.52;
                if (latFactor > 0.85) { r = 230; g = 235; b = 240; }
                else if (latFactor > 0.6) {
                    const t = (latFactor - 0.6) / 0.25;
                    r = 110 + t * 120; g = 100 + t * 135; b = 70 + t * 170;
                } else {
                    r = 60 + land * 90; g = 110 + land * 60; b = 50 + land * 30;
                }
            }
            const cloud = fbm(x / 18, y / 14, seed + 70, 4);
            if (cloud > 0.62) {
                const c = (cloud - 0.62) / 0.38;
                r = r + (255 - r) * c * 0.7; g = g + (255 - g) * c * 0.7; b = b + (255 - b) * c * 0.7;
            }
            const shade = 0.9 + detail * 0.2;
            r *= shade; g *= shade; b *= shade;
            const i = (y * TEX_W + x) * 4;
            img.data[i] = Math.min(255, r); img.data[i + 1] = Math.min(255, g);
            img.data[i + 2] = Math.min(255, b); img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function drawCloudyTexture(ctx, seed, baseHex, swirlHex) {
    const img = ctx.createImageData(TEX_W, TEX_H);
    const baseR = (baseHex >> 16) & 0xff, baseG = (baseHex >> 8) & 0xff, baseB = baseHex & 0xff;
    const swirlR = (swirlHex >> 16) & 0xff, swirlG = (swirlHex >> 8) & 0xff, swirlB = swirlHex & 0xff;
    for (let y = 0; y < TEX_H; y++) {
        for (let x = 0; x < TEX_W; x++) {
            const swirl = fbm(x / 26, y / 8 + Math.sin(x / 40) * 2, seed, 4);
            const detail = fbm(x / 6, y / 6, seed + 12, 3);
            const t = swirl * 0.7 + detail * 0.3;
            const r = baseR + (swirlR - baseR) * t, g = baseG + (swirlG - baseG) * t, b = baseB + (swirlB - baseB) * t;
            const i = (y * TEX_W + x) * 4;
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function drawGasGiantTexture(ctx, seed, bandHexes, turbulence = 1, hasGreatSpot = false) {
    const img = ctx.createImageData(TEX_W, TEX_H);
    for (let y = 0; y < TEX_H; y++) {
        const lat = y / TEX_H, warp = fbm(lat * 8, seed * 3, seed + 5, 3) * 0.05 * turbulence, bandPos = lat + warp;
        const bandIdx = Math.min(bandHexes.length - 1, Math.floor(bandPos * bandHexes.length)), nextIdx = Math.min(bandHexes.length - 1, bandIdx + 1), bandT = (bandPos * bandHexes.length) - bandIdx;
        for (let x = 0; x < TEX_W; x++) {
            const flow = fbm(x / 30 + lat * 0.5, lat * 60, seed + 22, 3) * turbulence * 0.4, detail = fbm(x / 8, y / 4, seed + 33, 3) * 0.15, t = Math.max(0, Math.min(1, bandT + flow + detail));
            const a = bandHexes[bandIdx], b = bandHexes[nextIdx], ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff, br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
            let r = ar + (br - ar) * t, g = ag + (bg - ag) * t, bl = ab + (bb - ab) * t;
            if (hasGreatSpot) {
                const dx = (x - TEX_W * 0.65) / 28, dy = (y - TEX_H * 0.62) / 14, sd = Math.sqrt(dx * dx + dy * dy);
                if (sd < 1) { const sf = 1 - sd; r = r * (1 - sf * 0.6) + 200 * sf * 0.6; g = g * (1 - sf * 0.6) + 70 * sf * 0.6; bl = bl * (1 - sf * 0.6) + 50 * sf * 0.6; }
            }
            const i = (y * TEX_W + x) * 4;
            img.data[i] = Math.min(255, r); img.data[i + 1] = Math.min(255, g); img.data[i + 2] = Math.min(255, bl); img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function createProceduralPlanetTexture(name, fallbackColorHex) {
    try {
        const c = document.createElement('canvas'); c.width = TEX_W; c.height = TEX_H;
        const ctx = c.getContext('2d'), seed = name.length * 13.7;
        switch (name) {
            case 'Sun': drawSunTexture(ctx, seed); break;
            case 'Mercury': drawRockyTexture(ctx, seed, 0x8a7a6e, 0x4a4038, 0xc4b5a3, 0.5); break;
            case 'Venus': drawCloudyTexture(ctx, seed, 0xd9b870, 0xf2dca0); break;
            case 'Earth': drawEarthTexture(ctx, seed); break;
            case 'Mars': drawRockyTexture(ctx, seed, 0xb55a35, 0x6e2d18, 0xe89870, 0.35); break;
            case 'Jupiter': drawGasGiantTexture(ctx, seed, [0xc9a070, 0xe8d5a8, 0xa07848, 0xd8b888, 0xb08858, 0xe5cda0, 0xb89868], 1.4, true); break;
            case 'Saturn': drawGasGiantTexture(ctx, seed, [0xd8c08a, 0xece0b8, 0xc0a878, 0xe8d8a8, 0xc8b088], 0.7, false); break;
            case 'Uranus': drawGasGiantTexture(ctx, seed, [0xa8d8d8, 0xc0e8e6, 0x8fc8c5, 0xb5dcd9], 0.4, false); break;
            case 'Neptune': drawGasGiantTexture(ctx, seed, [0x3858a8, 0x5878c8, 0x2a4090, 0x6488d0, 0x3050a0], 0.9, false); break;
            default: {
                let baseHex = 0x808890, darkHex = 0x404048, lightHex = 0xb0b8c0;
                if (fallbackColorHex !== undefined) {
                    const num = typeof fallbackColorHex === 'number' ? fallbackColorHex : parseInt(String(fallbackColorHex).replace('#', ''), 16);
                    if (!isNaN(num)) {
                        baseHex = num;
                        const dr = Math.round(((num >> 16) & 0xff) * 0.45), dg = Math.round(((num >> 8) & 0xff) * 0.45), db = Math.round((num & 0xff) * 0.45);
                        darkHex = (dr << 16) | (dg << 8) | db;
                        const lr = Math.min(255, Math.round(((num >> 16) & 0xff) * 1.4)), lg = Math.min(255, Math.round(((num >> 8) & 0xff) * 1.4)), lb = Math.min(255, Math.round((num & 0xff) * 1.4));
                        lightHex = (lr << 16) | (lg << 8) | lb;
                    }
                }
                drawRockyTexture(ctx, seed, baseHex, darkHex, lightHex, 0.25);
                break;
            }
        }
        const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = 4;
        return tex;
    } catch (e) {
        console.warn('[SpaceTime] Texture gen failed for', name, e);
        return null;
    }
}
