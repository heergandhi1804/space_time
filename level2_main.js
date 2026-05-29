// level2_main.js
// Main orchestration for Level 2

function updateCameraPosition() {
    camera.position.set(
        camTarget.x + camX + camRadius * Math.sin(camPhi) * Math.sin(camTheta),
        camTarget.y + camY + camRadius * Math.cos(camPhi),
        camTarget.z + camRadius * Math.sin(camPhi) * Math.cos(camTheta)
    );
    camera.lookAt(camTarget.x + camX, camTarget.y + camY, camTarget.z);
}

// ═══════════════════════════════════════════════════
//  ASSETS & MATERIALS
// ═══════════════════════════════════════════════════

function createPlanetMaterial(name, fallbackColorHex) {
    const fallbackNum = typeof fallbackColorHex === 'number' ? fallbackColorHex : parseInt(String(fallbackColorHex || '0xaaaaaa').replace('#', ''), 16);
    const safeColor = isNaN(fallbackNum) ? 0xaaaaaa : fallbackNum;

    if (name === 'Sun') {
        const isDefaultSun = (safeColor === 0xFFD700);
        if (isDefaultSun) {
            const tex = createProceduralPlanetTexture(name, fallbackColorHex);
            return new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
        }
        // Custom color Sun: solid emissive sphere in that color
        return new THREE.MeshBasicMaterial({ color: safeColor });
    }
    const tex = createProceduralPlanetTexture(name, fallbackColorHex);
    return new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : safeColor, roughness: 0.85, metalness: 0.05, emissive: new THREE.Color(safeColor), emissiveIntensity: tex ? 0.06 : 0.12 });
}

function drawSaturnRingTexture() {
    const w = 512, h = 64, c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
        const t = x / w; let alpha = (t < 0.05) ? 0 : (t < 0.4) ? 0.55 + 0.2 * Math.sin(t * 60) : (t < 0.5) ? 0.05 : (t < 0.92) ? 0.7 + 0.15 * Math.sin(t * 80) : (1 - t) / 0.08 * 0.3;
        const r = 220 + 20 * Math.sin(t * 40), g = 200 + 15 * Math.sin(t * 50), b = 160 + 25 * Math.sin(t * 30);
        for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = Math.round(alpha * 255); }
    }
    ctx.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; return tex;
}

// ═══════════════════════════════════════════════════
//  LIGHTING
// ═══════════════════════════════════════════════════

scene.add(new THREE.AmbientLight(0x556680, 1.6));
const sunLight = new THREE.PointLight(0xffe6b0, 2.8, 8000, 1.2); sunLight.position.set(0, 200, 0); scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x6080ff, 0.55); fillLight.position.set(-1, 1, -1); scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0x8090ff, 0.25); rimLight.position.set(1, -0.5, 1); scene.add(rimLight);

// ═══════════════════════════════════════════════════
//  OBJECT MANAGEMENT
// ═══════════════════════════════════════════════════

function makePlanetMesh(name, mass, colorHex) {
    const r = mass * 0.45, fallbackNum = typeof colorHex === 'number' ? colorHex : parseInt(String(colorHex).replace('#', ''), 16);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createPlanetMaterial(name, isNaN(fallbackNum) ? 0xaaaaaa : fallbackNum));
}

function makeSelectionRing(r) {
    const geo = new THREE.RingGeometry(r + 6, r + 10, 48), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(geo, mat); ring.rotation.x = -Math.PI / 2; ring.visible = false; return ring;
}

function makeGlowSprite(name, colorHex, r) {
    const gp = getGlowParams(name);
    let useColor = gp.color;
    if (colorHex) {
        const defaultColor = name === 'Sun' ? '#FFD700' : (GLOW_PARAMS[name] ? GLOW_PARAMS[name].color : null);
        if (defaultColor) {
            const defaultNum = parseInt(defaultColor.replace('#', ''), 16);
            const customNum = typeof colorHex === 'number' ? colorHex : parseInt(String(colorHex).replace('#', ''), 16);
            if (customNum !== defaultNum) useColor = colorHex;
        } else {
            useColor = colorHex;
        }
    }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'), c = threeColor(useColor), grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    const innerAlpha = name === 'Sun' ? 0.7 : (name === 'Jupiter' || name === 'Saturn') ? 0.4 : 0.3;
    grad.addColorStop(0, `rgba(${~~(c.r * 255)},${~~(c.g * 255)},${~~(c.b * 255)},${innerAlpha})`);
    grad.addColorStop(0.5, `rgba(${~~(c.r * 255)},${~~(c.g * 255)},${~~(c.b * 255)},0.08)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
    const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, depthTest: false });
    const sprite = new THREE.Sprite(mat); sprite.scale.set(r * gp.sizeMultiplier, r * gp.sizeMultiplier, 1); sprite.renderOrder = 1; return sprite;
}

let _saturnRingTex = null;
function getSaturnRingTexture() { if (!_saturnRingTex) _saturnRingTex = drawSaturnRingTexture(); return _saturnRingTex; }

function createPlanetExtras(name, mass) {
    if (name === 'Saturn') {
        const r = mass * 0.45, inner = r * 1.35, outer = r * 2.3, geo = new THREE.RingGeometry(inner, outer, 96, 1);
        const pos = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) { uv.setXY(i, (Math.sqrt(pos.getX(i)**2 + pos.getY(i)**2) - inner) / (outer - inner), 0.5); }
        uv.needsUpdate = true;
        const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: getSaturnRingTexture(), side: THREE.DoubleSide, transparent: true, depthWrite: false, opacity: 0.95 }));
        ring.rotation.x = Math.PI / 2.4; ring.rotation.z = 0.15; ring.renderOrder = 2; return { ring, baseRadius: r };
    }
    return null;
}

function addPlanet(x, z, m, colorHex, name, shape, r, isOriginal = false) {
    const mesh = makePlanetMesh(name, m, colorHex), selRing = makeSelectionRing(m * 0.45), glow = makeGlowSprite(name, colorHex, m * 0.45);
    if (!labelEls[name]) { const el = document.createElement('div'); el.className = 'planet-label'; el.innerText = name; document.getElementById('labels').appendChild(el); labelEls[name] = el; }
    labelEls[name].style.display = 'block';
    let vx = 0, vz = 0, angle = 0;
    if (r > 0 && sunObj) { const v = Math.sqrt(G * sunObj.mass / r); angle = Math.atan2(z - sunObj.z, x - sunObj.x); vx = -Math.sin(angle) * v; vz = Math.cos(angle) * v; }
    scene.add(mesh); scene.add(glow); mesh.add(selRing);
    const extras = createPlanetExtras(name, m); if (extras && extras.ring) scene.add(extras.ring);
    const p = { x, z, mass: m, color: colorHex, name, shape, initialR: r, initialAngle: angle, dist: r, angle, vx, vz, primary: sunObj, isDynamic: false, isOriginal, history: [], trailLine: null, mesh, selRing, glow, orbitRing: null, extras, _extrasBaseRadius: m * 0.45, orbitMult: ORBIT_SPEED_MULT[name] || 1.0, _orbitDirty: false };
    mesh.userData.planet = p;
    if (sunObj) { p.orbitRing = new THREE.LineLoop(buildOrbitRingGeo(r, shape, sunObj, p), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })); scene.add(p.orbitRing); }
    planets.push(p); return p;
}

function makeSun(mass, colorHex = '#FFD700') {
    const mesh = makePlanetMesh('Sun', mass, colorHex), selRing = makeSelectionRing(mass * 0.45), glow = makeGlowSprite('Sun', colorHex, mass * 0.45);
    scene.add(mesh); scene.add(glow); mesh.add(selRing);
    if (!labelEls['SUN']) { const el = document.createElement('div'); el.className = 'planet-label'; el.innerText = 'SUN'; document.getElementById('labels').appendChild(el); labelEls['SUN'] = el; }
    labelEls['SUN'].style.display = 'block';
    const s = { x: 0, z: 0, mass: mass, color: colorHex, name: 'SUN', shape: 'circle', dist: 0, vx: 0, vz: 0, primary: null, isDynamic: false, history: [], trailLine: null, mesh, selRing, glow, orbitRing: null, extras: null, _orbitDirty: false };
    mesh.userData.planet = s; return s;
}

function removePlanetFromScene(p, disposeOrbit = true) {
    scene.remove(p.mesh); scene.remove(p.glow);
    if (p.orbitRing) { scene.remove(p.orbitRing); if (disposeOrbit) { p.orbitRing.geometry.dispose(); p.orbitRing.material.dispose(); } }
    if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
    if (p.extras && p.extras.ring) scene.remove(p.extras.ring);
    if (labelEls[p.name]) labelEls[p.name].style.display = 'none';
}

function syncMeshPosition(p) {
    const radius = p.mass * 0.45;
    let yBase, yOffset;
    if (p === sunObj) {
        yBase = warpDepth(p.x, p.z, p); // warp from other objects only
        yOffset = -144;
    } else {
        // Exclude self so the planet sits ON the blanket, not inside its own well
        yBase = warpDepth(p.x, p.z, p);
        yOffset = 2;
    }
    const y = yBase + radius + yOffset;
    p.mesh.position.set(p.x, y, p.z);
    p.glow.position.set(p.x, y, p.z);
    if (p.extras && p.extras.ring) { p.extras.ring.position.copy(p.mesh.position); const s = (p.mass * 0.45) / p._extrasBaseRadius; p.extras.ring.scale.set(s, s, s); }
}

// ═══════════════════════════════════════════════════
//  PHYSICS UTILS
// ═══════════════════════════════════════════════════

function warpDepth(wx, wz, ignore = null) {
    let y = 0; for (const p of planets) { if (p === ignore) continue; const d = Math.hypot(p.x - wx, p.z - wz); y += (-p.mass * 3.2) / (Math.pow(d / 20, 0.42) + 1); } return y;
}

function buildOrbitRingGeo(dist, shape, primary = null, planet = null) {
    const pts = [], steps = 160, cx = primary ? primary.x : 0, cz = primary ? primary.z : 0, pr = planet ? (planet.mass * 0.45) : 0;
    for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI * 2, pos = geoPos(a, dist, shape); pts.push(new THREE.Vector3(cx + pos.x, warpDepth(cx + pos.x, cz + pos.y) + pr + 2, cz + pos.y)); }
    return new THREE.BufferGeometry().setFromPoints(pts);
}

function markOrbitDirty(p) { if (p) p._orbitDirty = true; }
function markAllOrbitsDirty() { planets.forEach(p => { if (p !== sunObj) p._orbitDirty = true; }); }

function updateOrbitRing(p) {
    if (!p || p === sunObj || !p.primary) return;

    const showTrail = stage === 3 && isPlaying && p.isDynamic && p.history && p.history.length > 4;

    if (showTrail) {
        // Hide static guide while showing trail
        if (p.orbitRing) p.orbitRing.visible = false;
        if (!p._orbitDirty) return;

        const cx = p.primary.x, cz = p.primary.z, pr = p.mass * 0.45;
        const pts = [];
        p.history.forEach(pt => pts.push(new THREE.Vector3(cx + pt.x, warpDepth(cx + pt.x, cz + pt.z) + pr + 2, cz + pt.z)));
        pts.push(new THREE.Vector3(p.x, warpDepth(p.x, p.z) + pr + 2, p.z));

        if (!p.trailLine) {
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ color: 0x4488bb, transparent: true, opacity: 0.3, depthWrite: false });
            p.trailLine = new THREE.Line(geo, mat);
            scene.add(p.trailLine);
        } else {
            p.trailLine.geometry.dispose();
            p.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        }
        p._orbitDirty = false;
    } else {
        // Remove trail, show static guide ring
        if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
        if (p.orbitRing) p.orbitRing.visible = true;
        if (!p.orbitRing || !p._orbitDirty) return;
        p.orbitRing.geometry.dispose();
        p.orbitRing.geometry = buildOrbitRingGeo(p.dist, p.shape, p.primary, p);
        p._orbitDirty = false;
    }
}

// ═══════════════════════════════════════════════════
//  UI HANDLERS
// ═══════════════════════════════════════════════════

function showToast(m = 'Pause first!') { const t = document.getElementById('toast'); if (!t) return; t.innerText = m; t.style.visibility = 'visible'; t.style.opacity = '1'; setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.visibility = 'hidden', 300); }, 2000); }

function setStage(s) {
    if (s !== 3) s = 3;
    if (isPlaying) togglePlay();
    stage = s;
    planets.forEach(p => {
        if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
        removePlanetFromScene(p);
    });
    planets = []; lostPlanets = []; updateLostList();
    Object.values(labelEls).forEach(el => el.style.display = 'none');

    document.getElementById('landing-hub').style.display = 'none';
    document.getElementById('ui-header').style.display = 'block';
    document.getElementById('btn-play').style.display = 'inline-block';

    const cockpit = document.getElementById('cockpit');
    if (cockpit) cockpit.style.visibility = 'visible';

    ['hint', 'hint-s1', 'hint-s2'].forEach(h => { const el = document.getElementById(h); if (el) el.style.display = 'none'; });
    const hintEl = document.getElementById('hint');
    if (hintEl) hintEl.style.display = 'block';

    resetStage3();
    resetCamera();
}

function togglePlay() {
    isPlaying = !isPlaying;
    document.getElementById('btn-play').innerText = isPlaying ? '⏸ Pause' : '▶ Play';
    if (!isPlaying) {
        speedFactor = 0;
        // Clear trails when pausing so guide rings reappear
        planets.forEach(p => {
            if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
            markOrbitDirty(p);
        });
    }
}

function resetCamera() { targetTheta = 0; targetPhi = 1.15; targetRadius = 1800; targetCamX = 0; targetCamY = 0; camX = 0; camY = 0; autoFollow = true; }
function setOrbitView(dir) { const views = { north: 0, east: Math.PI / 2, south: Math.PI, west: Math.PI * 1.5 }; if (views[dir] !== undefined) targetTheta = views[dir]; autoFollow = false; }
function setZoomLevel(v) { targetRadius = v === 0.5 ? 3200 : v === 1 ? 2400 : v === 2 ? 1900 : 1200; autoFollow = false; }
function setTiltView(v) { if (v === 'top') { targetPhi = 0.18; targetRadius = 2800; } else { targetPhi = 1.42; targetRadius = 2400; } autoFollow = false; }
function clearSelection() { selectedPlanets = []; planets.forEach(p => p.selRing.visible = false); }

const REASON_ICON = { 'Escaped': '🚀', 'Fell In': '☄', 'Crashed': '💥' };

function updateLostList() {
    const list = document.getElementById('lost-list'); if (!list) return; list.innerHTML = '';
    lostPlanets.forEach((entry, i) => {
        const planet = entry.planet || entry;
        const reason = entry.reason || 'Escaped';
        const icon = REASON_ICON[reason] || '🚀';
        const div = document.createElement('div');
        div.className = 'escaped-item';
        div.innerHTML = `<span>${icon} <b>${planet.name}</b> — ${reason}</span><button onclick="restorePlanet(${i})">Restore</button>`;
        list.appendChild(div);
    });
    document.getElementById('escaped-box').style.visibility = lostPlanets.length > 0 ? 'visible' : 'hidden';
}

function restorePlanet(i) {
    if (isPlaying) return showToast();
    const entry = lostPlanets.splice(i, 1)[0];
    const p = entry.planet || entry;

    if (!sunObj) { lostPlanets.splice(i, 0, entry); return showToast('Create a central object first!'); }

    // Find a valid restore position with no overlaps
    const safetyMargin = 80;
    const baseR = Math.max(p.dist || p.initialR || 500, 350);
    let restoreX = p.x, restoreZ = p.z, placed = false;

    for (let attempt = 0; attempt < 24; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const r = baseR + attempt * 120 + Math.random() * 200;
        const tx = sunObj.x + Math.cos(ang) * r;
        const tz = sunObj.z + Math.sin(ang) * r;
        if (Math.abs(tx) > 4200 || Math.abs(tz) > 4200) continue;
        let clear = true;
        for (const other of planets) {
            if (Math.hypot(tx - other.x, tz - other.z) < (p.mass + other.mass) * 0.45 + safetyMargin) { clear = false; break; }
        }
        if (clear) { restoreX = tx; restoreZ = tz; placed = true; break; }
    }
    if (!placed) { lostPlanets.splice(i, 0, entry); return showToast('No room to restore — remove a planet first.'); }

    p.x = restoreX; p.z = restoreZ;
    const r = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
    const v = Math.sqrt(G * sunObj.mass / Math.max(r, 10));
    const a = Math.atan2(p.z - sunObj.z, p.x - sunObj.x);
    p.vx = -Math.sin(a) * v * 0.80;
    p.vz = Math.cos(a) * v * 0.80;
    p.isDynamic = true;
    p.history = [];

    planets.push(p);
    scene.add(p.mesh); scene.add(p.glow);
    if (p.orbitRing) { scene.add(p.orbitRing); markOrbitDirty(p); }
    if (p.extras && p.extras.ring) scene.add(p.extras.ring);
    if (labelEls[p.name]) labelEls[p.name].style.display = 'block';
    syncMeshPosition(p);
    updateLostList();
}

function restoreSystem() { if (isPlaying) return showToast(); resetStage3(); }

// ═══════════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════════

function hitTestPlanet(mx, my) {
    mouse2d.set((mx / window.innerWidth) * 2 - 1, -(my / window.innerHeight) * 2 + 1); raycaster.setFromCamera(mouse2d, camera);
    const hits = raycaster.intersectObjects(planets.map(p => p.mesh)); return hits.length ? hits[0].object.userData.planet : null;
}

let isPanning = false;
let s3PlacementBlocked = false;
let pointerDownX2 = 0, pointerDownY2 = 0;

window.addEventListener('pointerdown', e => {
    if (e.target.closest('.ui-panel, #ui-header, #landing-hub, #escaped-box, #cockpit, #s3-panel, #s3-edit-panel, #s3-naming-prompt, .zoom-controls')) return;
    pointerDownX2 = e.clientX; pointerDownY2 = e.clientY;

    // Block all interaction during naming
    if (stage === 3 && s3PendingNaming) return;

    // During aiming: pointer down just marks drag start, launch on pointerup
    if (stage === 3 && s3PendingPlanet && s3Aiming) {
        s3AimPointerMoved = false;
        return;
    }

    // Frozen planet (named but aim not started yet) — shouldn't happen, but guard
    if (stage === 3 && s3PendingPlanet) return;

    const hit = hitTestPlanet(e.clientX, e.clientY);
    if (hit) {
        if (s3PlacingMode) return;
        if (isPlaying) return showToast();
        draggedPlanet = hit;
        if (!e.shiftKey) selectedPlanets = [hit]; else if (!selectedPlanets.includes(hit)) selectedPlanets.push(hit);
        if (stage === 3 && hit !== sunObj) s3ShowEditPanel(hit);
    } else {
        isPanning = true; panStart.x = e.clientX; panStart.y = e.clientY;
    }
});

const panStart = { x: 0, y: 0 };

window.addEventListener('pointermove', e => {
    if (stage === 3 && s3PendingNaming) return;

    if (stage === 3 && s3PendingPlanet && s3Aiming) {
        s3AimPointerMoved = true;
        s3UpdateAimFromPointer(e.clientX, e.clientY);
        return;
    }
    if (draggedPlanet) {
        const wm = getWorldXZ(e.clientX, e.clientY); draggedPlanet.x = wm.x; draggedPlanet.z = wm.z;
        if (draggedPlanet.primary) { draggedPlanet.dist = Math.hypot(draggedPlanet.x - draggedPlanet.primary.x, draggedPlanet.z - draggedPlanet.primary.z); draggedPlanet.angle = Math.atan2(draggedPlanet.z - draggedPlanet.primary.z, draggedPlanet.x - draggedPlanet.primary.x); }
        markOrbitDirty(draggedPlanet);
    } else if (isPanning) {
        targetTheta -= (e.clientX - panStart.x) * 0.005; targetPhi = Math.max(0.05, Math.min(1.65, targetPhi + (e.clientY - panStart.y) * 0.005)); panStart.x = e.clientX; panStart.y = e.clientY; autoFollow = false;
    }
});

window.addEventListener('pointerup', e => {
    // Launch on pointer release after aiming
    if (stage === 3 && s3Aiming) {
        s3LaunchFromAim();
        draggedPlanet = null; isPanning = false; s3PlacementBlocked = false;
        return;
    }
    // Click-to-place in Stage 3 placing mode
    if (stage === 3 && s3PlacingMode && !s3PlacementBlocked && !s3PendingPlanet && !s3PendingNaming && Math.hypot(e.clientX - pointerDownX2, e.clientY - pointerDownY2) < 10) {
        if (!e.target.closest('.ui-panel, #ui-header, #landing-hub, #escaped-box, #cockpit, #s3-panel, #s3-edit-panel, #s3-naming-prompt, .zoom-controls')) {
            const wm = getWorldXZ(e.clientX, e.clientY);
            s3PlacePlanet(wm.x, wm.z);
        }
    }
    draggedPlanet = null; isPanning = false; s3PlacementBlocked = false;
});

window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });

// ═══════════════════════════════════════════════════
//  GRID INITIALIZATION
// ═══════════════════════════════════════════════════

const gridGeo = new THREE.BufferGeometry();
const VCOUNT = (GRID_SEGS + 1)**2, positions = new Float32Array(VCOUNT * 3), gridColors = new Float32Array(VCOUNT * 3), gridXZ = [];
for (let iz = 0; iz <= GRID_SEGS; iz++) for (let ix = 0; ix <= GRID_SEGS; ix++) gridXZ.push(-GRID_SIZE + ix * GRID_RES, -GRID_SIZE + iz * GRID_RES);
const indexList = [];
for (let iz = 0; iz <= GRID_SEGS; iz++) for (let ix = 0; ix < GRID_SEGS; ix++) indexList.push(iz * (GRID_SEGS + 1) + ix, iz * (GRID_SEGS + 1) + ix + 1);
for (let ix = 0; ix <= GRID_SEGS; ix++) for (let iz = 0; iz < GRID_SEGS; iz++) indexList.push(iz * (GRID_SEGS + 1) + ix, (iz + 1) * (GRID_SEGS + 1) + ix);
gridGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
gridGeo.setAttribute('color', new THREE.BufferAttribute(gridColors, 3));
gridGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(indexList), 1));
scene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 })));

function updateGrid() {
    const pos = gridGeo.attributes.position, col = gridGeo.attributes.color;
    for (let i = 0; i < VCOUNT; i++) { const wx = gridXZ[i * 2], wz = gridXZ[i * 2 + 1], wy = warpDepth(wx, wz); pos.setXYZ(i, wx, wy, wz); const d = Math.min(1, Math.abs(wy) / 300); col.setXYZ(i, 0.35 + d * 0.3, 0.5 + d * 0.4, 0.9 + d * 0.1); }
    pos.needsUpdate = true; col.needsUpdate = true;
}

// ═══════════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════════

function updatePhysics(dt) {
    if (stage === 3) updateStage3Physics(dt);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (isPlaying) { speedFactor = Math.min(3, speedFactor + dt * 2); updatePhysics(dt); }
    updateGrid();
    planets.forEach(p => { syncMeshPosition(p); updateOrbitRing(p); });

    if (sunObj) {
        sunLight.position.set(sunObj.x, sunObj.mesh.position.y + 200, sunObj.z);
        // Match sunLight color to custom sun color
        const sunColorHex = sunObj.color || '#ffe6b0';
        const sunColorNum = typeof sunColorHex === 'number' ? sunColorHex : parseInt(String(sunColorHex).replace('#', ''), 16);
        if (!isNaN(sunColorNum)) sunLight.color.setHex(sunColorNum);
    }

    if (stage === 3 && s3Aiming && s3AimArrow) s3UpdateAimArrowVisual();

    camTheta += (targetTheta - camTheta) * 0.1; camPhi += (targetPhi - camPhi) * 0.1; camRadius += (targetRadius - camRadius) * 0.1; updateCameraPosition();
    renderer.render(scene, camera); updateLabels(); tickFX();
}

function updateLabels() {
    const v = new THREE.Vector3();
    planets.forEach(p => {
        // Skip temp-named pending planets
        if (p.name && p.name.startsWith('__pending__')) return;
        const el = labelEls[p.name]; if (!el) return;
        p.mesh.getWorldPosition(v); v.project(camera);
        el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
        el.style.display = v.z < 1 ? 'block' : 'none';
    });
}

// Initialize
window.addEventListener('load', () => {
    initFX();
    const urlParams = new URLSearchParams(window.location.search);
    const startStage = parseInt(urlParams.get('stage')) || 1;
    setStage(startStage);
    animate();
});
