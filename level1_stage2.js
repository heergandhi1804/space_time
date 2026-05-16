// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 2 (Solar Playground)
// ═══════════════════════════════════════════════════

function toggleStage2Speed() {
    stage2SpeedMode = stage2SpeedMode === 'normal' ? 'fast' : 'normal';
    const el = document.getElementById('btn-s2-speed');
    if (el) el.innerText = stage2SpeedMode === 'fast' ? 'Speed: Fast ⚡' : 'Speed: Normal';
}

function getStage2SpeedMultiplier() { return stage2SpeedMode === 'fast' ? 2 : 1; }

function resetStage2SolarSystem() {
    if (isPlaying) return showToast();
    planets.forEach(p => {
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) { scene.remove(p.orbitRing); p.orbitRing = null; }
        if (p.extras && p.extras.ring) { scene.remove(p.extras.ring); p.extras.ring = null; }
    });
    planets = [];
    sunObj = addPlanet(0, 0, 180, 0xFFD700, 'SUN', 0);
    SOLAR.forEach(p => {
        const pl = addPlanet(p.r, 0, p.m, p.c, p.name, p.r);
        createOrbitRing(pl);       // orbit ring
        pl.stage2Modified = false; // use stable angular orbit math
    });
    lostPlanets = []; updateLostList(); showToast('Solar System Reset');
}

function checkStage2Escapes() {
    if (!isPlaying || !sunObj) return;
    for (let i = planets.length - 1; i >= 0; i--) {
        const p = planets[i];
        if (p === sunObj) continue;
        const dx = p.x - sunObj.x, dz = p.z - sunObj.z;
        const dist = Math.hypot(dx, dz);
        if (dist < STAGE2_ESCAPE_DIST) continue;
        const ux = dx / dist, uz = dz / dist;
        const radialSpeed = p.vx * ux + p.vz * uz;
        if (radialSpeed <= 0) continue;  
        
        const s = projectToScreen(p.x, 0, p.z);
        if (s.visible) {
            spawnParticles(s.x, s.y, { count: 26, color: '#66ccff', life: 42, speed: 5.5, ring: true });
            showFloatingMessage('Whoosh! It flew away!', '#8fdcff');
        }
        
        scene.remove(p.mesh); scene.remove(p.glow);
        if (p.orbitRing) scene.remove(p.orbitRing);
        if (p.extras && p.extras.ring) scene.remove(p.extras.ring);
        planets.splice(i, 1);
        lostPlanets.push(p);
        updateLostList();
    }
}
