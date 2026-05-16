// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 3 (Create your Universe) — FIXED
// ═══════════════════════════════════════════════════

let s3PlanetCounter = 0; // Fix 7: persistent counter to prevent duplicate names

function s3CreateCentral() {
    if (isPlaying) return showToast();
    const m = parseInt(document.getElementById('s3-central-mass').value);
    const c = document.getElementById('s3-central-color').value;

    // Fix 1: Remove ALL planets (sun + orbiting) before recreating, not just sunObj
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    });
    planets = []; sunObj = null;
    s3PlanetCounter = 0; // Fix 7

    sunObj = addPlanet(0, 0, m, c, 'SUN', 0);
    document.getElementById('s3-btn-continue').style.display = 'block';
    syncMeshPosition(sunObj);
    updateS3Counter();
    // Fix 8: use floating message (green) instead of red error toast
    showFloatingMessage('Central Sphere Created!', '#88ffaa');
}

function s3GoToStep2() {
    if (!sunObj) return showToast('Create Central first!'); // Fix 6: guard
    document.getElementById('s3-central-section').style.display = 'none';
    document.getElementById('s3-planet-section').style.display = 'flex';
}

function s3GoToStep1() {
    if (isPlaying) return showToast();
    document.getElementById('s3-central-section').style.display = 'flex';
    document.getElementById('s3-planet-section').style.display = 'none';
}

function addS3Preset(type) {
    if (isPlaying) return showToast();
    if (!sunObj) return showToast('Create Central first!');
    const cfg = {
        small: [35, 100, '#6ce0ff'],
        medium: [70, 115, '#ffcc44'],
        heavy: [150, 85, '#ff66aa'],
        comet: [25, 145, '#ffffff']
    }[type];
    const n = planets.filter(x => x !== sunObj).length;
    if (n >= 12) return showToast('Limit reached!');
    // Fix: orbit must always clear the sun's surface plus the planet's radius, no matter the mass.
    const sunRadius = sunObj.mass * 0.45;
    const planetRadius = cfg[0] * 0.45;
    const minClear = sunRadius + planetRadius + 120;
    const orbitR = Math.max(280, minClear) + n * 170;
    const a = n * 1.1;
    s3PlanetCounter++; // Fix 7: unique name regardless of crashes
    const planet = addPlanet(
        Math.cos(a) * orbitR,
        Math.sin(a) * orbitR,
        cfg[0], cfg[2],
        'Planet ' + s3PlanetCounter,
        orbitR
    );
    // Fix 3: use G constant; remove incorrect ×3.0 multiplier that caused escape trajectories.
    // cfg[1]/100 is the speed ratio (1.0 = stable circular orbit; >1.0 = elliptical/comet).
    const v = Math.sqrt(G * sunObj.mass / orbitR) * (cfg[1] / 100);
    planet.vx = -Math.sin(a) * v;
    planet.vz = Math.cos(a) * v;
    planet.isDynamic = true;
    syncMeshPosition(planet);
    updateS3Counter();
    showFloatingMessage(type + ' planet added', '#ffd089'); // Fix 8
}

// Fix 4: Escape detection for Stage 3 (mirrors stage 2's checkStage2Escapes)
function checkStage3Escapes() {
    if (!sunObj || !isPlaying) return;
    const ESCAPE_DIST = 5800;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === sunObj || !p.isDynamic) continue;
        if (Math.hypot(p.x - sunObj.x, p.z - sunObj.z) > ESCAPE_DIST) {
            lostPlanets.push(p);
            scene.remove(p.mesh); scene.remove(p.glow);
            if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
            planets.splice(i, 1);
            updateLostList();
            showFloatingMessage(p.name + ' escaped!', '#ff8866');
        }
    }
}

function resetStage3Universe() {
    if (isPlaying) return showToast();
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    });
    planets = []; sunObj = null;
    lostPlanets = []; // Fix 5: clear escaped list on full reset
    s3PlanetCounter = 0; // Fix 7
    updateLostList();
    document.getElementById('s3-central-section').style.display = 'flex';
    document.getElementById('s3-planet-section').style.display = 'none';
    document.getElementById('s3-btn-continue').style.display = 'none';
    updateS3Counter();
}

function updateS3Counter() {
    const n = planets.filter(x => x !== sunObj).length;
    const el = document.getElementById('s3-planet-count');
    if (el) el.innerText = `Planets: ${n} ${n >= 3 ? '✓ Ready to play!' : '/ 3 minimum'}`;
}