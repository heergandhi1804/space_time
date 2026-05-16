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

function createStage1CentralMaterial(type) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const isBlackHole = type === 'blackhole';
    ctx.fillStyle = isBlackHole ? '#000000' : '#d87922';
    ctx.fillRect(0, 0, 512, 256);
    if (!isBlackHole) {
        ctx.strokeStyle = '#3a1d08'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(512, 128); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 256); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(256, 128, 95, 150, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(256, 128, 210, 65, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 1800; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.random() * 512, Math.random() * 256, 1, 1); }
        ctx.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
        map: tex, roughness: isBlackHole ? 1.0 : 0.75, metalness: isBlackHole ? 0.0 : 0.05,
        emissive: 0x000000, emissiveIntensity: 0
    });
}

function makeStage1CentralMesh(mass, presetId) {
    const r = Math.max(65, mass * 0.5);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createStage1CentralMaterial(presetId));
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
    blanketMesh = new THREE.Mesh(blanketGeo, new THREE.MeshStandardMaterial({ color: 0x162d5c, roughness: 0.9, emissive: 0x0a1a3a, emissiveIntensity: 0.2, side: THREE.DoubleSide }));
    scene.add(blanketMesh);
}
function computeBlanketY(wx, wz, ignore) {
    let y = 0;
    if (s1CentralObj && s1CentralObj !== ignore) {
        const d = Math.hypot(wx, wz);
        const r = s1CentralObj.radius;
        const df = s1CentralObj.isBlackHole ? 1.8 : 1.0;
        const maxDepth = r * 0.85 * df;       // depth scales with sphere radius
        const wellWidth = r * 3.5;            // well width also scales with radius
        const u = d / wellWidth;
        y -= maxDepth / (1 + u * u * 1.5);
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
    const p = { x, z, mass: m, color: hex, name, initialR: r, dist: r, angle: Math.atan2(z, x), vx: 0, vz: 0, mesh, glow, selRing: sel, isDynamic: false, history: [] };
    createPlanetExtras(p); mesh.userData.planet = p; planets.push(p); return p;
}
function makePlanetMesh(name, mass, hex) {
    const r = mass * 0.45;
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createPlanetMaterial(name, hex));
}
function makeStage1BallMesh(mass, hex) {
    const r = Math.max(18, mass * 0.75);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), createPlanetMaterial('Ball', hex));
}

function syncMeshPosition(p) {
    const visualRadius = p.radius || p.mass * 0.45;
    const wy = (stage === 1) ? computeBlanketY(p.x, p.z, p) : warpDepth(p.x, p.z, p);
    const py = (stage === 1)
        ? wy + visualRadius
        : wy + visualRadius * 0.55 + 4;
    p.mesh.position.set(p.x, py, p.z);
    p.glow.position.set(p.x, py, p.z);
    if (p.extras && p.extras.ring) p.extras.ring.position.set(p.x, py, p.z);
    if (p.orbitRing) updateOrbitRing(p);
}

function updateOrbitRing(p) {
    if (!p.orbitRing || !sunObj) return;
    const r = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
    const sunWY = warpDepth(sunObj.x, sunObj.z, sunObj);
    p.orbitRing.scale.set(r, r, 1);
    p.orbitRing.position.set(sunObj.x, sunWY + 3, sunObj.z);
}

function createOrbitRing(p) {
    const geo = new THREE.RingGeometry(0.998, 1.002, 128);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0x6699ff, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false
    }));
    ring.rotation.x = Math.PI / 2;
    scene.add(ring); p.orbitRing = ring;
}

// --- PHYSICS ---
function updatePhysics(dt) {
    if (stage === 2) {
        const subs = 8, stepDt = (dt * 140 * getStage2SpeedMultiplier()) / subs;
        for (let s = 0; s < subs; s++) {
            for (const p of planets) {
                if (p === sunObj || !p.stage2Modified) continue;
                let ax = 0, az = 0;
                for (const o of planets) {
                    if (o === p) continue;
                    const dx = o.x - p.x, dz = o.z - p.z;
                    const r = Math.max(Math.hypot(dx, dz), 15);
                    
                    // Unified Proper Gravity
                    const isSunBH = (o === sunObj && o.mass > 400);
                    const gravityScale = o === sunObj ? 1.0 : 0.06;
                    const suction = isSunBH ? (1.0 + 250000 / (r * r)) : 1.0;
                    let f = G * o.mass * gravityScale * suction / (r * r);
                    
                    // Stability clamp for high-gravity scenarios
                    f = Math.min(f, 20000);
                    
                    ax += f * dx / r; az += f * dz / r;
                }
                p.vx += ax * stepDt; p.vz += az * stepDt;
                p.x += p.vx * stepDt; p.z += p.vz * stepDt;
                
                // Crash detection for Stage 2 (Black Hole Absorption)
                const distToSun = Math.hypot(p.x - (sunObj?sunObj.x:0), p.z - (sunObj?sunObj.z:0));
                const isBH = (sunObj && sunObj.mass > 400);
                const absorbR = (sunObj ? (sunObj.mass * 0.45) : 0) + ( isBH ? 75 : 20);
                if (distToSun < absorbR) {
                    p.x = 99999; p.z = 99999; // Ensure escape check catches it
                }
            }
        }
        for (const p of planets) if (p !== sunObj && !p.stage2Modified) {
            // Check if sun is too light to hold forced orbit
            const r = p.dist, vOrbit = Math.sqrt(G * (sunObj ? sunObj.mass : 0) / r);
            if (sunObj && sunObj.mass < 50) { 
                p.stage2Modified = true; // Fly away!
                p.vx = -Math.sin(p.angle) * vOrbit; p.vz = Math.cos(p.angle) * vOrbit;
            } else if (sunObj) {
                const w = vOrbit / r;
                p.angle += w * dt * 108 * getStage2SpeedMultiplier();
                p.x = Math.cos(p.angle) * r; p.z = Math.sin(p.angle) * r;
            }
        }
        checkStage2Escapes();
    } else if (stage === 3) {
        // Fix 2: Multiply by dt so simulation is frame-rate independent.
        // Scale factor 60 calibrates to visually stable orbits at speedFactor max (3).
        const stepDt = dt * speedFactor * 60;
        for (const p of planets) {
            if (p === sunObj || !p.isDynamic) continue;
            let ax = 0, az = 0;
            for (const o of planets) {
                if (o === p) continue;
                const dx = o.x - p.x, dz = o.z - p.z;
                const r = Math.max(Math.hypot(dx, dz), 5);
                const f = G * o.mass / (r * r);
                ax += f * dx / r; az += f * dz / r;
            }
            p.vx += ax * stepDt;
            p.vz += az * stepDt;
            p.x += p.vx * stepDt;
            p.z += p.vz * stepDt;
        }
        checkStage3Escapes(); // Fix 4: escape detection on every physics tick
    }
    checkPlanetCrashes();
}

function checkPlanetCrashes() {
    if (!isPlaying || stage === 1 || !sunObj) return;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i]; if (p === sunObj) continue;
        if (!(stage === 2 && !p.stage2Modified)) {
            const dSun = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
            if (dSun < (p.mass * 0.45) + (sunObj.mass * 0.45) + 8) {
                const s = projectToScreen(p.x, 0, p.z);
                if (s.visible) {
                    spawnParticles(s.x, s.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true, huge: true });
                    showFloatingMessage('Crash!', '#ffb080');
                }
                removePlanetFromScene(p); planets.splice(i, 1); continue;
            }
        }
        for (let j = i - 1; j >= 0; j--) {
            const q = planets[j]; if (q === sunObj) continue;
            if (stage === 2 && !p.stage2Modified && !q.stage2Modified) continue;
            if (Math.hypot(p.x - q.x, p.z - q.z) < (p.mass * 0.45) + (q.mass * 0.45) + 6) {
                const s = projectToScreen((p.x + q.x) / 2, 0, (p.z + q.z) / 2);
                if (s.visible) {
                    spawnParticles(s.x, s.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true, huge: true });
                    showFloatingMessage('Crash!', '#ffb080');
                }
                removePlanetFromScene(p); planets.splice(i, 1);
                removePlanetFromScene(q); planets.splice(j, 1);
                break;
            }
        }
    }
}

function removePlanetFromScene(p) {
    scene.remove(p.mesh); scene.remove(p.glow);
    if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
    if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
}

// --- STAGE SWITCHER ---
function setStage(s) {
    if (isPlaying) togglePlay();
    stage = s;
    s1Balls.forEach(b => { scene.remove(b.mesh); scene.remove(b.glow); });
    s1Balls = []; selectedS1Ball = null;
    if (s1CentralObj) { scene.remove(s1CentralObj.mesh); scene.remove(s1CentralObj.glow); s1CentralObj = null; }
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) scene.remove(p.orbitRing);
        if (p.extras && p.extras.ring) scene.remove(p.extras.ring);
    });
    planets = []; lostPlanets = []; updateLostList();
    Object.values(labelEls).forEach(el => el.style.display = 'none');
    if (blanketMesh) { scene.remove(blanketMesh); blanketMesh = null; blanketGeo = null; }
    document.getElementById('landing-hub').style.display = s === 0 ? 'block' : 'none';
    document.getElementById('ui-header').style.display = s === 0 ? 'none' : 'block';
    document.getElementById('stage1-panel').style.display = s === 1 ? 'flex' : 'none';
    document.getElementById('stage2-panel').style.display = s === 2 ? 'flex' : 'none';
    document.getElementById('stage3-panel').style.display = s === 3 ? 'flex' : 'none';
    document.getElementById('btn-play').style.display = s === 0 ? 'none' : 'inline-block';
    if (s === 1) {
        createBlanket(); resetStage1Lab(); gridMesh.visible = false;
    } else if (s === 2) {
        sunObj = addPlanet(0, 0, 180, 0xFFD700, 'SUN', 0);
        SOLAR.forEach(p => {
            const pl = addPlanet(p.r, 0, p.m, p.c, p.name, p.r);
            createOrbitRing(pl);
            pl.stage2Modified = false;
        });
        gridMesh.visible = true;
    } else if (s === 3) {
        gridMesh.visible = true; resetStage3Universe();
    }
    resetCamera();
}

function togglePlay() {
    if (stage === 3 && planets.length < 4 && !isPlaying) return showToast('Need 3 planets!');
    isPlaying = !isPlaying;
    document.getElementById('btn-play').innerText = isPlaying ? '⏸ Pause' : '▶ Play';
    if (!isPlaying) speedFactor = 0;
}

function resetCamera() {
    targetTheta = 0; targetPhi = stage === 1 ? 1.12 : 1.15;
    targetRadius = stage === 1 ? 1850 : 1800; camX = 0; camY = 0; autoFollow = true;
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
renderer.domElement.addEventListener('pointerdown', e => {
    s1PlacementBlocked = false;
    if (e.target.closest('#landing-hub, #ui-header, div[id$="-panel"], #escaped-box')) return;
    pointerDownX = e.clientX; pointerDownY = e.clientY;
    const hit = hitTestPlanet(e.clientX, e.clientY);
    if (hit) {
        if (stage === 1) {
            s1PlacementBlocked = true;
            if (isPlaying) return showToast();
            if (s1Balls.includes(hit)) selectS1Ball(hit);
            return;
        }
        if (isPlaying) return showToast();
        if (hit === sunObj && stage !== 3) { isPanning = true; panStart = { x: e.clientX, y: e.clientY }; return; }
        draggedPlanet = hit;
        const { x: wx, z: wz } = getWorldXZ(e.clientX, e.clientY);
        prevDragPt.set(wx, 0, wz);
    } else {
        isPanning = true; panStart = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('pointermove', e => {
    if (draggedPlanet) {
        const { x: wx, z: wz } = getWorldXZ(e.clientX, e.clientY);
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
    if (Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) < 5 && stage === 1 && !draggedPlanet && !s1PlacementBlocked) {
        const { x: wx, z: wz } = getWorldXZ(e.clientX, e.clientY);
        placeStage1Ball(wx, wz);
    }

    if (draggedPlanet && stage === 2 && draggedPlanet !== sunObj) {
        const dx = draggedPlanet.x - sunObj.x, dz = draggedPlanet.z - sunObj.z;
        const dist = Math.hypot(dx, dz);
        const minSafe = (sunObj.mass * 0.45) + (draggedPlanet.mass * 0.45) + 80;
        if (dist < minSafe) {
            const mag = Math.max(dist, 1);
            draggedPlanet.x = sunObj.x + (dx / mag) * minSafe;
            draggedPlanet.z = sunObj.z + (dz / mag) * minSafe;
            showToast('Too close to the Sun!');
            const uz = dz / mag, ux = dx / mag;
            const v = Math.sqrt(G * sunObj.mass / minSafe);
            draggedPlanet.vx = -uz * v; draggedPlanet.vz = ux * v;
        } else {
            const ux = dx / dist, uz = dz / dist;
            const v = Math.sqrt(G * sunObj.mass / dist);
            draggedPlanet.vx = -uz * v; draggedPlanet.vz = ux * v;
        }
        draggedPlanet.stage2Modified = true;
        syncMeshPosition(draggedPlanet);
    }
    draggedPlanet = null; isPanning = false;
    s1PlacementBlocked = false;
});

function getWorldXZ(cx, cy) {
    mouse2d.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    const dp = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    raycaster.setFromCamera(mouse2d, camera); raycaster.ray.intersectPlane(dp, pt);
    return { x: pt.x, z: pt.z };
}

function hitTestPlanet(mx, my) {
    mouse2d.set((mx / window.innerWidth) * 2 - 1, -(my / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    const hitList = planets.map(p => p.mesh);
    if (stage === 1) {
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
    if (stage === 1) updateStage1Physics(dt);
    else if (isPlaying) { speedFactor = Math.min(3, speedFactor + dt * 2); updatePhysics(dt); }
    camTheta += (targetTheta - camTheta) * 0.1;
    camPhi += (targetPhi - camPhi) * 0.1;
    camRadius += (targetRadius - camRadius) * 0.1;
    if (stage !== 1) { updateGrid(); planets.forEach(syncMeshPosition); }
    else { syncS1CentralMesh(); s1Balls.forEach(syncMeshPosition); }
    if (sunObj) sunLight.position.set(sunObj.x, sunObj.mesh.position.y + 200, sunObj.z);
    else if (s1CentralObj) sunLight.position.set(0, s1CentralObj.mesh.position.y + 200, 0);
    updateCameraPosition();
    updateLabels();
    renderer.render(scene, camera);
    tickFX();
}

function syncS1CentralMesh() {
    if (!s1CentralObj) return;
    const r = s1CentralObj.radius;
    // Position the sphere so its lower surface rests at the bottom of its own well.
    // Exclude self from the depth lookup so we measure where the cloth WOULD be
    // without this sphere, then add back the radius to seat it on the depression.
    const bottomY = computeBlanketY(0, 0, s1CentralObj);
    const df = s1CentralObj.isBlackHole ? 1.8 : 1.0;
    const wellDepth = r * 0.85 * df;
    const y = bottomY - wellDepth + r;
    s1CentralObj.mesh.position.set(0, y, 0);
    s1CentralObj.glow.position.set(0, y, 0);
}

// Initialize
window.addEventListener('load', () => {
    initFX();
    const urlParams = new URLSearchParams(window.location.search);
    const startStage = parseInt(urlParams.get('stage')) || 0;
    setStage(startStage);
    animate();
});