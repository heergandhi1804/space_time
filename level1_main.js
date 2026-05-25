// ═══════════════════════════════════════════════════
//  LEVEL 1 - MAIN ORCHESTRATION
// ═══════════════════════════════════════════════════

// --- FACTORY FUNCTIONS ---
function createPlanetMaterial(name, hex) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const ctx = c.getContext('2d'), img = ctx.createImageData(512, 256);
    const seed = name.length * 13.7;
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
        const n = fbm(x / 18, y / 14, seed), i = (y * 512 + x) * 4;
        img.data[i] = Math.min(255, r * (0.6 + n * 0.5));
        img.data[i + 1] = Math.min(255, g * (0.6 + n * 0.5));
        img.data[i + 2] = Math.min(255, b * (0.6 + n * 0.5));
        img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    if (name === 'Sun' || name === 'SUN') return new THREE.MeshBasicMaterial({ map: tex });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 });
}

function createStage1CentralMaterial() {
    // Procedural watermelon: green base with darker longitudinal stripes
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    // Base green
    ctx.fillStyle = '#3a8c2f';
    ctx.fillRect(0, 0, 512, 256);
    // Lighter green layer via noise-like banding
    for (let x = 0; x < 512; x++) {
        const t = x / 512;
        const stripe = Math.sin(t * Math.PI * 14) * 0.5 + 0.5;
        const light = stripe > 0.52 ? 'rgba(80,180,60,0.45)' : 'rgba(20,70,10,0.35)';
        ctx.fillStyle = light;
        ctx.fillRect(x, 0, 1, 256);
    }
    // Subtle highlight band near equator
    const grad = ctx.createLinearGradient(0, 90, 0, 166);
    grad.addColorStop(0, 'rgba(140,220,100,0.10)');
    grad.addColorStop(0.5, 'rgba(180,255,120,0.18)');
    grad.addColorStop(1, 'rgba(140,220,100,0.10)');
    ctx.fillStyle = grad; ctx.fillRect(0, 90, 512, 76);
    // Fine speckles for texture
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 900; i++) { ctx.fillStyle = '#000'; ctx.fillRect(Math.random()*512, Math.random()*256, 1, 1); }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.0, emissive: 0x081a04, emissiveIntensity: 0.1 });
}

function makeStage1CentralMesh(mass) {
    const r = Math.max(65, mass * 0.5);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createStage1CentralMaterial());
}

let _saturnRingTex = null;
function getSaturnRingTexture() {
    if (_saturnRingTex) return _saturnRingTex;
    const w = 512, h = 64, c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    for (let x = 0; x < w; x++) {
        const t = x / w;
        const a = (t < 0.05 || (t > 0.4 && t < 0.5) || t > 0.95) ? 0 : 0.4 + 0.3 * Math.sin(t * 50);
        ctx.fillStyle = `rgba(220,200,160,${a})`; ctx.fillRect(x, 0, 1, h);
    }
    _saturnRingTex = new THREE.CanvasTexture(c); return _saturnRingTex;
}

function createPlanetExtras(p) {
    if (p.name !== 'Saturn') return;
    const r = p.mass * 0.45;
    const geo = new THREE.RingGeometry(r * 1.4, r * 2.4, 64);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        const d = Math.hypot(pos.getX(i), pos.getY(i));
        uv.setXY(i, (d - r * 1.4) / r, 0.5);
    }
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: getSaturnRingTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false
    }));
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);
    p.extras = { ring };
}

// --- GRID & BLANKET ---
scene.add(new THREE.AmbientLight(0x556680, 1.6));
const sunLight = new THREE.PointLight(0xffe6b0, 2.8, 8000, 1.2); scene.add(sunLight);

const gridGeo = new THREE.BufferGeometry();
const VCOUNT = (GRID_SEGS + 1) * (GRID_SEGS + 1);
const positions = new Float32Array(VCOUNT * 3), gridColors = new Float32Array(VCOUNT * 3), gridXZ = [];
for (let iz = 0; iz <= GRID_SEGS; iz++)
    for (let ix = 0; ix <= GRID_SEGS; ix++)
        gridXZ.push(-GRID_SIZE + ix * (GRID_SIZE * 2 / GRID_SEGS), -GRID_SIZE + iz * (GRID_SIZE * 2 / GRID_SEGS));
const idxList = [];
for (let iz = 0; iz <= GRID_SEGS; iz++)
    for (let ix = 0; ix < GRID_SEGS; ix++)
        idxList.push(iz * (GRID_SEGS + 1) + ix, iz * (GRID_SEGS + 1) + ix + 1);
for (let ix = 0; ix <= GRID_SEGS; ix++)
    for (let iz = 0; iz < GRID_SEGS; iz++)
        idxList.push(iz * (GRID_SEGS + 1) + ix, (iz + 1) * (GRID_SEGS + 1) + ix);
gridGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
gridGeo.setAttribute('color', new THREE.BufferAttribute(gridColors, 3));
gridGeo.setIndex(idxList);
const gridMesh = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 }));
scene.add(gridMesh);

function warpDepth(wx, wz, ignore) {
    let y = 0;
    for (const p of planets) {
        if (p === ignore) continue;
        const d = Math.hypot(p.x - wx, p.z - wz);
        y += (-p.mass * 5.0) / (Math.pow(d / 18, 0.4) + 1);
    }
    return y;
}
function updateGrid() {
    const pos = gridGeo.attributes.position, col = gridGeo.attributes.color;
    for (let i = 0; i < VCOUNT; i++) {
        const wx = gridXZ[i * 2], wz = gridXZ[i * 2 + 1], wy = warpDepth(wx, wz);
        pos.setXYZ(i, wx, wy, wz);
        const depth = Math.min(1, Math.abs(wy) / 400);
        col.setXYZ(i, 0.3 + depth * 0.7, 0.55 + depth * 0.45, 1.0);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
}

let blanketMesh = null, blanketGeo = null;
function createBlanket() {
    if (blanketMesh) return;
    blanketGeo = new THREE.PlaneGeometry(2200, 2200, 100, 100); blanketGeo.rotateX(-Math.PI / 2);
    // Grid-pattern canvas texture so deformation is clearly visible
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#050d24'; ctx.fillRect(0, 0, 512, 512);
    const cells = 20, step = 512 / cells;
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= cells; i++) {
        const t = i / cells;
        // Brighter at center, dimmer at edges
        const alpha = 0.35 + 0.3 * (1 - Math.abs(t * 2 - 1));
        ctx.strokeStyle = `rgba(60,140,255,${alpha.toFixed(2)})`;
        const p = i * step;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5);
    blanketMesh = new THREE.Mesh(blanketGeo, new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.85, emissive: 0x010612, emissiveIntensity: 0.55, side: THREE.DoubleSide
    }));
    scene.add(blanketMesh);
}
function computeBlanketY(wx, wz, ignore) {
    let y = 0;
    if (s1CentralObj && s1CentralObj !== ignore) {
        const d = Math.hypot(wx, wz);
        const m = s1CentralObj.mass;
        // Depth and well-width both scale with mass so heavier objects produce
        // visibly wider, deeper gravity wells — not just bigger spheres.
        const maxDepth = 60 + m * 1.1;
        const wellWidth = 80 + m * 3.8;
        const u = d / wellWidth;
        y -= maxDepth / (1 + u * u * 1.2);
    }
    for (const b of s1Balls) {
        if (!b.alive || b === ignore) continue;
        const dx = b.x - wx, dz = b.z - wz;
        const d = Math.hypot(dx, dz);
        const br = b.radius;
        const ballDepth = br * 0.55;
        const ballWidth = br * 2.8;
        const u = d / ballWidth;
        y -= ballDepth / (1 + u * u * 1.6);
    }
    return y;
}
function updateBlanketDeformation() {
    if (!blanketGeo) return;
    const pos = blanketGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, computeBlanketY(pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true; blanketGeo.computeVertexNormals();
}

// --- FACTORY ---
function makeGlowSprite(name, hex, r) {
    const canv = document.createElement('canvas'); canv.width = 64; canv.height = 64;
    const ctx = canv.getContext('2d'), c = new THREE.Color(hex);
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${~~(c.r * 255)},${~~(c.g * 255)},${~~(c.b * 255)},0.6)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canv), transparent: true, depthWrite: false }));
    sprite.scale.set(r * 5, r * 5, 1); return sprite;
}
function addPlanet(x, z, m, hex, name, r) {
    const h = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
    const mesh = makePlanetMesh(name, m, h), glow = makeGlowSprite(name, h, m * 0.45);
    const sel = new THREE.Object3D(); sel.visible = false;
    mesh.add(sel); scene.add(mesh); scene.add(glow);
    if (!labelEls[name]) {
        const el = document.createElement('div'); el.className = 'planet-label'; el.innerText = name;
        document.getElementById('labels').appendChild(el); labelEls[name] = el;
    }
    labelEls[name].style.display = 'block';
    const p = { x, z, mass: m, color: hex, name, initialR: r, dist: r, angle: Math.atan2(z, x), vx: 0, vz: 0, mesh, glow, selRing: sel, isDynamic: false, stage2Modified: false, history: [] };
    createPlanetExtras(p); mesh.userData.planet = p; planets.push(p); return p;
}
function makePlanetMesh(name, mass, hex) {
    const r = mass * 0.45;
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createPlanetMaterial(name, hex));
}
function makeStage1BallMesh(mass, hex) {
    const r = 12 + Math.sqrt(mass) * 2.8;
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createPlanetMaterial('Ball', hex));
}

function syncMeshPosition(p) {
    const visualRadius = p.radius || p.mass * 0.45;
    // Stages 1 and 2 both use the blanket surface; stage 3 uses the warp-depth grid
    const onBlanket = stage === 1 || stage === 2;
    const wy = onBlanket ? computeBlanketY(p.x, p.z, p) : warpDepth(p.x, p.z, p);
    const py = onBlanket ? wy + visualRadius : wy + visualRadius * 0.55 + 4;
    p.mesh.position.set(p.x, py, p.z);
    p.glow.position.set(p.x, py, p.z);
    if (p.extras && p.extras.ring) p.extras.ring.position.set(p.x, py, p.z);
    if (p.orbitRing) updateOrbitRing(p);
}

function updateOrbitRing(p) {
    if (!p.orbitRing || !sunObj) return;
    const r = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
    p.orbitRing.scale.set(r, r, 1);
    p.orbitRing.position.set(sunObj.x, p.mesh.position.y, sunObj.z);
    // S3: update ring colors, escape ring, and trail each frame
    if (stage === 3 && typeof updateS3RingVisuals === 'function') updateS3RingVisuals(p);
}

function createOrbitRing(p) {
    // Widen ring and tint it with a brightened version of the planet's color
    const raw = typeof p.color === 'number' ? p.color : parseInt(String(p.color).replace('#', ''), 16);
    const rr = Math.min(255, ((raw >> 16) & 0xff) + 80);
    const rg = Math.min(255, ((raw >> 8) & 0xff) + 80);
    const rb = Math.min(255, (raw & 0xff) + 80);
    const ringColor = (rr << 16) | (rg << 8) | rb;
    p._orbitRingBaseColor = ringColor; // saved for dynamic re-coloring in S3
    const geo = new THREE.RingGeometry(0.993, 1.007, 128);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: ringColor, transparent: true, opacity: 0.60,
        side: THREE.DoubleSide, depthWrite: false
    }));
    ring.rotation.x = Math.PI / 2;
    scene.add(ring); p.orbitRing = ring;
}

// --- PHYSICS ---
function updatePhysics(dt) {
    // Stage 3 (Solar System) physics only — stage 1/2 use updateStage1Physics directly
    // Only the central sun attracts planets; no planet-to-planet gravity.
    const subs = 8, stepDt = (dt * 140 * getStage2SpeedMultiplier()) / subs;
    for (let s = 0; s < subs; s++) {
        for (const p of planets) {
            if (p === sunObj || !p.stage2Modified || !sunObj) continue;
            const dx = sunObj.x - p.x, dz = sunObj.z - p.z;
            const r = Math.max(Math.hypot(dx, dz), 15);
            let f = G * sunObj.mass / (r * r);
            f = Math.min(f, 20000);
            const ux = dx / r, uz = dz / r;
            p.vx += f * ux * stepDt; p.vz += f * uz * stepDt;
            p.x += p.vx * stepDt; p.z += p.vz * stepDt;
        }
    }
    for (const p of planets) if (p !== sunObj && !p.stage2Modified) {
        const r = p.dist;
        if (sunObj && sunObj.mass >= 50) {
            const w = Math.sqrt(G * sunObj.mass / r) / r;
            p.angle += w * dt * 108 * getStage2SpeedMultiplier();
            p.x = Math.cos(p.angle) * r; p.z = Math.sin(p.angle) * r;
        }
    }
    checkStage3Escapes();
    checkPlanetCrashes();
}

function checkPlanetCrashes() {
    // Only check planet-vs-sun crashes. Planet-to-planet deletion is disabled so
    // Venus and Earth (and dragged planets) can overlap without disappearing.
    if (!isPlaying || stage === 1 || !sunObj) return;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i]; if (p === sunObj) continue;
        if (stage === 2 && !p.stage2Modified) continue; // kinematic stage-2 never actually hits sun
        const dSun = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
        if (dSun < (p.mass * 0.45) + (sunObj.mass * 0.45) + 8) {
            const s = projectToScreen(p.x, 0, p.z);
            if (s.visible) {
                if (stage === 3) {
                    // Child-friendly burst: two-layer explosion — glow ring + sparks
                    spawnParticles(s.x, s.y, { count: 50, color: '#ffaa44', life: 65, speed: 5.5, ring: true, huge: true });
                    spawnParticles(s.x, s.y, { count: 24, color: '#ffdd88', life: 45, speed: 3.2 });
                    showFloatingMessage('Falling In! 💥', '#ff8844');
                } else {
                    spawnParticles(s.x, s.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true, huge: true });
                    showFloatingMessage('Crash!', '#ffb080');
                }
            }
            if (stage === 3 && typeof _s3FocusPlanet !== 'undefined' && _s3FocusPlanet === p) {
                _s3FocusPlanet = null;
                if (typeof updateS3InfoPanel === 'function') updateS3InfoPanel(null);
                if (typeof closeS3Popup === 'function') closeS3Popup();
            }
            removePlanetFromScene(p); planets.splice(i, 1);
        }
    }
}

function removePlanetFromScene(p) {
    scene.remove(p.mesh); scene.remove(p.glow);
    if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
    if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    if (p.trailLine) { scene.remove(p.trailLine); if (p.trailLine.geometry) p.trailLine.geometry.dispose(); if (p.trailLine.material) p.trailLine.material.dispose(); p.trailLine = null; }
}

// --- STAGE SWITCHER ---
function setStage(s) {
    if (isPlaying) togglePlay();
    // Always clear any pending direction choice from L1S2 before switching
    s2PendingBall = null;
    if (typeof hideS2DirectionOverlay === 'function') hideS2DirectionOverlay();
    stage = s;
    s1Balls.forEach(b => { scene.remove(b.mesh); scene.remove(b.glow); });
    s1Balls = []; selectedS1Ball = null;
    if (s1CentralObj) { scene.remove(s1CentralObj.mesh); scene.remove(s1CentralObj.glow); s1CentralObj = null; }
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) scene.remove(p.orbitRing);
        if (p.extras && p.extras.ring) scene.remove(p.extras.ring);
        if (p.trailLine) scene.remove(p.trailLine);
    });
    planets = []; lostPlanets = []; updateLostList();
    Object.values(labelEls).forEach(el => el.style.display = 'none');
    if (blanketMesh) { scene.remove(blanketMesh); blanketMesh = null; blanketGeo = null; }
    document.getElementById('landing-hub').style.display = 'none';
    document.getElementById('ui-header').style.display = 'block';
    document.getElementById('stage1-panel').style.display = s === 1 ? 'flex' : 'none';
    document.getElementById('stage2-panel').style.display = s === 2 ? 'flex' : 'none';
    document.getElementById('stage3-panel').style.display = s === 3 ? 'flex' : 'none';
    document.getElementById('btn-play').style.display = s === 0 ? 'none' : 'inline-block';
    if (typeof closeS3Popup === 'function') closeS3Popup();
    const infoCard = document.getElementById('s3-planet-info');
    if (infoCard) infoCard.style.display = s === 3 ? 'block' : 'none';
    // On mobile: start collapsed so the panel doesn't cover the simulation.
    // On desktop: always expanded.
    ['stage1-panel', 'stage2-panel', 'stage3-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (window.innerWidth <= 768) el.classList.add('panel-collapsed');
        else el.classList.remove('panel-collapsed');
    });
    ['hint-s1','hint-s2','hint-s3'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const hintMap = { 1: 'hint-s1', 2: 'hint-s2', 3: 'hint-s3' };
    if (hintMap[s]) { const el = document.getElementById(hintMap[s]); if (el) el.style.display = 'inline-block'; }
    if (s === 3) { if (typeof buildS3PlanetList === 'function') buildS3PlanetList(); }
    if (s === 1) {
        createBlanket(); resetStage1Lab(); gridMesh.visible = false;
    } else if (s === 2) {
        createBlanket(); gridMesh.visible = false;
        s2PendingBall = null; hideS2DirectionOverlay();
        createS1CentralObject(S1_CENTRAL_PRESETS[s1Config.centralPreset || 'light'].mass);
        updateS1Counter();
    } else if (s === 3) {
        gridMesh.visible = true; resetStage3SolarSystem();
    }
    resetCamera();
}

function togglePlay() {
    if (stage === 3 && planets.filter(p => p !== sunObj).length < 1 && !isPlaying) return showToast('No planets yet!');
    if (s2PendingBall && !isPlaying) return showToast('Tap the ball to aim and launch first!');
    isPlaying = !isPlaying;
    document.getElementById('btn-play').innerText = isPlaying ? '⏸ Pause' : '▶ Play';
    if (!isPlaying) speedFactor = 0;
    // Auto-collapse the active panel on mobile when simulation starts playing
    if (isPlaying && window.innerWidth <= 768) {
        ['stage1-panel', 'stage2-panel', 'stage3-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.style.display !== 'none') el.classList.add('panel-collapsed');
        });
    }
}

function resetCamera() {
    targetTheta = 0;
    targetPhi = stage === 1 ? 1.12 : 1.15;
    // Stage 3 (Solar System) needs a wider zoom to fit Neptune; stages 1/2 stay closer
    targetRadius = stage === 3 ? 3500 : (stage === 1 ? 1850 : 1800);
    camX = 0; camY = 0; autoFollow = true;
}

function updateLostList() {
    const list = document.getElementById('lost-list'); if (!list) return;
    list.innerHTML = '';
    lostPlanets.forEach((p, i) => {
        const div = document.createElement('div'); div.className = 'escaped-item';
        div.innerHTML = `<span>${p.name}</span><button onclick="restorePlanet(${i})">Restore</button>`;
        list.appendChild(div);
    });
    document.getElementById('escaped-box').style.visibility = lostPlanets.length > 0 ? 'visible' : 'hidden';
}

function restoreSystem() {
    if (isPlaying) return showToast();
    if (stage === 1 || stage === 2) resetStage1Lab();
    else if (stage === 3) resetStage3SolarSystem();
}

function restorePlanet(i) {
    if (isPlaying) return showToast();
    const p = lostPlanets.splice(i, 1)[0];
    const restoreDist = Math.max(p.dist || p.initialR || 300, 200);
    const angle = Math.random() * Math.PI * 2;
    p.x = sunObj.x + Math.cos(angle) * restoreDist;
    p.z = sunObj.z + Math.sin(angle) * restoreDist;
    const v = Math.sqrt(G * sunObj.mass / restoreDist);
    p.vx = -Math.sin(angle) * v;
    p.vz = Math.cos(angle) * v;
    p.stage2Modified = true;
    planets.push(p);
    scene.add(p.mesh); scene.add(p.glow);
    if (p.orbitRing) scene.add(p.orbitRing);
    if (p.extras && p.extras.ring) scene.add(p.extras.ring);
    p.history = []; // clear stale trail
    syncMeshPosition(p); updateLostList();
}

// Reusable vector to avoid allocating a new THREE.Vector3 per label per frame
const _labelProj = new THREE.Vector3();

function updateLabels() {
    const labelsActive = stage > 1;
    const planetByName = new Map();
    if (labelsActive) {
        for (const p of planets) planetByName.set(p.name, p);
    }
    const W = window.innerWidth, H = window.innerHeight;
    // Iterate every label that exists (not just current planets). A planet that
    // crashed, escaped, or was cleared on stage change will be absent from the
    // map, so its label gets hidden the next frame regardless of which code
    // path removed it.
    for (const name in labelEls) {
        const el = labelEls[name];
        const p = labelsActive ? planetByName.get(name) : null;
        if (!p) {
            if (el.style.display !== 'none') el.style.display = 'none';
            continue;
        }
        _labelProj.set(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z);
        _labelProj.project(camera);
        if (_labelProj.z > 1) {
            if (el.style.display !== 'none') el.style.display = 'none';
            continue;
        }
        const sx = (_labelProj.x * 0.5 + 0.5) * W;
        const sy = (-_labelProj.y * 0.5 + 0.5) * H;
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) {
            if (el.style.display !== 'none') el.style.display = 'none';
            continue;
        }
        if (el.style.display !== 'block') el.style.display = 'block';
        // Pixel-snapped translate3d skips layout and stays GPU-compositor-aligned
        // with the WebGL canvas; trailing translate(-50%, 0) re-centers on x.
        el.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy - 22)}px, 0) translate(-50%, 0)`;
    }
}

// --- INPUT ---
let s1PlacementBlocked = false;
let _s3DragSavedSpeed = 0; // speed saved at drag-start so release keeps magnitude
renderer.domElement.addEventListener('pointerdown', e => {
    s1PlacementBlocked = false;
    if (e.target.closest('#landing-hub, #ui-header, div[id$="-panel"], #escaped-box')) return;

    // Always record pointer position so pointerup placement distance check is correct
    pointerDownX = e.clientX; pointerDownY = e.clientY;

    // ── L1S2 in-scene aiming: two-phase intercept ────────────────────────
    if (stage === 2 && s2PendingBall) {
        if (!s2Aiming) {
            // Phase 1 – waiting: only a click on the placed ball activates aiming
            const hit = hitTestPlanet(e.clientX, e.clientY);
            if (hit === s2PendingBall) {
                s2AimPointerMoved = false;
                s2StartAim(e.clientX, e.clientY);
            }
            // Clicks on empty space are silently ignored while waiting
        } else {
            // Phase 2 – aiming: any scene click launches immediately
            s2LaunchFromAim();
            s1PlacementBlocked = true; // prevent pointerup from placing a new ball
        }
        return;
    }
    // ─────────────────────────────────────────────────────────────────────

    const hit = hitTestPlanet(e.clientX, e.clientY);
    if (hit) {
        if (stage === 1) {
            s1PlacementBlocked = true;
            if (isPlaying) return showToast();
            if (s1Balls.includes(hit)) selectS1Ball(hit);
            return;
        }
        // L1S2: launched balls are locked — never allow dragging them after launch
        if (stage === 2 && s1Balls.includes(hit)) {
            isPanning = true; panStart = { x: e.clientX, y: e.clientY };
            return;
        }
        if (isPlaying) return showToast();
        if (hit === sunObj && stage !== 3) { isPanning = true; panStart = { x: e.clientX, y: e.clientY }; return; }
        // L1S3: save current speed magnitude before drag begins
        if (stage === 3 && hit !== sunObj && sunObj) {
            _s3DragSavedSpeed = hit.stage2Modified
                ? Math.hypot(hit.vx, hit.vz)
                : Math.sqrt(G * sunObj.mass / Math.max(hit.initialR || 300, 1));
        }
        draggedPlanet = hit;
        const { x: wx, z: wz } = getWorldXZ(e.clientX, e.clientY);
        prevDragPt.set(wx, 0, wz);
    } else {
        isPanning = true; panStart = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('pointermove', e => {
    // L1S2: while a pending ball exists, block camera panning; feed moves to the aim arrow
    if (stage === 2 && s2PendingBall) {
        if (s2Aiming) {
            s2AimPointerMoved = true;
            s2UpdateAimFromPointer(e.clientX, e.clientY);
        }
        return; // block panning in both waiting and aiming phases
    }
    if (draggedPlanet) {
        let { x: wx, z: wz } = getWorldXZ(e.clientX, e.clientY);
        // Clamp drag to blanket bounds in stages 1/2 only
        if (stage === 1 || stage === 2) {
            wx = Math.max(-S1_PLACE_LIMIT, Math.min(S1_PLACE_LIMIT, wx));
            wz = Math.max(-S1_PLACE_LIMIT, Math.min(S1_PLACE_LIMIT, wz));
        }
        // L1S3: clamp drag so planet cannot visually clip through the Sun
        if (stage === 3 && sunObj && draggedPlanet !== sunObj) {
            const ddx = wx - sunObj.x, ddz = wz - sunObj.z;
            const ddist = Math.hypot(ddx, ddz);
            const minClamp = (sunObj.mass * 0.45) + (draggedPlanet.mass * 0.45) + 12;
            if (ddist > 0 && ddist < minClamp) {
                wx = sunObj.x + (ddx / ddist) * minClamp;
                wz = sunObj.z + (ddz / ddist) * minClamp;
            }
        }
        if (stage === 2) draggedPlanet.stage2Modified = true;
        draggedPlanet.x = wx; draggedPlanet.z = wz;
        syncMeshPosition(draggedPlanet); updateGrid();
        if (blanketMesh) updateBlanketDeformation();
    } else if (isPanning) {
        targetTheta -= (e.clientX - panStart.x) * 0.0032;
        targetPhi = Math.max(0.01, Math.min(1.75, targetPhi + (e.clientY - panStart.y) * 0.0032));
        panStart = { x: e.clientX, y: e.clientY }; autoFollow = false;
    }
});

window.addEventListener('pointerup', e => {
    // L1S2 drag-to-launch: if user dragged since clicking the ball, release fires the ball
    if (stage === 2 && s2Aiming) {
        if (s2AimPointerMoved) {
            s2LaunchFromAim(); // dragged → launch on release
        }
        // else: tap-on-ball with no drag → stay in pointing mode; next click will launch
        draggedPlanet = null; isPanning = false; s1PlacementBlocked = false;
        return;
    }

    if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) < 5 && (stage === 1 || stage === 2) && !draggedPlanet && !s1PlacementBlocked && !s2PendingBall) {
        const { x: wx, z: wz } = getWorldXZ(e.clientX, e.clientY);
        placeStage1Ball(wx, wz);
    }
    if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) < 5 && stage === 3) {
        const hit = hitTestPlanet(e.clientX, e.clientY);
        if (hit && hit !== sunObj) s3SelectPlanet(hit.name);
    }

    if (draggedPlanet && stage === 3 && sunObj && draggedPlanet !== sunObj) {
        const dx = draggedPlanet.x - sunObj.x, dz = draggedPlanet.z - sunObj.z;
        const dist = Math.max(Math.hypot(dx, dz), 1);
        const ux = dx / dist, uz = dz / dist;
        // Keep saved speed magnitude — only update direction to tangential at new position.
        // Changing distance with constant speed produces realistic elliptical/escape/crash orbits.
        const speed = _s3DragSavedSpeed > 0 ? _s3DragSavedSpeed : Math.sqrt(G * sunObj.mass / dist);
        draggedPlanet.vx = -uz * speed;
        draggedPlanet.vz = ux * speed;
        draggedPlanet.stage2Modified = true;
        syncMeshPosition(draggedPlanet);
    }
    draggedPlanet = null; isPanning = false;
    s1PlacementBlocked = false;
});

// Cancel L1S2 aim on Escape
window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stage === 2 && s2PendingBall) s2CancelAim();
});

function getWorldXZ(cx, cy) {
    mouse2d.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    // For stages 1/2, raycast against the actual blanket mesh for accurate
    // surface placement even when the camera is tilted and the blanket is warped.
    if ((stage === 1 || stage === 2) && blanketMesh) {
        const hits = raycaster.intersectObject(blanketMesh);
        if (hits.length > 0) return { x: hits[0].point.x, z: hits[0].point.z };
    }
    // Fallback: intersect y=0 plane
    const dp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(dp, pt);
    return { x: pt.x, z: pt.z };
}

function hitTestPlanet(mx, my) {
    mouse2d.set((mx / window.innerWidth) * 2 - 1, -(my / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    const hitList = planets.map(p => p.mesh);
    if (stage === 1 || stage === 2) {
        s1Balls.forEach(b => { if (b.alive !== false && b.mesh) hitList.push(b.mesh); });
        if (s1CentralObj && s1CentralObj.mesh) hitList.push(s1CentralObj.mesh);
    }
    const hits = raycaster.intersectObjects(hitList);
    if (!hits.length) return null;
    const hitObj = hits[0].object;
    const s1BallHit = s1Balls.find(b => b.mesh === hitObj);
    if (s1BallHit) return s1BallHit;
    if (stage === 1 && s1CentralObj && hitObj === s1CentralObj.mesh) return s1CentralObj;
    return hitObj.userData.planet || null;
}

// --- RENDER LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (stage === 1 || stage === 2) updateStage1Physics(dt);
    else if (isPlaying) { speedFactor = Math.min(3, speedFactor + dt * 2); updatePhysics(dt); }
    camTheta += (targetTheta - camTheta) * 0.1;
    camPhi += (targetPhi - camPhi) * 0.1;
    camRadius += (targetRadius - camRadius) * 0.1;
    if (stage === 3) { updateGrid(); planets.forEach(syncMeshPosition); }
    else {
        syncS1CentralMesh(); s1Balls.forEach(syncMeshPosition);
        // Keep aim arrow locked to ball mesh position every frame
        if (stage === 2 && s2Aiming && s2AimArrow) s2UpdateAimArrowVisual();
    }
    if (sunObj) sunLight.position.set(sunObj.x, sunObj.mesh.position.y + 200, sunObj.z);
    else if (s1CentralObj) sunLight.position.set(0, s1CentralObj.mesh.position.y + 200, 0);
    updateCameraPosition();
    updateLabels();
    renderer.render(scene, camera);
    tickFX();
    if (stage === 3) updateS3InfoPanel(null);
}

function syncS1CentralMesh() {
    if (!s1CentralObj) return;
    const r = s1CentralObj.radius;
    const m = s1CentralObj.mass;
    // Seat the watermelon at the bottom of its own depression.
    // Compute blanket depth at origin excluding self, then subtract the well depth
    // the sphere contributes, and lift by its radius so it rests on the surface.
    const bottomY = computeBlanketY(0, 0, s1CentralObj);
    const wellDepth = 60 + m * 1.1; // matches computeBlanketY formula at d=0
    const y = bottomY - wellDepth + r;
    s1CentralObj.mesh.position.set(0, y, 0);
    s1CentralObj.glow.position.set(0, y, 0);
}

// Initialize
window.addEventListener('load', () => {
    initFX();
    const urlParams = new URLSearchParams(window.location.search);
    const startStage = parseInt(urlParams.get('stage')) || 1;
    setStage(startStage);
    animate();
});