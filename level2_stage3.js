// level2_stage3.js
// Stage 3 logic for Level 2: Create your Universe

function resetStage3() {
    if (isPlaying) return showToast();
    planets.forEach(p => removePlanetFromScene(p));
    planets = [];
    sunObj = null;
    document.getElementById('s3-step1').style.display = 'flex';
    document.getElementById('s3-step2').style.display = 'none';
    lostPlanets = [];
    updateLostList();
    showToast('Universe Reset');
}

function s3CreateSun() {
    if (isPlaying) return showToast();
    const m = parseInt(document.getElementById('s3-sun-mass').value);
    sunObj = makeSun(m);
    syncMeshPosition(sunObj);
    document.getElementById('s3-step1').style.display = 'none';
    document.getElementById('s3-step2').style.display = 'flex';
    showToast('Central Sphere Created');
}

function s3AddPlanet(type) {
    if (isPlaying) return showToast();
    if (!sunObj) return;
    const n = planets.filter(p => p !== sunObj).length;
    if (n >= 10) return showToast('Limit reached!');
    const config = { small: [30, '#6081FF'], medium: [65, '#E3BB76'], heavy: [120, '#D39C7E'], rogue: [25, '#ffffff'] }[type];
    const r = 400 + n * 240;
    const a = n * 0.8;
    const p = addPlanet(sunObj.x + Math.cos(a) * r, sunObj.z + Math.sin(a) * r, config[0], config[1], 'Planet ' + (n + 1), 'circle', r);
    p.isDynamic = true;
    showToast(type + ' planet added');
}

function s3AddShape(shape) {
    if (isPlaying) return showToast();
    if (!sunObj) return;
    const n = planets.filter(p => p !== sunObj).length;
    const r = 450 + n * 220;
    const a = n * 1.1;
    const p = addPlanet(sunObj.x + Math.cos(a) * r, sunObj.z + Math.sin(a) * r, 50, '#a0ffc0', 'Object ' + (n + 1), shape, r);
    p.isDynamic = true;
    showToast(shape + ' added');
}

function updateStage3Physics(dt) {
    // Stage 3 — N-body
    for (const p of planets) {
        if (p === sunObj || p.isDynamic || !p.primary) continue;
        let trigger = (p === draggedPlanet);
        if (!trigger && Math.abs(p.primary.mass - p.basePrimaryMass) / p.basePrimaryMass > 0.1) trigger = true;
        if (!trigger) {
            const pp = G * p.primary.mass / Math.max(p.dist * p.dist, 1), th = pp * 0.05;
            for (const o of planets) {
                if (o === p || o === p.primary) continue;
                if (o.isOriginal && o.mass === o.initialMass) continue;
                const d = Math.max(Math.hypot(p.x - o.x, p.z - o.z), 5);
                if (G * o.mass / (d * d) > th) { trigger = true; break; }
            }
        }
        if (trigger) {
            p.isDynamic = true;
            const v = Math.sqrt(G * p.primary.mass / Math.max(p.dist, 10));
            p.vx = -Math.sin(p.angle) * v; p.vz = Math.cos(p.angle) * v;
        }
    }
    for (let i = 0; i < planets.length; i++) {
        const p1 = planets[i];
        if (p1 === draggedPlanet || !p1.isDynamic) continue;
        let ax = 0, az = 0;
        for (let j = 0; j < planets.length; j++) {
            if (i === j) continue;
            const p2 = planets[j], dx = p2.x - p1.x, dz = p2.z - p1.z;
            const d = Math.max(Math.hypot(dx, dz), Math.max(p1.mass, p2.mass) / 2);
            const f = G * p2.mass / (d * d);
            ax += f * dx / d; az += f * dz / d;
        }
        p1.vx += ax * speedFactor; p1.vz += az * speedFactor;
    }
    const BOUND = 2600;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === draggedPlanet) continue;
        if (!p.isDynamic && p.primary) {
            const w = Math.sqrt(G * p.primary.mass / Math.pow(Math.max(p.dist, 10), 3));
            p.angle += w * speedFactor * (p.orbitMult || 1.0);
            const pos = geoPos(p.angle, p.dist, p.shape);
            p.x = p.primary.x + pos.x; p.z = p.primary.z + pos.y;
            markOrbitDirty(p);
        } else if (p.isDynamic) {
            p.x += p.vx * speedFactor; p.z += p.vz * speedFactor;
            let best = p.primary, maxPull = -1;
            for (const o of planets) {
                if (o === p) continue;
                const d = Math.max(Math.hypot(p.x - o.x, p.z - o.z), 5);
                const pull = G * o.mass / (d * d);
                const vr = Math.hypot(p.vx - (o.vx || 0), p.vz - (o.vz || 0));
                if (vr < Math.sqrt(2 * G * o.mass / d) && pull > maxPull) { maxPull = pull; best = o; }
            }
            if (best && p.primary !== best) { p.primary = best; p.basePrimaryMass = best.mass; p.history = []; markOrbitDirty(p); }
            if (p.primary) {
                const rx = p.x - p.primary.x, rz = p.z - p.primary.z;
                const last = p.history[p.history.length - 1];
                if (!last || Math.hypot(last.x - rx, last.z - rz) > 2) {
                    p.history.push({ x: rx, z: rz });
                    if (p.history.length > 250) p.history.shift();
                }
                p.dist = Math.hypot(rx, rz); p.angle = Math.atan2(rz, rx);
                markOrbitDirty(p);
            }
        }
        if (Math.abs(p.x) > BOUND || Math.abs(p.z) > BOUND) {
            removePlanetFromScene(p, false);
            planets.splice(i, 1);
            lostPlanets.push(p);
            updateLostList();
        }
    }
}
