// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 3 (Solar System)
// ═══════════════════════════════════════════════════

function resetStage3SolarSystem() {
    if (isPlaying) return showToast();
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.escapeRing) { scene.remove(p.escapeRing); if (p.escapeRing.geometry) p.escapeRing.geometry.dispose(); if (p.escapeRing.material) p.escapeRing.material.dispose(); p.escapeRing = null; }
        if (p.trailLine) { scene.remove(p.trailLine); if (p.trailLine.geometry) p.trailLine.geometry.dispose(); if (p.trailLine.material) p.trailLine.material.dispose(); p.trailLine = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    });
    planets = []; lostPlanets = []; _s3FocusPlanet = null; updateLostList();

    sunObj = addPlanet(0, 0, 180, 0xFFD700, 'SUN', 0);
    SOLAR.forEach((p, i) => {
        const angle = (i / SOLAR.length) * Math.PI * 2;
        const px = Math.cos(angle) * p.r;
        const pz = Math.sin(angle) * p.r;
        const pl = addPlanet(px, pz, p.m, p.c, p.name, p.r);
        createOrbitRing(pl);
        s3CreateEscapeRing(pl);
        pl.stage2Modified = false;
    });

    updateS3InfoPanel(null);
    showToast('Solar System Ready!');
}

// ─── Escape Ring ───────────────────────────────────────────────────────────────

function s3CreateEscapeRing(p) {
    if (!p || p === sunObj) return;
    s3RemoveEscapeRing(p);
    const geo = new THREE.RingGeometry(0.986, 1.014, 128);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xff2222, transparent: true, opacity: 0.40,
        side: THREE.DoubleSide, depthWrite: false
    }));
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
    p.escapeRing = ring;
}

function s3RemoveEscapeRing(p) {
    if (!p || !p.escapeRing) return;
    scene.remove(p.escapeRing);
    if (p.escapeRing.geometry) p.escapeRing.geometry.dispose();
    if (p.escapeRing.material) p.escapeRing.material.dispose();
    p.escapeRing = null;
}

// ─── Trail ────────────────────────────────────────────────────────────────────

function updateS3Trail(p) {
    if (!p || p === sunObj || !p.stage2Modified) {
        if (p && p.trailLine) {
            scene.remove(p.trailLine);
            if (p.trailLine.geometry) p.trailLine.geometry.dispose();
            if (p.trailLine.material) p.trailLine.material.dispose();
            p.trailLine = null;
        }
        return;
    }

    // Store Vector3 directly to avoid per-frame allocation in setFromPoints
    p.history.push(new THREE.Vector3(p.x, p.mesh ? p.mesh.position.y : 0, p.z));
    if (p.history.length > 280) p.history.shift();
    if (p.history.length < 2) return;

    if (!p.trailLine) {
        const raw = typeof p.color === 'number' ? p.color : parseInt(String(p.color).replace('#', ''), 16);
        const mat = new THREE.LineBasicMaterial({
            color: raw, transparent: true, opacity: 0.22, depthWrite: false
        });
        p.trailLine = new THREE.Line(new THREE.BufferGeometry(), mat);
        scene.add(p.trailLine);
    }

    p.trailLine.geometry.setFromPoints(p.history);
}

// ─── Physics helpers ──────────────────────────────────────────────────────────

// Planet speed: kinematic = circular orbit speed at initialR; dynamic = magnitude of velocity vector.
function getS3PlanetSpeed(p) {
    if (!p || p === sunObj || !sunObj) return 0;
    if (p.stage2Modified) return Math.hypot(p.vx, p.vz);
    return p.initialR > 0 ? Math.sqrt(G * sunObj.mass / p.initialR) : 0;
}

// Distance from Sun at which this planet's current speed equals escape speed.
// rEscape = 2GM / v²  →  vEsc(rEscape) = sqrt(2GM/rEscape) = v
function getS3EscapeRadius(p) {
    if (!p || p === sunObj || !sunObj) return Infinity;
    const v = getS3PlanetSpeed(p);
    if (v <= 0) return Infinity;
    return (2 * G * sunObj.mass) / (v * v);
}

// Inner radius below which the planet is in the fall-in danger zone.
function getS3InnerDangerRadius(p) {
    if (!p || p === sunObj || !sunObj) return 0;
    return (sunObj.mass * 0.45) + (p.mass * 0.45) + 100;
}

function getS3OrbitalState(p) {
    if (!p || p === sunObj || !sunObj) return '';
    const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
    const r = Math.hypot(dx, dz);

    // Inner danger zone: planet is too close to the Sun
    if (r <= getS3InnerDangerRadius(p)) return 'Falling In';

    // Kinematic planets have stable circular orbits
    if (!p.stage2Modified) return 'Orbiting';

    // Dynamic: escape condition — speed ≥ escape speed and moving outward
    const vSq = p.vx * p.vx + p.vz * p.vz;
    const vEscSq = 2 * G * sunObj.mass / Math.max(r, 1);
    const ux = dx / Math.max(r, 1), uz = dz / Math.max(r, 1);
    const outwardV = p.vx * ux + p.vz * uz;

    if (vSq >= vEscSq && outwardV > 0) return 'Escaping';
    return 'Orbiting';
}

// ─── Visual ring & glow updates (called from updateOrbitRing each frame) ──────

function updateS3RingVisuals(p) {
    if (!sunObj || p === sunObj) return;

    const r = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
    const state = getS3OrbitalState(p);
    const rEscape = getS3EscapeRadius(p);
    const innerDanger = getS3InnerDangerRadius(p);

    // ── Orbit guide ring color ────────────────────────────────────────────────
    if (p.orbitRing && p.orbitRing.material) {
        let col;
        if (state === 'Falling In' || r < innerDanger * 1.25) {
            col = 0xff4422;
        } else if (state === 'Escaping' || (p.stage2Modified && isFinite(rEscape) && r >= rEscape)) {
            col = 0xff2222;
        } else {
            col = p._orbitRingBaseColor !== undefined ? p._orbitRingBaseColor : 0x88aaff;
        }
        p.orbitRing.material.color.setHex(col);
    }

    // ── Escape threshold ring — placed at rEscape from the Sun ────────────────
    if (p.escapeRing) {
        if (isFinite(rEscape) && rEscape > 0 && rEscape < STAGE2_ESCAPE_DIST * 1.5) {
            p.escapeRing.scale.set(rEscape, rEscape, 1);
            p.escapeRing.position.set(sunObj.x, p.mesh ? p.mesh.position.y : 0, sunObj.z);
            p.escapeRing.visible = true;
        } else {
            p.escapeRing.visible = false;
        }
    }

    // ── Glow color reflects orbital state ────────────────────────────────────
    if (p.glow && p.glow.material) {
        if (state === 'Escaping') {
            p.glow.material.opacity = 1.0;
            p.glow.material.color.setHex(0xff7744);
        } else if (state === 'Falling In') {
            p.glow.material.opacity = 1.0;
            p.glow.material.color.setHex(0xff4400);
        } else {
            p.glow.material.opacity = 0.6;
            p.glow.material.color.set('#ffffff');
        }
    }

    // ── Trail for dynamic planets ─────────────────────────────────────────────
    updateS3Trail(p);
}

// ─── Escape detection (stage 3 only; no planet-to-planet collision) ───────────

function checkStage3Escapes() {
    if (!isPlaying || !sunObj) return;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === sunObj || !p.stage2Modified) continue;
        const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
        const dist = Math.hypot(dx, dz);
        if (dist < STAGE2_ESCAPE_DIST) continue;
        const ux = dx / dist, uz = dz / dist;
        const radialSpeed = p.vx * ux + p.vz * uz;
        if (radialSpeed <= 0) continue;

        const s = projectToScreen(p.x, 0, p.z);
        if (s.visible) {
            spawnParticles(s.x, s.y, { count: 26, color: '#66ccff', life: 42, speed: 5.5, ring: true });
            showFloatingMessage('Escaped!', '#8fdcff');
        }

        s3RemoveEscapeRing(p);
        if (p.trailLine) { scene.remove(p.trailLine); if (p.trailLine.geometry) p.trailLine.geometry.dispose(); if (p.trailLine.material) p.trailLine.material.dispose(); p.trailLine = null; }
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
        if (_s3FocusPlanet === p) { _s3FocusPlanet = null; updateS3InfoPanel(null); }
        planets.splice(i, 1);
        lostPlanets.push(p);
        updateLostList();
    }
}

// ─── Info Panel ───────────────────────────────────────────────────────────────

let _s3FocusPlanet = null;

function updateS3InfoPanel(hoveredName) {
    const panel = document.getElementById('s3-info-box');
    if (!panel) return;
    if (hoveredName) {
        const p = planets.find(pl => pl.name === hoveredName);
        _s3FocusPlanet = p || null;
    }
    const p = _s3FocusPlanet;
    const nameEl   = document.getElementById('s3-info-name');
    const speedEl  = document.getElementById('s3-info-speed');
    const distEl   = document.getElementById('s3-info-dist');
    const escapeEl = document.getElementById('s3-info-escape');
    const stateEl  = document.getElementById('s3-info-state');
    const refEl    = document.getElementById('s3-info-ref');

    if (!p || p === sunObj) {
        if (nameEl)   nameEl.textContent = 'Click a planet';
        if (speedEl)  speedEl.textContent = '';
        if (distEl)   distEl.textContent = '';
        if (escapeEl) escapeEl.textContent = '';
        if (stateEl)  stateEl.textContent = '';
        if (refEl)    refEl.textContent = '';
        return;
    }

    const realData = SOLAR_REAL[p.name];
    const state = getS3OrbitalState(p);
    const stateColor = { Orbiting: '#88ff88', 'Falling In': '#ff6644', Escaping: '#ff3333' }[state] || '#fff';

    const dist = Math.hypot(p.x - (sunObj ? sunObj.x : 0), p.z - (sunObj ? sunObj.z : 0));
    const rEscape = getS3EscapeRadius(p);
    const initialR = Math.max(p.initialR || dist, 1);

    if (nameEl) nameEl.textContent = p.name;

    if (speedEl && realData) {
        speedEl.textContent = 'Speed: ' + realData.speedKms.toFixed(2) + ' km/s';
    }

    if (distEl) {
        const ratio = (dist / initialR).toFixed(2);
        distEl.textContent = 'Distance: ' + ratio + 'x default';
        distEl.style.color = state === 'Falling In' ? '#ff8844' : '#ccddff';
    }

    if (escapeEl) {
        if (isFinite(rEscape)) {
            const escRatio = (rEscape / initialR).toFixed(2);
            escapeEl.textContent = 'Escape zone: beyond ' + escRatio + 'x default';
            escapeEl.style.color = state === 'Escaping' ? '#ff3333' : '#ff9966';
        } else {
            escapeEl.textContent = '';
        }
    }

    if (stateEl) { stateEl.textContent = 'State: ' + state; stateEl.style.color = stateColor; }

    if (refEl && realData) {
        const d = realData.periodDays;
        const label = d >= 365 ? (d / 365.25).toFixed(1) + ' yr' : d + ' days';
        refEl.textContent = 'Period: ' + label;
    }
}

function s3SelectPlanet(name) {
    _s3FocusPlanet = planets.find(p => p.name === name) || null;
    updateS3InfoPanel(null);
}
