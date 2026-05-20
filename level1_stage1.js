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
    if (stage === 1) wz = 0;
    if (Math.abs(wx) > S1_PLACE_LIMIT || Math.abs(wz) > S1_PLACE_LIMIT) {
        return showToast('Tap on the blanket!');
    }
    if (isPlaying) return showToast();
    if (!s1CentralObj) return;
    const r = Math.hypot(wx, wz);

    const preset = S1_BALL_PRESETS[s1Config.ballPreset];
    const mass = preset.mass, color = preset.color;
    const visualRadius = 12 + Math.sqrt(mass) * 2.8;

    // Stage-aware minimum distance: prevent ball from starting inside the watermelon
    const minDist = stage === 2 ? s1CentralObj.radius + visualRadius + 12 : s1CentralObj.radius + 45;
    if (r < minDist) return showToast('Too close to the center!');

    const mesh = makeStage1BallMesh(mass, color);
    const glow = makeGlowSprite('Ball', color, visualRadius);
    scene.add(mesh); scene.add(glow);

    const ux = wx / r, uz = wz / r;
    let vx = 0, vz = 0;

    if (stage === 2) {
        vx = 0; vz = 0; // velocity set after direction wheel
    } else {
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
        showS2Wheel(ball);
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
    hideS2Wheel();
    const btn = document.getElementById('s1-remove-btn'); if (btn) btn.disabled = true;
    s1Config = { centralPreset: 'light', ballPreset: 'cometMango' };
    document.querySelectorAll('[data-central]').forEach(b => b.classList.toggle('active', b.dataset.central === 'light'));
    document.querySelectorAll('[data-ball]').forEach(b => b.classList.toggle('active', b.dataset.ball === 'cometMango'));
    createS1CentralObject(S1_CENTRAL_PRESETS.light.mass);
    updateS1Counter(); showToast('Experiment Reset');
}

// ─── L1S2 Horizontal Aim Pad ──────────────────────────────────────────────

let _s2WheelWorldAngle = 0;

// Convert a world-space velocity angle to the screen-space angle needed to draw it on the pad canvas
function _worldAngleToScreenAngle(worldAngle) {
    if (!s2PendingBall) return worldAngle;
    const bx = s2PendingBall.x, bz = s2PendingBall.z;
    const scr0 = projectToScreen(bx, 0, bz);
    const scr1 = projectToScreen(bx + Math.cos(worldAngle) * 80, 0, bz + Math.sin(worldAngle) * 80);
    if (!scr0.visible) return worldAngle;
    return Math.atan2(scr1.y - scr0.y, scr1.x - scr0.x);
}

// Convert a screen-space angle (drag direction on pad) to a world-space velocity angle
function _screenAngleToWorldAngle(screenAngle) {
    if (!s2PendingBall) return screenAngle;
    const bx = s2PendingBall.x, bz = s2PendingBall.z;
    const scr0 = projectToScreen(bx, 0, bz);
    if (!scr0.visible) return screenAngle;
    const scrX = projectToScreen(bx + 80, 0, bz);
    const scrZ = projectToScreen(bx, 0, bz + 80);
    const xdx = scrX.x - scr0.x, xdy = scrX.y - scr0.y;
    const zdx = scrZ.x - scr0.x, zdy = scrZ.y - scr0.y;
    const sd = { x: Math.cos(screenAngle), y: Math.sin(screenAngle) };
    const xLen = Math.hypot(xdx, xdy) || 1, zLen = Math.hypot(zdx, zdy) || 1;
    const worldX = (sd.x * xdx + sd.y * xdy) / xLen;
    const worldZ = (sd.x * zdx + sd.y * zdy) / zLen;
    return Math.atan2(worldZ, worldX);
}

// Draw the direction arrow on the aim pad canvas
function _drawS2Wheel(screenAngle) {
    const canvas = document.getElementById('s2-aim-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42;
    ctx.clearRect(0, 0, W, H);

    // Soft pad background — no harsh ring, no tick marks
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    bg.addColorStop(0, 'rgba(50,80,140,0.35)');
    bg.addColorStop(1, 'rgba(10,18,45,0.25)');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(160,195,255,0.18)'; ctx.lineWidth = 1.2; ctx.stroke();

    // Direction line from center to handle
    const hR = R * 0.68;
    const hx = cx + Math.cos(screenAngle) * hR;
    const hy = cy + Math.sin(screenAngle) * hR;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy);
    ctx.strokeStyle = 'rgba(180,215,255,0.75)'; ctx.lineWidth = 2.5;
    ctx.lineCap = 'round'; ctx.stroke();

    // Arrowhead
    const hL = 11, hA = Math.PI / 5;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - hL * Math.cos(screenAngle - hA), hy - hL * Math.sin(screenAngle - hA));
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - hL * Math.cos(screenAngle + hA), hy - hL * Math.sin(screenAngle + hA));
    ctx.strokeStyle = '#c8e0ff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();

    // Handle dot (drag indicator)
    ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,185,255,0.9)'; ctx.fill();

    // Center dot
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180,215,255,0.45)'; ctx.fill();
}

function showS2Wheel(ball) {
    const wc = document.getElementById('s2-dir-wheel');
    if (!wc) return;
    wc.style.display = 'flex';
    // Default: tangential CCW (circular orbit direction)
    _s2WheelWorldAngle = Math.atan2(ball.z, ball.x) + Math.PI / 2;
    _drawS2Wheel(_worldAngleToScreenAngle(_s2WheelWorldAngle));
}

function hideS2Wheel() {
    const wc = document.getElementById('s2-dir-wheel');
    if (wc) wc.style.display = 'none';
}

// Backward-compat alias used by level1_main.js setStage
function hideS2DirectionOverlay() { hideS2Wheel(); }

function s2WheelUpdateAngle(cx, cy) {
    if (!s2PendingBall) return;
    // Direction = angle from pad canvas center to pointer position
    const canvas = document.getElementById('s2-aim-pad');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padCx = rect.left + rect.width / 2;
    const padCy = rect.top + rect.height / 2;
    const dx = cx - padCx, dy = cy - padCy;
    if (Math.hypot(dx, dy) < 8) return; // ignore tiny jitter near pad center
    const screenAngle = Math.atan2(dy, dx);
    _s2WheelWorldAngle = _screenAngleToWorldAngle(screenAngle);
    _drawS2Wheel(screenAngle);
}

function s2WheelLaunch() {
    const ball = s2PendingBall;
    if (!ball || !s1CentralObj) { hideS2Wheel(); return; }
    // ── Physics unchanged ── magnitude = circular orbit speed, direction = chosen angle
    const r = Math.hypot(ball.x, ball.z);
    const gravStrength = 22 * s1CentralObj.mass * (1.0 + ball.mass * 0.004);
    const vCirc = Math.sqrt(gravStrength / Math.max(r, 1));
    ball.vx = Math.cos(_s2WheelWorldAngle) * vCirc;
    ball.vz = Math.sin(_s2WheelWorldAngle) * vCirc;
    s2PendingBall = null;
    hideS2Wheel();
}

function s2CancelPlacement() {
    if (s2PendingBall) {
        scene.remove(s2PendingBall.mesh); scene.remove(s2PendingBall.glow);
        s1Balls = s1Balls.filter(b => b !== s2PendingBall);
        s2PendingBall = null;
        updateS1Counter(); updateBlanketDeformation();
    }
    hideS2Wheel();
}

// ─── Physics ─────────────────────────────────────────────────────────────

function updateStage1Physics(dt) {
    if (!isPlaying || !s1CentralObj) return;
    const subs = 2;
    const step = (dt * 110.0) / subs;
    const escapeDistance = 2500;

    const gravityStrength = 22 * s1CentralObj.mass;

    for (let s = 0; s < subs; s++) {
        for (let i = s1Balls.length - 1; i >= 0; i--) {
            const b = s1Balls[i]; if (!b.alive) continue;

            if (b.vx === 0 && b.vz === 0 && b === s2PendingBall) continue;

            const r = Math.max(Math.hypot(b.x, b.z), 1);
            const ux = b.x / r, uz = b.z / r;

            const effectiveGravity = gravityStrength * (1.0 + b.mass * 0.004);
            let accel = effectiveGravity / (r * r);
            accel = Math.min(accel, 25000);

            b.vx -= accel * ux * step; b.vz -= accel * uz * step;
            b.x  += b.vx * step;      b.z  += b.vz * step;

            // Stage-aware absorb: stage 2 balls have their own radius, prevent eating them on surface
            const absorbRadius = stage === 2 ? s1CentralObj.radius + b.radius + 10 : s1CentralObj.radius + 15;
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

    for (let i = s1Balls.length - 1; i >= 0; i--) {
        const b = s1Balls[i];
        const r = Math.hypot(b.x, b.z);
        const ux = b.x / Math.max(r, 1), uz = b.z / Math.max(r, 1);
        const outwardSpeed = b.vx * ux + b.vz * uz;
        const tangentialSpeed = Math.abs(b.vx * -uz + b.vz * ux);
        const radialRatio = Math.abs(outwardSpeed) / Math.max(tangentialSpeed, 0.001);

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
