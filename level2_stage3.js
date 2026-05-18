// level2_stage3.js — Stage 3: Sandbox Universe

let s3PlacingMode = false;
let s3PendingPlanet = null; // awaiting direction choice
let _s3PlanetCounter = 0;

// ─── Wizard ──────────────────────────────────────────────────────────────

function resetStage3() {
    if (isPlaying) return showToast();
    planets.forEach(p => removePlanetFromScene(p));
    planets = [];
    sunObj = null;
    _s3PlanetCounter = 0;
    s3PlacingMode = false;
    s3PendingPlanet = null;
    hideS3DirOverlay();
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
    const m = mEl ? Math.max(60, Math.min(600, parseInt(mEl.value))) : 200;
    const c = cEl ? parseInt(cEl.value.replace('#',''), 16) : 0xFFD700;

    // Remove old central object
    if (sunObj) { removePlanetFromScene(sunObj); planets = planets.filter(p => p !== sunObj); }

    // makeSun already adds mesh/glow to scene — just push to planets
    sunObj = makeSun(m);
    sunObj.mesh.material.color.setHex(c); // tint with chosen color
    planets.push(sunObj);
    syncMeshPosition(sunObj);
    _showS3Step(2);
    // Auto-enter placing mode so user can tap immediately without pressing a button
    s3PlacingMode = true;
    showFloatingMessage('Central Object created! Tap the blanket to place a planet.', '#aaffaa');
}

function s3StartPlacing() {
    if (isPlaying) return showToast();
    if (!sunObj) return showToast('Create central object first!');
    s3PlacingMode = true;
    const n = planets.filter(p => p !== sunObj).length;
    if (n >= 10) { s3PlacingMode = false; return showToast('Limit reached!'); }
    showToast('Tap the blanket to place a planet');
}

function s3PlacePlanet(wx, wz) {
    if (!sunObj) return;
    const n = planets.filter(p => p !== sunObj).length;
    if (n >= 10) { s3PlacingMode = false; return showToast('Limit reached!'); }

    // Clamp to grid bounds
    const maxBound = 4200;
    wx = Math.max(-maxBound, Math.min(maxBound, wx));
    wz = Math.max(-maxBound, Math.min(maxBound, wz));

    // Read current customization values
    const mEl = document.getElementById('s3-p-mass');
    const cEl = document.getElementById('s3-p-color');
    const sEl = document.getElementById('s3-p-size');
    const nEl = document.getElementById('s3-p-name');
    const mass = mEl ? Math.max(20, Math.min(200, parseInt(mEl.value))) : 55;
    const colorHex = cEl ? cEl.value : '#6ce0ff';
    const sizeScale = sEl ? parseFloat(sEl.value) : 1.0;
    const visualMass = mass * sizeScale;

    // Clamp to safe distance from central mass
    const dx = wx - sunObj.x, dz = wz - sunObj.z;
    let dist = Math.hypot(dx, dz);
    const minDist = (sunObj.mass * 0.45) + (visualMass * 0.45) + 100;
    if (dist < minDist) {
        dist = minDist;
        const ang = Math.atan2(dz, dx);
        wx = sunObj.x + Math.cos(ang) * dist;
        wz = sunObj.z + Math.sin(ang) * dist;
    }

    _s3PlanetCounter++;
    const customName = nEl && nEl.value.trim() ? nEl.value.trim() : '';
    const name = customName || ('Planet ' + _s3PlanetCounter);
    if (nEl) nEl.value = ''; // clear name input for next planet
    const p = addPlanet(wx, wz, visualMass, colorHex, name, 'circle', dist);
    p.isDynamic = true;
    p.vx = 0; p.vz = 0; // velocity set after direction choice
    syncMeshPosition(p);

    s3PlacingMode = false;
    s3PendingPlanet = p;
    showS3DirOverlay(wx, wz, p);
}

// ─── Direction Overlay ────────────────────────────────────────────────────

function showS3DirOverlay(wx, wz, planet) {
    const overlay = document.getElementById('s3-dir-overlay');
    if (!overlay) return;
    const scr = projectToScreen(wx, 0, wz);
    const px = scr.visible ? scr.x : window.innerWidth / 2;
    const py = scr.visible ? scr.y : window.innerHeight / 2;
    overlay.style.left = Math.min(Math.max(px - 90, 10), window.innerWidth - 190) + 'px';
    overlay.style.top  = Math.min(Math.max(py - 70, 70), window.innerHeight - 130) + 'px';
    overlay.style.display = 'flex';
}

function hideS3DirOverlay() {
    const overlay = document.getElementById('s3-dir-overlay');
    if (overlay) overlay.style.display = 'none';
}

function s3ChooseDirection(type) {
    const p = s3PendingPlanet;
    if (!p || !sunObj) { hideS3DirOverlay(); return; }
    const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
    const dist = Math.hypot(dx, dz);
    const ux = dx / Math.max(dist, 1), uz = dz / Math.max(dist, 1);
    // Circular speed at this distance
    const vCirc = Math.sqrt(G * sunObj.mass / Math.max(dist, 10));
    const tx = -uz, tz = ux; // tangential (clockwise)
    if (type === 'go_around') {
        p.vx = tx * vCirc; p.vz = tz * vCirc;
    } else if (type === 'curve_in') {
        // 45° between tangential and inward — elliptical, dips closer
        const inx = -ux, inz = -uz;
        p.vx = (tx + inx) * 0.707 * vCirc * 0.85;
        p.vz = (tz + inz) * 0.707 * vCirc * 0.85;
    } else if (type === 'zoom_out') {
        // faster than circular — will escape or form outer ellipse
        p.vx = tx * vCirc * 1.4; p.vz = tz * vCirc * 1.4;
    }
    p.stage2Modified = true;
    s3PendingPlanet = null;
    hideS3DirOverlay();
    showFloatingMessage('Planet added!', '#ffd089');
    // Auto-re-enter placing mode for next planet
    const _n = planets.filter(q => q !== sunObj).length;
    if (_n < 10) s3PlacingMode = true;
}

function s3CancelPlacement() {
    if (s3PendingPlanet) {
        removePlanetFromScene(s3PendingPlanet);
        planets = planets.filter(p => p !== s3PendingPlanet);
        s3PendingPlanet = null;
    }
    s3PlacingMode = false;
    hideS3DirOverlay();
}

// ─── Customization panel for selected planet ─────────────────────────────

function s3UpdateSelected() {
    if (!selectedPlanets.length) return;
    const mEl = document.getElementById('s3-edit-mass');
    const cEl = document.getElementById('s3-edit-color');
    const m = mEl ? Math.max(20, Math.min(200, parseInt(mEl.value))) : null;
    const c = cEl ? cEl.value : null;
    selectedPlanets.forEach(p => {
        if (p === sunObj) return;
        if (m !== null) {
            p.mass = m;
            p.mesh.geometry.dispose();
            p.mesh.geometry = new THREE.SphereGeometry(m * 0.45, 48, 32);
        }
        if (c !== null) { p.color = c; p.mesh.material.color.set(c); }
    });
}

function s3DeleteSelected() {
    selectedPlanets.forEach(p => {
        if (p === sunObj) return;
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
    const spEl = document.getElementById('s3-edit-speed');
    if (mEl) { mEl.value = p.mass; }
    if (mvEl) mvEl.textContent = Math.round(p.mass);
    if (cEl) {
        const h = typeof p.color === 'number' ? '#' + p.color.toString(16).padStart(6,'0') : (p.color || '#ffffff');
        cEl.value = h.slice(0,7);
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

// ─── Physics (N-body, central mass only) ─────────────────────────────────

function updateStage3Physics(dt) {
    // Only the central object (sunObj) exerts gravity on orbiting bodies.
    // Planet-to-planet gravity is intentionally disabled to keep the sim educational.
    const SUBSTEPS = 10;
    // Scale so orbits are visibly animated; SURFACE_OFFSET (300) used as a scene-scale reference
    const step = (dt * speedFactor * 210) / SUBSTEPS;

    for (let s = 0; s < SUBSTEPS; s++) {
        for (const p of planets) {
            if (p === sunObj || !p.isDynamic || p === draggedPlanet) continue;
            if (!sunObj) continue;
            const dx = sunObj.x - p.x, dz = sunObj.z - p.z;
            const r = Math.max(Math.hypot(dx, dz), 10);
            // GM/r² gravitational acceleration toward central mass only
            let accel = G * sunObj.mass / (r * r);
            accel = Math.min(accel, 8000);
            const ux = dx / r, uz = dz / r;
            p.vx += accel * ux * step; p.vz += accel * uz * step;
        }
        for (const p of planets) {
            if (p === sunObj || !p.isDynamic || p === draggedPlanet) continue;
            p.x += p.vx * step; p.z += p.vz * step;
        }
    }

    // Escape / crash detection
    if (!sunObj) return;
    const BOUND = 5800;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === sunObj || !p.isDynamic) continue;
        const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
        const dist = Math.hypot(dx, dz);
        const absorbR = sunObj.mass * 0.45 + p.mass * 0.45 + 8;
        if (dist < absorbR) {
            const scr = projectToScreen(p.x, 0, p.z);
            if (scr.visible) { spawnParticles(scr.x, scr.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true }); showFloatingMessage('Crash!', '#ffb080'); }
            removePlanetFromScene(p); planets.splice(i, 1); continue;
        }
        if (dist > BOUND) {
            const ux = dx / dist, uz = dz / dist;
            const outV = p.vx * ux + p.vz * uz;
            if (outV > 0) {
                const scr = projectToScreen(p.x, 0, p.z);
                if (scr.visible) { spawnParticles(scr.x, scr.y, { count: 26, color: '#66ccff', life: 42, speed: 5.5, ring: true }); showFloatingMessage(p.name + ' escaped!', '#8fdcff'); }
                removePlanetFromScene(p, false); planets.splice(i, 1);
                lostPlanets.push(p); updateLostList();
            }
        }
    }
}
