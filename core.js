// ═══════════════════════════════════════════════════
//  CORE SHARED LOGIC
// ═══════════════════════════════════════════════════

// --- THREE.JS CORE ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x040410);
window.addEventListener('DOMContentLoaded', () => {
    if (!renderer.domElement.parentNode) {
        document.body.insertBefore(renderer.domElement, document.body.firstChild);
    }
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 20000);
const clock = new THREE.Clock();

let camTheta = 0, camPhi = 1.15, camRadius = 1800;
let targetTheta = 0, targetPhi = 1.15, targetRadius = 1800;
let targetCamX = 0, targetCamY = 0, camX = 0, camY = 0;
const camTarget = new THREE.Vector3(0, 0, 0);

// --- SHARED STATE ---
let stage = 0, isPlaying = false, speedFactor = 0, autoFollow = true, draggedPlanet = null;
let planets = [], lostPlanets = [], selectedPlanets = [], sunObj = null;
let labelEls = {};

// --- GLOBAL UTILS ---
const raycaster = new THREE.Raycaster();
const mouse2d = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPoint = new THREE.Vector3();

function updateCameraPosition() {
    camera.position.set(
        camTarget.x + camX + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
        camTarget.y + camY + camRadius * Math.cos(camPhi),
        camTarget.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
    );
    camera.lookAt(camTarget.x + camX, camTarget.y + camY, camTarget.z);
}

// --- CAMERA CONTROLS ---
function setOrbitView(dir) {
    const views = { north: 0, east: Math.PI / 2, south: Math.PI, west: Math.PI * 1.5 };
    if (views[dir] !== undefined) targetTheta = views[dir];
    autoFollow = false;
}

function setZoomLevel(level) {
    // Handling different zoom systems from L1 and L2
    if (level === 0.5) targetRadius = 3200;
    else if (level === 1) targetRadius = 2400;
    else if (level === 2) targetRadius = 1900;
    else if (level === 3) targetRadius = 1200;
    autoFollow = false;
}

function setTiltView(view) {
    if (view === 'top') { targetPhi = 0.18; targetRadius = 2800; }
    else if (view === 'side') { targetPhi = 1.42; targetRadius = 2400; }
    autoFollow = false;
}

// --- UTILS ---
function noise2D(x, y, seed) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
    return n - Math.floor(n);
}

function smoothNoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = noise2D(ix, iy, seed);
    const b = noise2D(ix + 1, iy, seed);
    const c = noise2D(ix, iy + 1, seed);
    const d = noise2D(ix + 1, iy + 1, seed);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

function fbm(x, y, seed, octaves = 5) {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
        v += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
        amp *= 0.5; freq *= 2;
    }
    return v;
}

// --- FX CANVAS ---
let fxCanvas, fxCtx;
const particles = [];

function initFX() {
    fxCanvas = document.getElementById('fx-canvas');
    if (!fxCanvas) return;
    fxCtx = fxCanvas.getContext('2d');
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
}

function spawnParticles(screenX, screenY, opts = {}) {
    if (!fxCtx) return;
    const { count = 18, color = '#ffffff', minR = 2, maxR = 6, speed = 3.5, life = 60, ring = false, huge = false } = opts;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const spd = speed * (0.5 + Math.random());
        const r = minR + Math.random() * (maxR - minR);
        particles.push({ x: screenX, y: screenY, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, r, life, maxLife: life, color });
    }
    if (ring) particles.push({ type: 'ring', x: screenX, y: screenY, r: 4, maxR: huge ? 160 : 80, life: 30, maxLife: 30, color });
}

function projectToScreen(wx, wy, wz) {
    const v = new THREE.Vector3(wx, wy, wz);
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, visible: v.z < 1 };
}

function tickFX() {
    if (!fxCtx) return;
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.life--;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const t = p.life / p.maxLife;
        if (p.type === 'ring') {
            p.r = p.maxR * (1 - t);
            fxCtx.beginPath(); fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            fxCtx.strokeStyle = p.color; fxCtx.globalAlpha = t * 0.7; fxCtx.stroke(); fxCtx.globalAlpha = 1; continue;
        }
        p.x += p.vx; p.y += p.vy;
        fxCtx.beginPath(); fxCtx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
        fxCtx.fillStyle = p.color; fxCtx.globalAlpha = t * 0.85; fxCtx.fill(); fxCtx.globalAlpha = 1;
    }
}

function showFloatingMessage(text, color = '#ffffff') {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) scale(0.9);padding:12px 22px;border-radius:999px;background:rgba(0,0,0,.72);color:' + color + ';font-weight:900;font-size:1.15em;z-index:120;pointer-events:none;opacity:0;transition:opacity .25s,transform .5s';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translate(-50%,-70%) scale(1)'; });
    setTimeout(() => {
        el.style.opacity = '0'; el.style.transform = 'translate(-50%,-95%) scale(1.08)';
        setTimeout(() => el.remove(), 500);
    }, 900);
}

function showToast(msg = "Pause first!") {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.style.visibility = 'visible'; t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => { t.style.visibility = 'hidden'; }, 300); }, 2000);
}

function getWorldXZ(cx, cy) {
    mouse2d.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    raycaster.ray.intersectPlane(dragPlane, dragPoint);
    return { x: dragPoint.x, z: dragPoint.z };
}

function getWorldDragPoint(mx, my) {
    mouse2d.set((mx / window.innerWidth) * 2 - 1, -(my / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    raycaster.ray.intersectPlane(dragPlane, dragPoint);
    return dragPoint.clone();
}

// --- RESIZE ---
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (fxCanvas) {
        fxCanvas.width = window.innerWidth;
        fxCanvas.height = window.innerHeight;
    }
});