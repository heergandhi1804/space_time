// level2_stage3.js — Stage 3: Gravity Lab

let s3PlacingMode = false;
let s3PendingPlanet = null; // frozen, awaiting name then direction
let s3PendingNaming = false; // true while naming prompt is open

const S3_ARROW_LENGTH = 200;
const S3_ARROW_HEAD   = 48;
const S3_ARROW_WIDTH  = 22;
const S3_ARROW_COLOR  = 0x99ddff;

let s3AimArrow = null;
let s3PathLine = null;
let s3Aiming = false;
let s3AimPointerMoved = false;
let s3AimWorldDirX = 1;
let s3AimWorldDirZ = 0;

// ─── Wizard ──────────────────────────────────────────────────────────────

function resetStage3() {
    if (isPlaying) return showToast();
    planets.forEach(p => {
        if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
        removePlanetFromScene(p);
    });
    planets = [];
    sunObj = null;
    s3PlacingMode = false;
    s3PendingPlanet = null;
    s3PendingNaming = false;
    s3Aiming = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
    s3HideNamingPrompt();
    lostPlanets = [];
    updateLostList();
    _showS3Step(1);
    showToast('Universe Reset');
}

function _showS3Step(n) {
    const s1 = document.getElementById('s3-step1');
    const s2 = document.getElementById('s3-step2');
    if (s1) s1.style.display = n === 1 ? 'flex' : 'none';
    if (s2) s2.style.display = n === 2 ? 'flex' : 'none';
}

function s3CreateSun() {
    if (isPlaying) return showToast();
    const mEl = document.getElementById('s3-sun-mass');
    const cEl = document.getElementById('s3-sun-color');
    const m = mEl ? Math.max(60, Math.min(600, parseInt(mEl.value))) : 320;
    const colorHex = cEl ? cEl.value : '#ffd700';

    if (sunObj) {
        if (sunObj.trailLine) { scene.remove(sunObj.trailLine); sunObj.trailLine.geometry.dispose(); sunObj.trailLine.material.dispose(); sunObj.trailLine = null; }
        removePlanetFromScene(sunObj);
        planets = planets.filter(p => p !== sunObj);
    }

    sunObj = makeSun(m, colorHex);
    planets.push(sunObj);
    syncMeshPosition(sunObj);
    _showS3Step(2);
    s3PlacingMode = true;
    showFloatingMessage('Central Object created! Tap the blanket to place a planet.', '#aaffaa');
}

function s3StartPlacing() {
    if (isPlaying) return showToast();
    if (!sunObj) return showToast('Create central object first!');
    const n = planets.filter(p => p !== sunObj).length;
    if (n >= 10) return showToast('Limit reached!');
    s3PlacingMode = true;
    showToast('Tap the blanket to place a planet');
}

function s3PlacePlanet(wx, wz) {
    if (!sunObj) return;
    const n = planets.filter(p => p !== sunObj).length;
    if (n >= 10) { s3PlacingMode = false; return showToast('Limit reached!'); }

    const maxBound = 4200;
    wx = Math.max(-maxBound, Math.min(maxBound, wx));
    wz = Math.max(-maxBound, Math.min(maxBound, wz));

    const mEl = document.getElementById('s3-p-mass');
    const cEl = document.getElementById('s3-p-color');
    const mass = mEl ? Math.max(35, Math.min(110, parseInt(mEl.value))) : 55;
    const colorHex = cEl ? cEl.value : '#6ce0ff';
    const visualMass = mass;

    // Push away from sun if too close
    const dx = wx - sunObj.x, dz = wz - sunObj.z;
    let dist = Math.hypot(dx, dz);
    const minDistSun = (sunObj.mass + visualMass) * 0.45 + 100;
    if (dist < minDistSun) {
        const ang = Math.atan2(dz, dx);
        wx = sunObj.x + Math.cos(ang) * minDistSun;
        wz = sunObj.z + Math.sin(ang) * minDistSun;
        dist = minDistSun;
    }

    // Overlap check against all active planets
    const safetyMargin = 80;
    for (const other of planets) {
        const od = Math.hypot(wx - other.x, wz - other.z);
        const minD = (visualMass + other.mass) * 0.45 + safetyMargin;
        if (od < minD) {
            showToast('Too close! Pick another spot.');
            s3PlacingMode = true;
            return;
        }
    }

    // Create planet frozen with a temporary internal name (no label shown yet)
    const tempName = '__pending__' + Date.now();
    const p = addPlanet(wx, wz, visualMass, colorHex, tempName, 'circle', dist);
    p.isDynamic = true;
    p.vx = 0; p.vz = 0;
    // Hide the temp label
    if (labelEls[tempName]) labelEls[tempName].style.display = 'none';
    syncMeshPosition(p);

    // Highlight pending planet
    if (p.glow && p.glow.material) p.glow.material.opacity = 1.0;

    s3PlacingMode = false;
    s3PendingPlanet = p;

    // Show naming prompt
    s3ShowNamingPrompt(p);
}

// ─── Naming Prompt ─────────────────────────────────────────────────────────

function s3ShowNamingPrompt(p) {
    s3PendingNaming = true;
    const el = document.getElementById('s3-naming-prompt');
    if (!el) return;
    const inp = document.getElementById('s3-naming-input');
    const err = document.getElementById('s3-naming-error');
    if (inp) inp.value = '';
    if (err) err.style.display = 'none';
    el.style.display = 'flex';
    setTimeout(() => { if (inp) inp.focus(); }, 80);
}

function s3HideNamingPrompt() {
    s3PendingNaming = false;
    const el = document.getElementById('s3-naming-prompt');
    if (el) el.style.display = 'none';
}

function s3ConfirmName() {
    const inp = document.getElementById('s3-naming-input');
    const err = document.getElementById('s3-naming-error');
    const name = inp ? inp.value.trim() : '';
    if (!name) {
        if (err) { err.textContent = 'Name your planet first.'; err.style.display = 'block'; }
        if (inp) inp.focus();
        return;
    }

    s3HideNamingPrompt();

    const p = s3PendingPlanet;
    if (!p) return;

    // Replace temp name with real name
    const oldName = p.name;
    if (labelEls[oldName]) { labelEls[oldName].style.display = 'none'; delete labelEls[oldName]; }
    p.name = name;
    if (!labelEls[name]) {
        const el = document.createElement('div');
        el.className = 'planet-label';
        el.innerText = name;
        document.getElementById('labels').appendChild(el);
        labelEls[name] = el;
    }
    labelEls[name].style.display = 'block';

    // Immediately enter aiming mode
    s3Aiming = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
    s3StartAim(0, 0);
    showFloatingMessage('Aim and release to launch!', '#99ddff');
}

// Keydown handler for naming input — hoisted to module level, attached once
window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stage === 3 && s3PendingPlanet) {
        if (s3PendingNaming) {
            s3HideNamingPrompt();
            // Remove the un-named planet
            removePlanetFromScene(s3PendingPlanet);
            planets = planets.filter(q => q !== s3PendingPlanet);
            s3PendingPlanet = null;
            s3PlacingMode = sunObj != null;
        } else {
            s3CancelAim();
        }
    }
});

// ─── L1S2 In-Scene Pool-Table Aiming ─────────────────────────────────────

function s3StartAim(clientX, clientY) {
    if (!s3PendingPlanet) return;
    s3Aiming = true;
    s3AimPointerMoved = false;

    if (s3PendingPlanet.glow && s3PendingPlanet.glow.material) s3PendingPlanet.glow.material.opacity = 1.0;

    // Default direction: tangential CCW (classic prograde orbit)
    const bx = s3PendingPlanet.x, bz = s3PendingPlanet.z;
    const rdx = bx - sunObj.x, rdz = bz - sunObj.z;
    const r = Math.hypot(rdx, rdz);
    if (r > 1) { s3AimWorldDirX = -rdz / r; s3AimWorldDirZ = rdx / r; }
    else        { s3AimWorldDirX = 1;        s3AimWorldDirZ = 0; }

    s3CreateAimArrow();
    s3CreateProjectedPath();
}

function s3CreateAimArrow() {
    s3RemoveAimArrow();
    if (!s3PendingPlanet) return;
    const dir    = new THREE.Vector3(s3AimWorldDirX, 0, s3AimWorldDirZ).normalize();
    const origin = s3PendingPlanet.mesh.position.clone();
    origin.y += s3PendingPlanet.mass * 0.45 + 15;
    s3AimArrow = new THREE.ArrowHelper(dir, origin, S3_ARROW_LENGTH, S3_ARROW_COLOR, S3_ARROW_HEAD, S3_ARROW_WIDTH);
    if (s3AimArrow.line && s3AimArrow.line.material) {
        s3AimArrow.line.material.transparent = true;
        s3AimArrow.line.material.opacity = 0.88;
    }
    if (s3AimArrow.cone && s3AimArrow.cone.material) {
        s3AimArrow.cone.material.transparent = true;
        s3AimArrow.cone.material.opacity = 0.92;
    }
    scene.add(s3AimArrow);
}

function s3RemoveAimArrow() {
    if (!s3AimArrow) return;
    scene.remove(s3AimArrow);
    s3AimArrow.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    s3AimArrow = null;
}

function s3UpdateAimArrowVisual() {
    if (!s3AimArrow || !s3PendingPlanet) return;
    const dir    = new THREE.Vector3(s3AimWorldDirX, 0, s3AimWorldDirZ).normalize();
    const origin = s3PendingPlanet.mesh.position.clone();
    origin.y += s3PendingPlanet.mass * 0.45 + 15;
    s3AimArrow.position.copy(origin);
    s3AimArrow.setDirection(dir);
}

function s3UpdateAimFromPointer(clientX, clientY) {
    if (!s3PendingPlanet) return;
    mouse2d.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    const planetY  = s3PendingPlanet.mesh.position.y;
    const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planetY);
    const pt       = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(aimPlane, pt)) return;

    const dx = pt.x - s3PendingPlanet.x;
    const dz = pt.z - s3PendingPlanet.z;
    const len = Math.hypot(dx, dz);
    if (len < 15) return;

    s3AimWorldDirX = dx / len;
    s3AimWorldDirZ = dz / len;
    s3UpdateAimArrowVisual();
    s3UpdateProjectedPath();
}

function s3LaunchFromAim() {
    const p = s3PendingPlanet;
    if (!p || !sunObj) { s3CancelAim(); return; }
    if (p.glow && p.glow.material) p.glow.material.opacity = 0.65;

    const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
    const dist = Math.hypot(dx, dz);
    // ~0.80× circular orbit speed for slightly slower motion
    const vCirc = Math.sqrt(G * sunObj.mass / Math.max(dist, 10)) * 0.80;

    p.vx = s3AimWorldDirX * vCirc;
    p.vz = s3AimWorldDirZ * vCirc;
    p.stage2Modified = true;

    s3PendingPlanet   = null;
    s3Aiming          = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
    showFloatingMessage('Planet launched!', '#ffd089');

    const n = planets.filter(q => q !== sunObj).length;
    if (n < 10) s3PlacingMode = true;
}

function s3CancelAim() {
    s3HideNamingPrompt();
    if (s3PendingPlanet) {
        if (s3PendingPlanet.glow && s3PendingPlanet.glow.material) s3PendingPlanet.glow.material.opacity = 0.65;
        if (s3PendingPlanet.trailLine) { scene.remove(s3PendingPlanet.trailLine); s3PendingPlanet.trailLine.geometry.dispose(); s3PendingPlanet.trailLine.material.dispose(); s3PendingPlanet.trailLine = null; }
        removePlanetFromScene(s3PendingPlanet);
        planets = planets.filter(p => p !== s3PendingPlanet);
    }
    s3PendingPlanet   = null;
    s3Aiming          = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
    const n = planets.filter(p => p !== sunObj).length;
    s3PlacingMode = sunObj != null && n < 10;
}

function s3CreateProjectedPath() {
    s3RemoveProjectedPath();
    if (!s3PendingPlanet) return;
    const numPts = 14, spacing = 38;
    const points = [];
    for (let i = 1; i <= numPts; i++) {
        const px = s3PendingPlanet.x + s3AimWorldDirX * spacing * i;
        const pz = s3PendingPlanet.z + s3AimWorldDirZ * spacing * i;
        const py = warpDepth(px, pz, s3PendingPlanet) + s3PendingPlanet.mass * 0.45 + 8;
        points.push(new THREE.Vector3(px, py, pz));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
        color: 0x99ddff, transparent: true, opacity: 0.28,
        dashSize: 22, gapSize: 14, depthWrite: false
    });
    s3PathLine = new THREE.Line(geo, mat);
    s3PathLine.computeLineDistances();
    scene.add(s3PathLine);
}

function s3UpdateProjectedPath() {
    if (!s3PathLine || !s3PendingPlanet) { s3CreateProjectedPath(); return; }
    const numPts = 14, spacing = 38;
    const pos = s3PathLine.geometry.attributes.position;
    for (let i = 0; i < numPts; i++) {
        const px = s3PendingPlanet.x + s3AimWorldDirX * spacing * (i + 1);
        const pz = s3PendingPlanet.z + s3AimWorldDirZ * spacing * (i + 1);
        const py = warpDepth(px, pz, s3PendingPlanet) + s3PendingPlanet.mass * 0.45 + 8;
        pos.setXYZ(i, px, py, pz);
    }
    pos.needsUpdate = true;
    s3PathLine.computeLineDistances();
}

function s3RemoveProjectedPath() {
    if (!s3PathLine) return;
    scene.remove(s3PathLine);
    s3PathLine.geometry.dispose();
    s3PathLine.material.dispose();
    s3PathLine = null;
}

// ─── Customization panel for selected planet ─────────────────────────────

function s3UpdateSelected() {
    if (!selectedPlanets.length) return;
    const mEl = document.getElementById('s3-edit-mass');
    const cEl = document.getElementById('s3-edit-color');
    const nEl = document.getElementById('s3-edit-name');
    const m = mEl ? Math.max(35, Math.min(110, parseInt(mEl.value))) : null;
    const c = cEl ? cEl.value : null;
    const newName = nEl ? nEl.value.trim() : null;

    selectedPlanets.forEach(p => {
        if (p === sunObj) return;

        if (m !== null && m !== p.mass) {
            p.mass = m;
            p.mesh.geometry.dispose();
            p.mesh.geometry = new THREE.SphereGeometry(m * 0.45, 48, 32);
            if (p.selRing) {
                p.selRing.geometry.dispose();
                p.selRing.geometry = new THREE.RingGeometry(m * 0.45 + 6, m * 0.45 + 10, 48);
            }
            const gp = getGlowParams(p.name);
            p.glow.scale.set(m * 0.45 * gp.sizeMultiplier, m * 0.45 * gp.sizeMultiplier, 1);
            if (p.extras && p.extras.ring) {
                const s = (m * 0.45) / p._extrasBaseRadius;
                p.extras.ring.scale.set(s, s, s);
            }
            markOrbitDirty(p);
        }

        // Update name
        let nameChanged = false;
        if (newName && newName !== p.name) {
            const oldName = p.name;
            p.name = newName;
            nameChanged = true;
            if (labelEls[oldName]) {
                labelEls[oldName].innerText = newName;
                labelEls[newName] = labelEls[oldName];
                if (oldName !== newName) delete labelEls[oldName];
            } else {
                const el = document.createElement('div');
                el.className = 'planet-label';
                el.innerText = newName;
                document.getElementById('labels').appendChild(el);
                labelEls[newName] = el;
            }
        }

        // Update color / texture / glow
        if (c !== null && (c !== p.color || nameChanged)) {
            p.color = c;
            if (p.mesh.material.map) p.mesh.material.map.dispose();
            const newTex = createProceduralPlanetTexture(p.name, c);
            p.mesh.material.map = newTex;
            const fallbackNum = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
            const safeColor = isNaN(fallbackNum) ? 0xaaaaaa : fallbackNum;
            p.mesh.material.color.setHex(newTex ? 0xffffff : safeColor);
            p.mesh.material.emissive.setHex(safeColor);
            p.mesh.material.needsUpdate = true;

            // Recreate glow (dispose old)
            scene.remove(p.glow);
            p.glow.material.map.dispose();
            p.glow.material.dispose();
            const newGlow = makeGlowSprite(p.name, c, p.mass * 0.45);
            p.glow = newGlow;
            scene.add(p.glow);
        }
        syncMeshPosition(p);
    });
}

function s3DeleteSelected() {
    selectedPlanets.forEach(p => {
        if (p === sunObj) return;
        if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
        removePlanetFromScene(p);
        planets = planets.filter(x => x !== p);
    });
    selectedPlanets = [];
    const ep = document.getElementById('s3-edit-panel');
    if (ep) ep.style.display = 'none';
}

function s3ShowEditPanel(p) {
    const ep = document.getElementById('s3-edit-panel');
    if (!ep || !p || p === sunObj) return;
    const mEl = document.getElementById('s3-edit-mass');
    const mvEl = document.getElementById('s3-edit-mass-val');
    const cEl = document.getElementById('s3-edit-color');
    const nEl = document.getElementById('s3-edit-name');
    const spEl = document.getElementById('s3-edit-speed');
    if (mEl) mEl.value = p.mass;
    if (mvEl) mvEl.textContent = Math.round(p.mass);
    if (nEl) nEl.value = p.name.startsWith('__pending__') ? '' : p.name;
    if (cEl) {
        const h = typeof p.color === 'number' ? '#' + p.color.toString(16).padStart(6, '0') : (p.color || '#ffffff');
        cEl.value = h.slice(0, 7);
    }
    if (spEl && sunObj) {
        const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
        const dist = Math.hypot(dx, dz);
        const v = p.stage2Modified
            ? Math.hypot(p.vx, p.vz).toFixed(1)
            : Math.sqrt(G * sunObj.mass / Math.max(dist, 1)).toFixed(1);
        spEl.textContent = 'Speed: ' + v + ' u/s';
    }
    ep.style.display = 'flex';
}

function s3HideEditPanel() {
    const ep = document.getElementById('s3-edit-panel');
    if (ep) ep.style.display = 'none';
    selectedPlanets.forEach(p => { if (p.selRing) p.selRing.visible = false; });
    selectedPlanets = [];
}

// ─── Physics (central mass gravity + collision) ────────────────────────────

function updateStage3Physics(dt) {
    if (!sunObj) return;

    const SUBSTEPS = 10;
    // Slightly slower than before (0.83×)
    const step = (dt * speedFactor * 175) / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
        // Gravity step
        for (const p of planets) {
            if (p === sunObj || !p.isDynamic || p === draggedPlanet || p === s3PendingPlanet) continue;
            const dx = sunObj.x - p.x, dz = sunObj.z - p.z;
            const r = Math.max(Math.hypot(dx, dz), 10);
            // Pure inverse-square gravity — no artificial cutoff
            const accel = Math.min(G * sunObj.mass / (r * r), 8000);
            const ux = dx / r, uz = dz / r;
            p.vx += accel * ux * step;
            p.vz += accel * uz * step;
        }

        // Position step
        for (const p of planets) {
            if (p === sunObj || !p.isDynamic || p === draggedPlanet || p === s3PendingPlanet) continue;
            p.x += p.vx * step;
            p.z += p.vz * step;
        }

        // Planet-planet collision detection
        for (let a = 0; a < planets.length - 1; a++) {
            const pa = planets[a];
            if (pa === sunObj || !pa.isDynamic || pa === s3PendingPlanet) continue;
            for (let b = a + 1; b < planets.length; b++) {
                const pb = planets[b];
                if (pb === sunObj || !pb.isDynamic || pb === s3PendingPlanet) continue;
                const cdist = Math.hypot(pa.x - pb.x, pa.z - pb.z);
                const minD = (pa.mass + pb.mass) * 0.45;
                if (cdist < minD) {
                    pa._crashed = true;
                    pb._crashed = true;
                }
            }
        }
    }

    // Handle planet-planet crashes
    const crashNames = [];
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (!p._crashed) continue;
        p._crashed = false;
        crashNames.push(p.name);
        const scr = projectToScreen(p.x, 0, p.z);
        if (scr.visible) spawnParticles(scr.x, scr.y, { count: 40, color: '#ffaa44', life: 60, speed: 5.5, ring: true });
        if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
        removePlanetFromScene(p, false);
        planets.splice(i, 1);
        lostPlanets.push({ planet: p, reason: 'Crashed' });
    }
    if (crashNames.length) {
        showFloatingMessage(crashNames.join(' & ') + ' crashed!', '#ffb080');
        updateLostList();
    }

    // Escape / fell-in detection
    const BOUND = 5800;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === sunObj || !p.isDynamic || p === s3PendingPlanet) continue;
        const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
        const dist = Math.hypot(dx, dz);
        const absorbR = (sunObj.mass + p.mass) * 0.45 + 8;

        if (dist < absorbR) {
            const scr = projectToScreen(p.x, 0, p.z);
            if (scr.visible) { spawnParticles(scr.x, scr.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true }); showFloatingMessage(p.name + ' fell in!', '#ffb080'); }
            if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
            removePlanetFromScene(p, false);
            planets.splice(i, 1);
            lostPlanets.push({ planet: p, reason: 'Fell In' });
            updateLostList();
            continue;
        }

        if (dist > BOUND) {
            const ux = dx / dist, uz = dz / dist;
            if (p.vx * ux + p.vz * uz > 0) {
                const scr = projectToScreen(p.x, 0, p.z);
                if (scr.visible) { spawnParticles(scr.x, scr.y, { count: 26, color: '#66ccff', life: 42, speed: 5.5, ring: true }); showFloatingMessage(p.name + ' escaped!', '#8fdcff'); }
                if (p.trailLine) { scene.remove(p.trailLine); p.trailLine.geometry.dispose(); p.trailLine.material.dispose(); p.trailLine = null; }
                removePlanetFromScene(p, false);
                planets.splice(i, 1);
                lostPlanets.push({ planet: p, reason: 'Escaped' });
                updateLostList();
            }
        }
    }

    // History tracking for orbit trails (every 3 calls to this function)
    if (!updateStage3Physics._hTick) updateStage3Physics._hTick = 0;
    updateStage3Physics._hTick++;
    if (updateStage3Physics._hTick >= 3) {
        updateStage3Physics._hTick = 0;
        if (sunObj) {
            const cx = sunObj.x, cz = sunObj.z;
            for (const p of planets) {
                if (p === sunObj || !p.isDynamic || p === s3PendingPlanet) continue;
                if (!p.history) p.history = [];
                p.history.push({ x: p.x - cx, z: p.z - cz });
                if (p.history.length > 240) p.history.shift();
                markOrbitDirty(p);
            }
        }
    }
}
