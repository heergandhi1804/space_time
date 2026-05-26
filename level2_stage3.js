// level2_stage3.js — Stage 3: Gravity Lab

let s3PlacingMode = false;
let s3PendingPlanet = null; // awaiting direction choice
let _s3PlanetCounter = 0;

let s3AimArrow = null;
let s3PathLine = null;
let s3Aiming = false;
let s3AimPointerMoved = false;
let s3AimWorldDirX = 1;
let s3AimWorldDirZ = 0;

const S3_ARROW_LENGTH = 200;
const S3_ARROW_HEAD   = 48;
const S3_ARROW_WIDTH  = 22;
const S3_ARROW_COLOR  = 0x99ddff;

// ─── Wizard ──────────────────────────────────────────────────────────────

function resetStage3() {
    if (isPlaying) return showToast();
    planets.forEach(p => removePlanetFromScene(p));
    planets = [];
    sunObj = null;
    _s3PlanetCounter = 0;
    s3PlacingMode = false;
    s3PendingPlanet = null;
    s3Aiming = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
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
    const m = mEl ? Math.max(60, Math.min(600, parseInt(mEl.value))) : 320;
    const colorHex = cEl ? cEl.value : '#ffd700';

    // Remove old central object
    if (sunObj) { removePlanetFromScene(sunObj); planets = planets.filter(p => p !== sunObj); }

    // makeSun already adds mesh/glow to scene — just push to planets
    sunObj = makeSun(m, colorHex);
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
    const mass = mEl ? Math.max(35, Math.min(110, parseInt(mEl.value))) : 55;
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
    
    // Start aiming
    s3Aiming = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
    s3StartAim(0, 0);
    showFloatingMessage('Aim the planet', '#99ddff');
}

// ─── L1S2 In-Scene Pool-Table Aiming ─────────────────────────────────────

function s3StartAim(clientX, clientY) {
    if (!s3PendingPlanet) return;
    s3Aiming = true;
    s3AimPointerMoved = false;
    // Highlight the pending planet so it's clearly selected
    if (s3PendingPlanet.glow && s3PendingPlanet.glow.material) s3PendingPlanet.glow.material.opacity = 1.0;

    // Default direction: tangential CCW (classic orbit direction)
    const bx = s3PendingPlanet.x, bz = s3PendingPlanet.z;
    const dx = bx - sunObj.x, dz = bz - sunObj.z;
    const r = Math.hypot(dx, dz);
    if (r > 1) { s3AimWorldDirX = -dz / r; s3AimWorldDirZ = dx / r; }
    else       { s3AimWorldDirX = 1;       s3AimWorldDirZ = 0; }

    s3CreateAimArrow();
    s3CreateProjectedPath();
}

function s3CreateAimArrow() {
    s3RemoveAimArrow();
    if (!s3PendingPlanet) return;
    const dir    = new THREE.Vector3(s3AimWorldDirX, 0, s3AimWorldDirZ).normalize();
    const origin = s3PendingPlanet.mesh.position.clone();
    origin.y += s3PendingPlanet.mass * 0.45 + 15; // lift above planet surface
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

    // Cast ray from camera through pointer; intersect horizontal plane at planet's Y
    mouse2d.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    const planetY  = s3PendingPlanet.mesh.position.y;
    const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planetY);
    const pt       = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(aimPlane, pt)) return;

    const dx = pt.x - s3PendingPlanet.x;
    const dz = pt.z - s3PendingPlanet.z;
    const len = Math.hypot(dx, dz);
    if (len < 15) return; // pointer too close — keep current direction

    s3AimWorldDirX = dx / len;
    s3AimWorldDirZ = dz / len;
    s3UpdateAimArrowVisual();
    s3UpdateProjectedPath();
}

function s3LaunchFromAim() {
    const p = s3PendingPlanet;
    if (!p || !sunObj) { s3CancelAim(); return; }
    if (p.glow && p.glow.material) p.glow.material.opacity = 0.65; // reset highlight

    const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
    const dist = Math.hypot(dx, dz);
    const vCirc = Math.sqrt(G * sunObj.mass / Math.max(dist, 10));

    p.vx = s3AimWorldDirX * vCirc;
    p.vz = s3AimWorldDirZ * vCirc;
    p.stage2Modified = true;

    s3PendingPlanet   = null;
    s3Aiming          = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();
    showFloatingMessage('Planet added!', '#ffd089');

    // Auto-re-enter placing mode for next planet
    const n = planets.filter(q => q !== sunObj).length;
    if (n < 10) s3PlacingMode = true;
}

function s3CancelAim() {
    if (s3PendingPlanet) {
        if (s3PendingPlanet.glow && s3PendingPlanet.glow.material) s3PendingPlanet.glow.material.opacity = 0.65;
        removePlanetFromScene(s3PendingPlanet);
        planets = planets.filter(p => p !== s3PendingPlanet);
    }
    s3PendingPlanet   = null;
    s3Aiming          = false;
    s3AimPointerMoved = false;
    s3RemoveAimArrow();
    s3RemoveProjectedPath();

    // Re-enter placing mode automatically
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
        const py = warpDepth(px, pz, s3PendingPlanet) + s3PendingPlanet.mass * 0.45 + SURFACE_OFFSET + 6;
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
        const py = warpDepth(px, pz, s3PendingPlanet) + s3PendingPlanet.mass * 0.45 + SURFACE_OFFSET + 6;
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

function hideS3DirOverlay() {
    s3CancelAim();
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

        // Update mass
        if (m !== null && m !== p.mass) {
            p.mass = m;
            p.mesh.geometry.dispose();
            p.mesh.geometry = new THREE.SphereGeometry(m * 0.45, 48, 32);
            // Re-scale selection ring
            if (p.selRing) {
                p.selRing.geometry.dispose();
                p.selRing.geometry = new THREE.RingGeometry(m * 0.45 + 6, m * 0.45 + 10, 48);
            }
            // Re-scale glow
            const gp = getGlowParams(p.name);
            p.glow.scale.set(m * 0.45 * gp.sizeMultiplier, m * 0.45 * gp.sizeMultiplier, 1);
            // Re-scale extras
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
            // Update DOM label text and registry keys
            if (labelEls[oldName]) {
                labelEls[oldName].innerText = newName;
                labelEls[newName] = labelEls[oldName];
                if (oldName !== newName) {
                    delete labelEls[oldName];
                }
            } else {
                const el = document.createElement('div'); el.className = 'planet-label'; el.innerText = newName;
                document.getElementById('labels').appendChild(el); labelEls[newName] = el;
            }
        }

        // Update color / texture / glow
        if (c !== null && (c !== p.color || nameChanged)) {
            p.color = c;

            // Recreate texture
            if (p.mesh.material.map) p.mesh.material.map.dispose();
            const newTex = createProceduralPlanetTexture(p.name, c);
            p.mesh.material.map = newTex;

            const fallbackNum = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
            const safeColor = isNaN(fallbackNum) ? 0xaaaaaa : fallbackNum;
            p.mesh.material.color.setHex(newTex ? 0xffffff : safeColor);
            p.mesh.material.emissive.setHex(safeColor);
            p.mesh.material.needsUpdate = true;

            // Recreate glow sprite
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
    if (mEl) { mEl.value = p.mass; }
    if (mvEl) mvEl.textContent = Math.round(p.mass);
    if (nEl) { nEl.value = p.name; }
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
            if (p === sunObj || !p.isDynamic || p === draggedPlanet || p === s3PendingPlanet) continue;
            if (!sunObj) continue;
            const dx = sunObj.x - p.x, dz = sunObj.z - p.z;
            const r = Math.max(Math.hypot(dx, dz), 10);
            
            // Influence radius: accurate simulation based on min force cutoff
            const F_min = 0.00125;
            const R_g = Math.sqrt((G * sunObj.mass) / F_min);
            let accel = 0;
            if (r < R_g) {
                // GM/r² gravitational acceleration toward central mass only
                accel = G * sunObj.mass / (r * r);
                // Apply a smooth fade out near the boundary
                const fade = Math.max(0, Math.min(1, (R_g - r) / 150));
                accel *= fade;
                accel = Math.min(accel, 8000);
            }
            const ux = dx / r, uz = dz / r;
            p.vx += accel * ux * step; p.vz += accel * uz * step;
        }
        for (const p of planets) {
            if (p === sunObj || !p.isDynamic || p === draggedPlanet || p === s3PendingPlanet) continue;
            p.x += p.vx * step; p.z += p.vz * step;
        }
    }

    // Escape / crash detection
    if (!sunObj) return;
    const BOUND = 5800;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === sunObj || !p.isDynamic || p === s3PendingPlanet) continue;
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
