// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 3 (Solar System)
// ═══════════════════════════════════════════════════

function resetStage3SolarSystem() {
    if (isPlaying) return showToast();
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    });
    planets = []; lostPlanets = []; updateLostList();

    sunObj = addPlanet(0, 0, 180, 0xFFD700, 'SUN', 0);
    SOLAR.forEach((p, i) => {
        const angle = (i / SOLAR.length) * Math.PI * 2;
        const px = Math.cos(angle) * p.r;
        const pz = Math.sin(angle) * p.r;
        const pl = addPlanet(px, pz, p.m, p.c, p.name, p.r);
        createOrbitRing(pl);
        pl.stage2Modified = false; // start on stable kinematic orbit
    });

    updateS3InfoPanel(null);
    showToast('Solar System Ready!');
}

function checkStage3Escapes() {
    // Re-uses Stage 2 escape logic — same orbital physics
    checkStage2Escapes();
}

// Compute real normalized speed for a planet (kinematic vs dynamic)
function getS3PlanetSpeed(p) {
    if (!p || p === sunObj) return 0;
    if (p.stage2Modified) {
        return Math.hypot(p.vx, p.vz);
    }
    // Kinematic: compute expected circular speed
    const r = p.dist;
    return r > 0 ? Math.sqrt(G * sunObj.mass / r) : 0;
}

function getS3OrbitalState(p) {
    if (!p || p === sunObj || !sunObj) return '';
    const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
    const r = Math.hypot(dx, dz);
    if (!p.stage2Modified) return 'Stable';
    const vSq = p.vx * p.vx + p.vz * p.vz;
    const vEscSq = 2 * G * sunObj.mass / Math.max(r, 1);
    const ux = dx / Math.max(r, 1), uz = dz / Math.max(r, 1);
    const outwardV = p.vx * ux + p.vz * uz;
    if (vSq >= vEscSq && outwardV > 0) return 'Escaping';
    if (outwardV < -0.5 && r < p.initialR * 0.6) return 'Falling In';
    return 'Orbiting';
}

let _s3FocusPlanet = null;

function updateS3InfoPanel(hoveredName) {
    const panel = document.getElementById('s3-info-box');
    if (!panel) return;
    if (hoveredName) {
        const p = planets.find(pl => pl.name === hoveredName);
        _s3FocusPlanet = p || null;
    }
    const p = _s3FocusPlanet;
    const nameEl = document.getElementById('s3-info-name');
    const speedEl = document.getElementById('s3-info-speed');
    const stateEl = document.getElementById('s3-info-state');
    const refEl   = document.getElementById('s3-info-ref');
    if (!p || p === sunObj) {
        if (nameEl) nameEl.textContent = 'Click a planet';
        if (speedEl) speedEl.textContent = '';
        if (stateEl) stateEl.textContent = '';
        if (refEl)   refEl.textContent = '';
        return;
    }
    const realData = SOLAR_REAL[p.name];
    const state = getS3OrbitalState(p);
    const stateColor = { Stable: '#88ff88', Orbiting: '#88ff88', 'Falling In': '#ffaa44', Escaping: '#ff6644' }[state] || '#fff';
    if (nameEl) nameEl.textContent = p.name;
    if (speedEl) speedEl.textContent = realData ? realData.speedKms + ' km/s  (' + realData.speedMph.toLocaleString() + ' mph)' : '';
    if (stateEl) { stateEl.textContent = state; stateEl.style.color = stateColor; }
    if (refEl && realData) {
        const d = realData.periodDays;
        const label = d >= 365 ? (d / 365.25).toFixed(1) + ' Earth years' : d + ' Earth days';
        refEl.textContent = 'Period: ' + label;
    }
}

function s3SelectPlanet(name) {
    _s3FocusPlanet = planets.find(p => p.name === name) || null;
    updateS3InfoPanel(null);
}
