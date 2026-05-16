// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 1 (Blanket Gravity Lab)
// ═══════════════════════════════════════════════════

function selectS1CentralPreset(id) {
    if (isPlaying) return showToast();
    s1Config.centralPreset = id;
    document.querySelectorAll('#stage1-panel [data-central]').forEach(b => b.classList.toggle('active', b.dataset.central === id));
    createS1CentralObject(S1_CENTRAL_PRESETS[id].mass);
}

function selectS1BallPreset(id) {
    if (isPlaying) return showToast();
    s1Config.ballPreset = id;
    document.querySelectorAll('#stage1-panel [data-ball]').forEach(b => b.classList.toggle('active', b.dataset.ball === id));
}

function selectS1Direction(id) {
    if (isPlaying) return showToast();
    s1Config.direction = id;
    document.querySelectorAll('#stage1-panel [data-direction]').forEach(b => b.classList.toggle('active', b.dataset.direction === id));
}

function createS1CentralObject(m) {
    if (s1CentralObj) { scene.remove(s1CentralObj.mesh); scene.remove(s1CentralObj.glow); }
    const r = Math.max(65, m * 0.5), isBH = s1Config.centralPreset === 'blackhole';
    s1CentralObj = {
        mass: m, radius: r, isBlackHole: isBH,
        mesh: makeStage1CentralMesh(m, s1Config.centralPreset || 'light'),
        glow: makeGlowSprite('Central', isBH ? 0x9900ff : 0xffaa44, r * (isBH ? 1.8 : 1.0))
    };
    scene.add(s1CentralObj.mesh); scene.add(s1CentralObj.glow);
    updateBlanketDeformation(); syncS1CentralMesh();
}

function placeStage1Ball(wx, wz) {
    if (Math.abs(wx) > S1_PLACE_LIMIT || Math.abs(wz) > S1_PLACE_LIMIT) {
        return showToast('Tap on the blanket!');
    }
    if (isPlaying) return showToast();
    if (!s1CentralObj) return;
    const r = Math.hypot(wx, wz);
    if (r < s1CentralObj.radius + 45) return showToast('Too close to the center!');
    const preset = S1_BALL_PRESETS[s1Config.ballPreset];
    const mass = preset.mass, color = preset.color;
    const visualRadius = Math.max(18, mass * 0.75);
    const mesh = makeStage1BallMesh(mass, color);
    const glow = makeGlowSprite('Ball', color, visualRadius);
    scene.add(mesh); scene.add(glow);
    const vCirc = Math.sqrt(15 * s1CentralObj.mass / r), spd = vCirc * preset.speedMultiplier;
    const ux = wx / r, uz = wz / r;
    let vx = 0, vz = 0;
    if (s1Config.direction === 'forward') { vx = -uz * spd; vz = ux * spd; }
    else if (s1Config.direction === 'backward') { vx = uz * spd; vz = -ux * spd; }
    else if (s1Config.direction === 'inside') { vx = -ux * spd; vz = -uz * spd; }
    else { vx = ux * spd; vz = uz * spd; }
    const ball = { x: wx, z: wz, vx, vz, radius: visualRadius, mass, mesh, glow, alive: true, history: [], orbitTimer: 0, orbitCelebrated: false };
    mesh.userData.planet = ball;
    s1Balls.push(ball); syncMeshPosition(ball); updateS1Counter();
    updateBlanketDeformation();
}

function updateS1Counter() {
    const el = document.getElementById('s1-counter');
    if (el) el.innerText = 'Balls placed: ' + s1Balls.length;
}

function selectS1Ball(ball) {
    if (isPlaying) return showToast();
    selectedS1Ball = ball;
    s1Balls.forEach(b => { if (b.glow && b.glow.material) b.glow.material.opacity = b === ball ? 1 : 0.65; });
    const btn = document.getElementById('s1-remove-btn'); if (btn) btn.disabled = false;
}

function removeSelectedS1Ball() {
    if (isPlaying) return showToast();
    if (!selectedS1Ball) return showToast('Tap a ball first.');
    scene.remove(selectedS1Ball.mesh); scene.remove(selectedS1Ball.glow);
    s1Balls = s1Balls.filter(b => b !== selectedS1Ball);
    selectedS1Ball = null;
    const btn = document.getElementById('s1-remove-btn'); if (btn) btn.disabled = true;
    updateS1Counter();
    updateBlanketDeformation();
}

function resetStage1Lab() {
    if (isPlaying) return showToast();
    s1Balls.forEach(b => { scene.remove(b.mesh); scene.remove(b.glow); });
    s1Balls = []; selectedS1Ball = null;
    const btn = document.getElementById('s1-remove-btn'); if (btn) btn.disabled = true;
    s1Config = { centralPreset: 'light', ballPreset: 'slowHeavy', direction: 'forward' };
    document.querySelectorAll('#stage1-panel [data-central]').forEach(b => b.classList.toggle('active', b.dataset.central === 'light'));
    document.querySelectorAll('#stage1-panel [data-ball]').forEach(b => b.classList.toggle('active', b.dataset.ball === 'slowHeavy'));
    document.querySelectorAll('#stage1-panel [data-direction]').forEach(b => b.classList.toggle('active', b.dataset.direction === 'forward'));
    createS1CentralObject(S1_CENTRAL_PRESETS.light.mass);
    updateS1Counter(); showToast('Experiment Reset');
}

function updateStage1Physics(dt) {
    if (!isPlaying || !s1CentralObj) return;
    const subs = s1CentralObj.isBlackHole ? 8 : 2;
    const step = (dt * 12.8) / subs;
    const escapeDistance = 2500;

    for (let s = 0; s < subs; s++) {
        for (let i = s1Balls.length - 1; i >= 0; i--) {
            const b = s1Balls[i]; if (!b.alive) continue;
            const r = Math.max(Math.hypot(b.x, b.z), 1);
            const ux = b.x / r, uz = b.z / r;
            
            // Proper Physics: G*M/r^2 + Relativity-inspired suction for black holes
            const gravityStrength = 22 * s1CentralObj.mass;
            const suction = s1CentralObj.isBlackHole ? (1.0 + 200000 / (r * r)) : 1.0;
            let accel = (gravityStrength * suction) / (r * r);
            
            // Stability Clamp: tuned for 8x sub-stepping
            accel = Math.min(accel, 25000);
            
            b.vx -= accel * ux * step; b.vz -= accel * uz * step;
            b.x += b.vx * step; b.z += b.vz * step;
            
            const absorbRadius = s1CentralObj.radius + (s1CentralObj.isBlackHole ? 40 : 10);
            if (r < absorbRadius) {
                const scr = projectToScreen(b.x, 0, b.z);
                if (scr.visible) {
                    spawnParticles(scr.x, scr.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true, huge: true });
                    showFloatingMessage(s1CentralObj.isBlackHole ? 'Singularity!' : 'Crash!', '#ffb080');
                }
                scene.remove(b.mesh); scene.remove(b.glow);
                if (selectedS1Ball === b) selectedS1Ball = null;
                s1Balls.splice(i, 1); updateS1Counter(); 
                continue;
            }
        }
    }
    
    // Counter-loop for secondary checks (orbits/escapes)
    for (let i = s1Balls.length - 1; i >= 0; i--) {
        const b = s1Balls[i];
        const r = Math.hypot(b.x, b.z);
        const ux = b.x / Math.max(r, 1), uz = b.z / Math.max(r, 1);
        const outwardSpeed = b.vx * ux + b.vz * uz;
        const tangentialSpeed = Math.abs(b.vx * -uz + b.vz * ux);
        const radialRatio = Math.abs(outwardSpeed) / Math.max(tangentialSpeed, 0.001);
        if (!b.orbitCelebrated && r > s1CentralObj.radius + 90 && r < escapeDistance * 0.75 && radialRatio < 0.22) {
            b.orbitTimer += dt;
            if (b.orbitTimer > 2.2) {
                b.orbitCelebrated = true;
                const s = projectToScreen(b.x, 0, b.z);
                if (s.visible) {
                    spawnParticles(s.x, s.y, { count: 20, color: '#88ff88', life: 48, speed: 2.4, ring: true });
                    showFloatingMessage('Nice orbit!', '#aaffaa');
                }
            }
        } else {
            b.orbitTimer = Math.max(0, b.orbitTimer - dt * 0.6);
        }

        if (b.orbitCelebrated) {
            const radialSpeed = b.vx * ux + b.vz * uz;
            b.vx -= radialSpeed * 0.012 * ux;
            b.vz -= radialSpeed * 0.012 * uz;
        }

        if (r > escapeDistance && outwardSpeed > 0) {
            const s = projectToScreen(b.x, 0, b.z);
            if (s.visible) {
                spawnParticles(s.x, s.y, { count: 26, color: '#66ccff', life: 42, speed: 5.5, ring: true });
                showFloatingMessage('Whoosh! It flew away!', '#8fdcff');
            }
            scene.remove(b.mesh); scene.remove(b.glow);
            if (selectedS1Ball === b) selectedS1Ball = null;
            s1Balls.splice(i, 1); updateS1Counter();
        }
    }
    const btn = document.getElementById('s1-remove-btn');
    if (btn) btn.disabled = !selectedS1Ball;
    updateBlanketDeformation();
}