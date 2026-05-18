// ═══════════════════════════════════════════════════
//  LEVEL 1 - STAGE 1 (Blanket Gravity Lab)
// ═══════════════════════════════════════════════════

function selectS1CentralPreset(id) {
    if (isPlaying) return showToast();
    s1Config.centralPreset = id;
    document.querySelectorAll('[data-central]').forEach(b => b.classList.toggle('active', b.dataset.central === id));
    createS1CentralObject(S1_CENTRAL_PRESETS[id].mass);
}

function selectS1BallPreset(id) {
    if (isPlaying) return showToast();
    s1Config.ballPreset = id;
    document.querySelectorAll('[data-ball]').forEach(b => b.classList.toggle('active', b.dataset.ball === id));
}

function createS1CentralObject(m) {
    if (s1CentralObj) { scene.remove(s1CentralObj.mesh); scene.remove(s1CentralObj.glow); }
    const r = 45 + Math.sqrt(m) * 5;
    s1CentralObj = {
        mass: m, radius: r, isBlackHole: false,
        mesh: makeStage1CentralMesh(m),
        glow: makeGlowSprite('Central', 0x44ff44, r * 1.2)
    };
    scene.add(s1CentralObj.mesh); scene.add(s1CentralObj.glow);
    updateBlanketDeformation(); syncS1CentralMesh();
}

function placeStage1Ball(wx, wz) {
    // In stage 1 snap all balls to the horizontal axis for neat side-by-side comparison
    if (stage === 1) wz = 0;
    if (Math.abs(wx) > S1_PLACE_LIMIT || Math.abs(wz) > S1_PLACE_LIMIT) {
        return showToast('Tap on the blanket!');
    }
    if (isPlaying) return showToast();
    if (!s1CentralObj) return;
    const r = Math.hypot(wx, wz);
    if (r < s1CentralObj.radius + 45) return showToast('Too close to the center!');

    const preset = S1_BALL_PRESETS[s1Config.ballPreset];
    const mass = preset.mass, color = preset.color;
    const visualRadius = 12 + Math.sqrt(mass) * 2.8;
    const mesh = makeStage1BallMesh(mass, color);
    const glow = makeGlowSprite('Ball', color, visualRadius);
    scene.add(mesh); scene.add(glow);

    const ux = wx / r, uz = wz / r;
    let vx = 0, vz = 0;

    if (stage === 2) {
        // L1S2: place ball with zero velocity, then ask for direction via overlay
        vx = 0; vz = 0;
    } else {
        // L1S1: circular orbit velocity v = sqrt(GM/r) so balls naturally orbit
        const gravStrength = 22 * s1CentralObj.mass * (1.0 + mass * 0.004);
        const vCirc = Math.sqrt(gravStrength / Math.max(r, 1));
        vx = -uz * vCirc; vz = ux * vCirc;
    }

    const ball = {
        x: wx, z: wz, vx, vz, radius: visualRadius, mass, mesh, glow,
        alive: true, history: [], orbitTimer: 0, orbitCelebrated: false,
        label: preset.label
    };
    mesh.userData.planet = ball;
    s1Balls.push(ball); syncMeshPosition(ball); updateS1Counter();
    updateBlanketDeformation();

    if (stage === 2) {
        s2PendingBall = ball;
        showS2DirectionOverlay(wx, wz, ball);
    }
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
    s1Balls = []; selectedS1Ball = null; s2PendingBall = null;
    hideS2DirectionOverlay();
    const btn = document.getElementById('s1-remove-btn'); if (btn) btn.disabled = true;
    s1Config = { centralPreset: 'light', ballPreset: 'cometMango' };
    document.querySelectorAll('[data-central]').forEach(b => b.classList.toggle('active', b.dataset.central === 'light'));
    document.querySelectorAll('[data-ball]').forEach(b => b.classList.toggle('active', b.dataset.ball === 'cometMango'));
    createS1CentralObject(S1_CENTRAL_PRESETS.light.mass);
    updateS1Counter(); showToast('Experiment Reset');
}

// ─── L1S2 Direction Overlay ───────────────────────────────────────────────

function showS2DirectionOverlay(wx, wz, ball) {
    const overlay = document.getElementById('s2-dir-overlay');
    if (!overlay) return;

    // Project world pos to screen for positioning
    const scr = projectToScreen(wx, 0, wz);
    const px = scr.visible ? scr.x : window.innerWidth / 2;
    const py = scr.visible ? scr.y : window.innerHeight / 2;
    overlay.style.left = Math.min(Math.max(px - 90, 10), window.innerWidth - 190) + 'px';
    overlay.style.top  = Math.min(Math.max(py - 70, 70), window.innerHeight - 120) + 'px';
    overlay.style.display = 'flex';
}

function hideS2DirectionOverlay() {
    const overlay = document.getElementById('s2-dir-overlay');
    if (overlay) overlay.style.display = 'none';
}

function s2CancelPlacement() {
    if (s2PendingBall) {
        scene.remove(s2PendingBall.mesh); scene.remove(s2PendingBall.glow);
        s1Balls = s1Balls.filter(b => b !== s2PendingBall);
        s2PendingBall = null;
        updateS1Counter(); updateBlanketDeformation();
    }
    hideS2DirectionOverlay();
}

function s2ChooseDirection(type) {
    const ball = s2PendingBall;
    if (!ball) { hideS2DirectionOverlay(); return; }
    const r = Math.hypot(ball.x, ball.z);
    const ux = ball.x / Math.max(r, 1), uz = ball.z / Math.max(r, 1);
    // Circular speed at this distance, accounting for mass factor used in physics
    const gravStrength = 22 * s1CentralObj.mass * (1.0 + ball.mass * 0.004);
    const vCirc = Math.sqrt(gravStrength / Math.max(r, 1));
    const tx = -uz, tz = ux; // tangential (clockwise)
    if (type === 'go_around') {
        ball.vx = tx * vCirc; ball.vz = tz * vCirc;
    } else if (type === 'curve_in') {
        // 45° between tangential and inward — elliptical, dips closer
        const inx = -ux, inz = -uz;
        ball.vx = (tx + inx) * 0.707 * vCirc * 0.85;
        ball.vz = (tz + inz) * 0.707 * vCirc * 0.85;
    } else if (type === 'zoom_out') {
        // faster than circular — will escape or form outer ellipse
        ball.vx = tx * vCirc * 1.4; ball.vz = tz * vCirc * 1.4;
    }
    s2PendingBall = null;
    hideS2DirectionOverlay();
}

// ─── Physics ─────────────────────────────────────────────────────────────

function updateStage1Physics(dt) {
    if (!isPlaying || !s1CentralObj) return;
    const subs = 2;
    const step = (dt * 110.0) / subs;
    const escapeDistance = 2500;

    // gravityStrength is constant for this central mass; define at function scope
    // Movement is produced by velocity + central gravitational acceleration each frame.
    // Blanket deformation is visual only — it does not drive the physics.
    const gravityStrength = 22 * s1CentralObj.mass;

    for (let s = 0; s < subs; s++) {
        for (let i = s1Balls.length - 1; i >= 0; i--) {
            const b = s1Balls[i]; if (!b.alive) continue;

            // Skip balls without direction assigned yet (L1S2 awaiting selection)
            if (b.vx === 0 && b.vz === 0 && b === s2PendingBall) continue;

            const r = Math.max(Math.hypot(b.x, b.z), 1);
            const ux = b.x / r, uz = b.z / r;

            // GM/r² gravity toward central mass only
            const effectiveGravity = gravityStrength * (1.0 + b.mass * 0.004);
            let accel = effectiveGravity / (r * r);
            accel = Math.min(accel, 25000);

            b.vx -= accel * ux * step; b.vz -= accel * uz * step;
            b.x  += b.vx * step;      b.z  += b.vz * step;

            const absorbRadius = s1CentralObj.radius + 15;
            if (r < absorbRadius) {
                const scr = projectToScreen(b.x, 0, b.z);
                if (scr.visible) {
                    spawnParticles(scr.x, scr.y, { count: 36, color: '#ff8844', life: 55, speed: 4.8, ring: true, huge: true });
                    showFloatingMessage('Crash!', '#ffb080');
                }
                scene.remove(b.mesh); scene.remove(b.glow);
                if (selectedS1Ball === b) selectedS1Ball = null;
                s1Balls.splice(i, 1); updateS1Counter();
                continue;
            }
        }
    }

    // Per-ball: orbit / escape classification
    for (let i = s1Balls.length - 1; i >= 0; i--) {
        const b = s1Balls[i];
        const r = Math.hypot(b.x, b.z);
        const ux = b.x / Math.max(r, 1), uz = b.z / Math.max(r, 1);
        const outwardSpeed = b.vx * ux + b.vz * uz;
        const tangentialSpeed = Math.abs(b.vx * -uz + b.vz * ux);
        const radialRatio = Math.abs(outwardSpeed) / Math.max(tangentialSpeed, 0.001);

        // Escape velocity check: v² < 2GM/r means bound orbit
        const vSq = b.vx * b.vx + b.vz * b.vz;
        const vEscSq = (2 * gravityStrength) / Math.max(r, 1);
        const isBound = vSq < vEscSq;

        if (isBound && !b.orbitCelebrated && r > s1CentralObj.radius + 120 && r < escapeDistance * 0.75 && radialRatio < 0.16) {
            b.orbitTimer += dt;
            if (b.orbitTimer > 3.5) {
                b.orbitCelebrated = true;
                const scr = projectToScreen(b.x, 0, b.z);
                if (scr.visible) {
                    spawnParticles(scr.x, scr.y, { count: 20, color: '#88ff88', life: 48, speed: 2.4, ring: true });
                    showFloatingMessage('Nice orbit!', '#aaffaa');
                }
            }
        } else {
            b.orbitTimer = Math.max(0, b.orbitTimer - dt * 2.0);
        }

        // Gentle circularization only for stable bound orbits
        if (b.orbitCelebrated && isBound) {
            const radialSpeed = b.vx * ux + b.vz * uz;
            b.vx -= radialSpeed * 0.018 * ux;
            b.vz -= radialSpeed * 0.018 * uz;
        }

        if (r > escapeDistance && outwardSpeed > 0) {
            const scr = projectToScreen(b.x, 0, b.z);
            if (scr.visible) {
                spawnParticles(scr.x, scr.y, { count: 26, color: '#66ccff', life: 42, speed: 5.5, ring: true });
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
