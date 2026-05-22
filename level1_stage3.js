// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 3 (Solar System)
// ═══════════════════════════════════════════════════

function resetStage3SolarSystem() {
    if (isPlaying) return showToast();
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.trailLine) { scene.remove(p.trailLine); if (p.trailLine.geometry) p.trailLine.geometry.dispose(); if (p.trailLine.material) p.trailLine.material.dispose(); p.trailLine = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    });
    planets = []; lostPlanets = []; _s3FocusPlanet = null; updateLostList();
    if (typeof closeS3Popup === 'function') closeS3Popup();

    sunObj = addPlanet(0, 0, 180, 0xFFD700, 'SUN', 0);
    SOLAR.forEach((p, i) => {
        const angle = (i / SOLAR.length) * Math.PI * 2;
        const px = Math.cos(angle) * p.r;
        const pz = Math.sin(angle) * p.r;
        const pl = addPlanet(px, pz, p.m, p.c, p.name, p.r);
        createOrbitRing(pl);
        pl.stage2Modified = false;
    });

    updateS3InfoPanel(null);
    showToast('Solar System Ready!');
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

// ─── Smooth orbit ring color via heat lerp (called from updateOrbitRing each frame) ──────

const _s3HeatColA = new THREE.Color(), _s3HeatColB = new THREE.Color();

function updateS3RingVisuals(p) {
    if (!sunObj || p === sunObj) return;

    const state = getS3OrbitalState(p);

    // Heat: 0 = safe, 0.8 = escaping, 1.0 = falling in
    const targetHeat = state === 'Falling In' ? 1.0 : state === 'Escaping' ? 0.8 : 0.0;
    if (p._orbitHeat === undefined) p._orbitHeat = targetHeat;
    p._orbitHeat += (targetHeat - p._orbitHeat) * 0.07;

    // ── Orbit guide ring: lerp between planet's base color and danger red ────
    if (p.orbitRing && p.orbitRing.material) {
        const baseCol  = p._orbitRingBaseColor !== undefined ? p._orbitRingBaseColor : 0x88aaff;
        const alertCol = state === 'Falling In' ? 0xff4422 : 0xff8822;
        _s3HeatColA.setHex(baseCol);
        _s3HeatColB.setHex(alertCol);
        _s3HeatColA.lerp(_s3HeatColB, Math.min(1, Math.max(0, p._orbitHeat)));
        p.orbitRing.material.color.copy(_s3HeatColA);
        // Subtle pulse when in danger
        if (p._orbitHeat > 0.05) {
            const pulse = Math.sin(Date.now() * 0.005) * 0.12 + 0.88;
            p.orbitRing.material.opacity = 0.60 + p._orbitHeat * 0.25 * pulse;
        } else {
            p.orbitRing.material.opacity = 0.60;
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
            showFloatingMessage('Escaped! 🚀', '#8fdcff');
        }

        if (p.trailLine) { scene.remove(p.trailLine); if (p.trailLine.geometry) p.trailLine.geometry.dispose(); if (p.trailLine.material) p.trailLine.material.dispose(); p.trailLine = null; }
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
        if (_s3FocusPlanet === p) {
            _s3FocusPlanet = null;
            updateS3InfoPanel(null);
            if (typeof closeS3Popup === 'function') closeS3Popup();
        }
        planets.splice(i, 1);
        lostPlanets.push(p);
        updateLostList();
    }
}

// ─── Info Popup ───────────────────────────────────────────────────────────────

let _s3FocusPlanet = null;

// Updates the always-visible compact live row in the stage3 panel (mobile).
function _updateS3LiveRow(p) {
    const nameEl  = document.getElementById('s3lr-name');
    if (!nameEl) return;
    const badgeEl = document.getElementById('s3lr-badge');
    const speedEl = document.getElementById('s3lr-speed');
    const distEl  = document.getElementById('s3lr-dist');
    const sep2    = document.getElementById('s3lr-sep2');
    const sep3    = document.getElementById('s3lr-sep3');
    const detBtn  = document.getElementById('s3lr-detail-btn');

    if (!p || p === sunObj) {
        nameEl.textContent = 'Tap a planet';
        if (badgeEl) badgeEl.textContent = '';
        if (speedEl) speedEl.textContent = '';
        if (distEl)  distEl.textContent  = '';
        if (sep2) sep2.style.display = 'none';
        if (sep3) sep3.style.display = 'none';
        if (detBtn) detBtn.style.display = 'none';
        return;
    }

    nameEl.textContent = p.name;
    const state = getS3OrbitalState(p);
    const lrStateMap = {
        'Orbiting':   { badge: '🟢 Orbit',    color: '#66ee88' },
        'Falling In': { badge: '⚠️ Danger',   color: '#ff9944' },
        'Escaping':   { badge: '🚀 Escaping',  color: '#ff7755' }
    };
    const lrSc = lrStateMap[state] || { badge: state, color: '#fff' };
    if (badgeEl) { badgeEl.textContent = lrSc.badge; badgeEl.style.color = lrSc.color; }

    const realData = SOLAR_REAL[p.name];
    if (realData) {
        if (sep2) sep2.style.display = '';
        if (speedEl) speedEl.textContent = '⚡ ' + realData.speedKms.toFixed(1) + ' km/s';
        const d = sunObj ? Math.hypot(p.x - sunObj.x, p.z - sunObj.z) : (p.initialR || 0);
        const ratio = d / Math.max(p.initialR || d, 1);
        if (distEl) {
            distEl.textContent = '📍 ' + Math.round(realData.distKm * ratio).toLocaleString() + 'M km';
            if (sep3) sep3.style.display = '';
        }
    } else {
        if (sep2) sep2.style.display = 'none';
        if (sep3) sep3.style.display = 'none';
    }
    if (detBtn) detBtn.style.display = '';
}

function updateS3InfoPanel(hoveredName) {
    if (hoveredName) {
        const found = planets.find(pl => pl.name === hoveredName);
        _s3FocusPlanet = found || null;
    }
    const p = _s3FocusPlanet;

    // Always update the compact live row (visible on mobile even when popup is closed)
    _updateS3LiveRow(p);

    const emptyEl  = document.getElementById('s3-popup-empty');
    const dataEl   = document.getElementById('s3-popup-data');
    const nameEl   = document.getElementById('s3-popup-name');
    const badgeEl  = document.getElementById('s3-popup-badge');
    const distEl   = document.getElementById('s3-popup-dist');
    const speedEl  = document.getElementById('s3-popup-speed');
    const periodEl = document.getElementById('s3-popup-period');

    if (!p || p === sunObj) {
        if (emptyEl) emptyEl.style.display = 'block';
        if (dataEl)  dataEl.style.display  = 'none';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (dataEl)  dataEl.style.display  = 'block';

    const realData = SOLAR_REAL[p.name];
    const state = getS3OrbitalState(p);
    const stateConfig = {
        'Orbiting':   { badge: '🟢 Safe Orbit',   color: '#66ee88' },
        'Falling In': { badge: '⚠️ Too Close!',   color: '#ff9944' },
        'Escaping':   { badge: '🚀 Flying Away!',  color: '#ff7755' }
    };
    const sc = stateConfig[state] || { badge: state, color: '#fff' };

    if (nameEl)  nameEl.textContent = p.name;
    if (badgeEl) { badgeEl.textContent = sc.badge; badgeEl.style.color = sc.color; }

    if (distEl && realData && realData.distKm) {
        const dist = Math.hypot(p.x - (sunObj ? sunObj.x : 0), p.z - (sunObj ? sunObj.z : 0));
        const ratio = dist / Math.max(p.initialR || dist, 1);
        const kmVal = Math.round(realData.distKm * ratio);
        distEl.textContent = '📍 ' + kmVal.toLocaleString() + ' million km from Sun';
    } else if (distEl) {
        distEl.textContent = '';
    }

    if (speedEl && realData) {
        speedEl.textContent = '⚡ ' + realData.speedKms.toFixed(1) + ' km/s';
    }

    if (periodEl && realData) {
        const d = realData.periodDays;
        const label = d >= 365 ? (d / 365.25).toFixed(1) + ' years' : d + ' days';
        periodEl.textContent = '🔄 Orbits Sun in ' + label;
    }
}

function s3SelectPlanet(name) {
    _s3FocusPlanet = planets.find(p => p.name === name) || null;
    updateS3InfoPanel(null);
    if (typeof openS3Popup === 'function') openS3Popup();
}
