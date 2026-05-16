// level2_stage1.js
// Stage 1 logic for Level 2: Gravity Blanket

function resetStage1() {
    if (isPlaying) return showToast();
    planets.forEach(p => removePlanetFromScene(p));
    planets = [];
    sunObj = makeSun(320);
    SOLAR.forEach((p, i) => {
        const angle = (i / SOLAR.length) * Math.PI * 2;
        const pl = addPlanet(Math.cos(angle) * p.r, Math.sin(angle) * p.r, p.m, p.c, p.name, p.shape, p.r, true);
        pl.angle = angle;
    });
    lostPlanets = [];
    updateLostList();
    showToast('Gravity Blanket Reset');
}

function updateStage1Physics(dt) {
    const sf = speedFactor * 1.35;
    let anyMoved = false;
    for (const p of planets) {
        if (p === sunObj || p === draggedPlanet || !p.primary) continue;
        if (p.w === undefined) {
            p.w = Math.sqrt(G * p.primary.mass / Math.pow(Math.max(p.dist, 10), 3));
        }
        const prevAngle = p.angle;
        p.angle += p.w * sf * (p.orbitMult || 1.0);
        const pos = geoPos(p.angle, p.dist, p.shape);
        p.x = p.primary.x + pos.x; p.z = p.primary.z + pos.y;
        if (p.angle !== prevAngle) anyMoved = true;
    }
    if (anyMoved) markAllOrbitsDirty();
}
