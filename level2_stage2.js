// level2_stage2.js
// Stage 2 logic for Level 2: Solar System

function resetStage2() {
    if (isPlaying) return showToast();
    planets.forEach(p => removePlanetFromScene(p));
    planets = [];
    sunObj = makeSun(320);
    SOLAR.forEach((p, i) => {
        const pl = addPlanet(p.r, 0, p.m, p.c, p.name, p.shape, p.r, true);
        pl.angle = 0;
    });
    lostPlanets = [];
    updateLostList();
    initializeAllStage2Velocities();
    showToast('Solar System Reset');
}

function updateStage2Physics(frameDt) {
    const rawDt = Math.min(frameDt || 1 / 60, 0.033);
    const simDt = rawDt * STAGE_2_TIME_SCALE;
    const stepDt = simDt / STAGE_2_SUBSTEPS;
    s2FrameCounter++;

    for (let step = 0; step < STAGE_2_SUBSTEPS; step++) {
        const activePlanets = planets.filter(p => p !== sunObj);

        // Pass 1: compute accelerations
        const accels = new Map();
        for (const p of activePlanets) {
            accels.set(p, computeStage2Acceleration(p));
        }

        // Pass 2: integrate
        for (const p of activePlanets) {
            const a = accels.get(p);
            if (!a) continue;
            p.vx += a.ax * stepDt;
            p.vz += a.az * stepDt;
            p.x += p.vx * stepDt;
            p.z += p.vz * stepDt;
        }

        // Pass 3: checks
        for (let i = planets.length - 1; i >= 0; i--) {
            const p = planets[i];
            if (!p || p === sunObj) continue;

            // Collapse
            const sunRadius = sunObj.mass * 0.45;
            const pRadius = p.mass * 0.45;
            const isBH = (sunObj.mass > 1200);
            const collapseDistance = sunRadius + pRadius + (isBH ? 65 : COLLAPSE_SAFETY_MARGIN);
            const rToSun = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
            if (rToSun <= collapseDistance) {
                processStage2Collapse(p);
                continue;
            }

            // Capture
            checkStage2Capture(p);

            // Escape
            if (!p.captureHost) {
                if (isEscapingFromSun(p)) {
                    p.escapeFrames = (p.escapeFrames || 0) + 1;
                } else {
                    p.escapeFrames = 0;
                }
                if (p.escapeFrames > 30) {
                    processStage2Escape(p);
                    continue;
                }
            }
        }
    }

    if (s2FrameCounter % 3 === 0) {
        planets.forEach(p => {
            if (p !== sunObj && !p.captureHost) {
                const rx = p.x - sunObj.x, rz = p.z - sunObj.z;
                p.dist = Math.hypot(rx, rz);
                p.angle = Math.atan2(rz, rx);
                markOrbitDirty(p);
            } else if (p.captureHost) {
                const rx = p.x - p.captureHost.x, rz = p.z - p.captureHost.z;
                p.dist = Math.hypot(rx, rz);
                p.angle = Math.atan2(rz, rx);
                markOrbitDirty(p);
            }
        });
    }
}
function computeStage2Acceleration(p) {
    let ax = 0, az = 0;
    for (const o of planets) {
        if (o === p) continue;
        const dx = o.x - p.x, dz = o.z - p.z;
        const d = Math.hypot(dx, dz);
        const r = Math.max(d, MIN_PHYSICS_DISTANCE);
        
        // Proper Multi-body Gravity Formula
        const isBH = (o === sunObj && o.mass > 1200);
        const suction = isBH ? (1.0 + 30000 / (r * r)) : 1.0;
        let force = (G * o.mass * suction) / (r * r);
        
        // Stability clamp
        force = Math.min(force, 8000);
        
        ax += (dx / r) * force;
        az += (dz / r) * force;
    }
    return { ax, az };
}

function processStage2Collapse(p) {
    const s = projectToScreen(p.x, 0, p.z);
    if (s.visible) {
        spawnParticles(s.x, s.y, { count: 32, color: p.color, life: 60, speed: 5, ring: true });
        showFloatingMessage(`CRASH: ${p.name} fell into the Sun!`, '#ff6666');
    }
    removePlanetFromScene(p);
    planets = planets.filter(x => x !== p);
}

function processStage2Escape(p) {
    const s = projectToScreen(p.x, 0, p.z);
    if (s.visible) {
        spawnParticles(s.x, s.y, { count: 24, color: p.color, life: 50, speed: 4, ring: true });
        showFloatingMessage(`ESCAPE: ${p.name} flew away!`, '#66ccff');
    }
    removePlanetFromScene(p);
    planets = planets.filter(x => x !== p);
    lostPlanets.push(p);
    updateLostList();
}

function isEscapingFromSun(p) {
    if (!sunObj) return true;
    const r = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
    if (r < 600) return false;
    const vSq = p.vx * p.vx + p.vz * p.vz;
    const escapeVSq = (2 * G * sunObj.mass) / r;
    return vSq > escapeVSq * 0.95; // 5% margin for stable escapes
}

function checkStage2Capture(p) {
    // Optional: detect if a planet starts orbiting another planet (moons)
}

function initializeAllStage2Velocities() {
    planets.forEach(p => {
        if (p === sunObj) return;
        const r = Math.hypot(p.x - sunObj.x, p.z - sunObj.z);
        const v = Math.sqrt(G * (sunObj ? sunObj.mass : 100) / r);
        const angle = Math.atan2(p.z - (sunObj ? sunObj.z : 0), p.x - (sunObj ? sunObj.x : 0));
        p.vx = -Math.sin(angle) * v;
        p.vz = Math.cos(angle) * v;
    });
}
