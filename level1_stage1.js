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
    if (Math.abs(wx) > S1_PLACE_LIMIT || Math.abs(wz) > S1_PLACE_LIMIT) {
        return showToast('Tap on the blanket!');
    }
    if (isPlaying) return showToast();
    if (!s1CentralObj) return;
    const r = Math.hypot(wx, wz);

    const preset = S1_BALL_PRESETS[s1Config.ballPreset];
    const mass = preset.mass, color = preset.color;
    const visualRadius = 12 + Math.sqrt(mass) * 2.8;

    // Placement safety: keep ball outside the watermelon safe radius
    // safeRadius = watermelonRadius + ballRadius + margin
    const minDist = stage === 2 ? s1CentralObj.radius + visualRadius + 25 : s1CentralObj.radius + 45;
    if (r < minDist) return showToast('Too close to the watermelon!');

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
        // Clear any stale aim visuals before accepting the new pending ball
        s2Aiming = false;
        s2AimPointerMoved = false;
        s2RemoveAimArrow();
        // === OPTIONAL PROJECTED PATH START ===
        s2RemoveProjectedPath();
        // === OPTIONAL PROJECTED PATH END ===
        s2PendingBall = ball;
        // Auto-enter aiming immediately — arrow appears right after placement
        s2StartAim(0, 0);
        showFloatingMessage('Aim the ball', '#99ddff');
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
    s2Aiming = false; s2AimPointerMoved = false;
    s2RemoveAimArrow();
    // === OPTIONAL PROJECTED PATH START ===
    s2RemoveProjectedPath();
    // === OPTIONAL PROJECTED PATH END ===
    const btn = document.getElementById('s1-remove-btn'); if (btn) btn.disabled = true;
    s1Config = { centralPreset: 'light', ballPreset: 'cometMango' };
    document.querySelectorAll('[data-central]').forEach(b => b.classList.toggle('active', b.dataset.central === 'light'));
    document.querySelectorAll('[data-ball]').forEach(b => b.classList.toggle('active', b.dataset.ball === 'cometMango'));
    createS1CentralObject(S1_CENTRAL_PRESETS.light.mass);
    updateS1Counter(); showToast('Experiment Reset');
}

// ─── L1S2 In-Scene Pool-Table Aiming ─────────────────────────────────────

let s2AimArrow = null;      // THREE.ArrowHelper placed in the 3D scene
let s2AimWorldDirX = 1;     // current aim direction (world XZ plane, normalized)
let s2AimWorldDirZ = 0;

const S2_ARROW_LENGTH = 200;
const S2_ARROW_HEAD   = 48;
const S2_ARROW_WIDTH  = 22;
const S2_ARROW_COLOR  = 0x99ddff;

// Activates aiming mode — called automatically after placement or on tap
function s2StartAim(clientX, clientY) {
    if (!s2PendingBall) return;
    s2Aiming = true;
    s2AimPointerMoved = false;
    // Highlight the pending ball so it's clearly selected
    if (s2PendingBall.glow && s2PendingBall.glow.material) s2PendingBall.glow.material.opacity = 1.0;

    // Default direction: tangential CCW (classic orbit direction)
    const bx = s2PendingBall.x, bz = s2PendingBall.z;
    const r = Math.hypot(bx, bz);
    if (r > 1) { s2AimWorldDirX = -bz / r; s2AimWorldDirZ = bx / r; }
    else        { s2AimWorldDirX = 1;        s2AimWorldDirZ = 0; }

    s2CreateAimArrow();
    // === OPTIONAL PROJECTED PATH START ===
    s2CreateProjectedPath();
    // === OPTIONAL PROJECTED PATH END ===
}

function s2CreateAimArrow() {
    s2RemoveAimArrow();
    if (!s2PendingBall) return;
    const dir    = new THREE.Vector3(s2AimWorldDirX, 0, s2AimWorldDirZ).normalize();
    const origin = s2PendingBall.mesh.position.clone();
    origin.y += 12; // lift above ball surface so arrow is visible above blanket
    s2AimArrow = new THREE.ArrowHelper(dir, origin, S2_ARROW_LENGTH, S2_ARROW_COLOR, S2_ARROW_HEAD, S2_ARROW_WIDTH);
    if (s2AimArrow.line && s2AimArrow.line.material) {
        s2AimArrow.line.material.transparent = true;
        s2AimArrow.line.material.opacity = 0.88;
    }
    if (s2AimArrow.cone && s2AimArrow.cone.material) {
        s2AimArrow.cone.material.transparent = true;
        s2AimArrow.cone.material.opacity = 0.92;
    }
    scene.add(s2AimArrow);
}

function s2RemoveAimArrow() {
    if (!s2AimArrow) return;
    scene.remove(s2AimArrow);
    s2AimArrow.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    s2AimArrow = null;
}

// Sync arrow position to ball mesh and update its direction
function s2UpdateAimArrowVisual() {
    if (!s2AimArrow || !s2PendingBall) return;
    const dir    = new THREE.Vector3(s2AimWorldDirX, 0, s2AimWorldDirZ).normalize();
    const origin = s2PendingBall.mesh.position.clone();
    origin.y += 12;
    s2AimArrow.position.copy(origin);
    s2AimArrow.setDirection(dir);
}

// Update aim direction from pointer/touch position in screen space
function s2UpdateAimFromPointer(clientX, clientY) {
    if (!s2PendingBall) return;

    // Cast ray from camera through pointer; intersect horizontal plane at ball's Y
    mouse2d.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse2d, camera);
    const ballY    = s2PendingBall.mesh.position.y;
    const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ballY);
    const pt       = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(aimPlane, pt)) return;

    const dx = pt.x - s2PendingBall.x;
    const dz = pt.z - s2PendingBall.z;
    const len = Math.hypot(dx, dz);
    if (len < 15) return; // pointer too close to ball center — keep current direction

    s2AimWorldDirX = dx / len;
    s2AimWorldDirZ = dz / len;
    s2UpdateAimArrowVisual();

    // === OPTIONAL PROJECTED PATH START ===
    s2UpdateProjectedPath();
    // === OPTIONAL PROJECTED PATH END ===
}

// Launch the ball using the current aim direction.
// Speed magnitude is UNCHANGED from the original wheel logic — only direction source differs.
function s2LaunchFromAim() {
    const ball = s2PendingBall;
    if (!ball || !s1CentralObj) { s2CancelAim(); return; }
    if (ball.glow && ball.glow.material) ball.glow.material.opacity = 0.65; // reset highlight

    // ── Velocity magnitude: circular orbit speed (same formula as before) ──
    const r           = Math.hypot(ball.x, ball.z);
    const gravStrength = 22 * s1CentralObj.mass * (1.0 + ball.mass * 0.004);
    const vCirc        = Math.sqrt(gravStrength / Math.max(r, 1));
    ball.vx = s2AimWorldDirX * vCirc;
    ball.vz = s2AimWorldDirZ * vCirc;

    s2PendingBall     = null;
    s2Aiming          = false;
    s2AimPointerMoved = false;
    s2RemoveAimArrow();
    // === OPTIONAL PROJECTED PATH START ===
    s2RemoveProjectedPath();
    // === OPTIONAL PROJECTED PATH END ===
}

// Cancel aiming: remove the unlaunched ball and clean up all aim visuals
function s2CancelAim() {
    if (s2PendingBall) {
        if (s2PendingBall.glow && s2PendingBall.glow.material) s2PendingBall.glow.material.opacity = 0.65;
        scene.remove(s2PendingBall.mesh);
        scene.remove(s2PendingBall.glow);
        s1Balls = s1Balls.filter(b => b !== s2PendingBall);
        updateS1Counter();
        updateBlanketDeformation();
    }
    s2PendingBall     = null;
    s2Aiming          = false;
    s2AimPointerMoved = false;
    s2RemoveAimArrow();
    // === OPTIONAL PROJECTED PATH START ===
    s2RemoveProjectedPath();
    // === OPTIONAL PROJECTED PATH END ===
}

// ── Aliases used by setStage / resetStage1Lab ────────────────────────────
function hideS2Wheel() {
    s2Aiming = false; s2AimPointerMoved = false;
    s2RemoveAimArrow();
    // === OPTIONAL PROJECTED PATH START ===
    s2RemoveProjectedPath();
    // === OPTIONAL PROJECTED PATH END ===
}
function hideS2DirectionOverlay() { hideS2Wheel(); }

// === OPTIONAL PROJECTED PATH START ===
// Faint dashed guide line showing the straight-line launch direction from the ball.
// Delete everything between these markers to remove the projected path feature.
// Launching works correctly without this section — it is purely visual.

let s2PathLine = null;

function s2CreateProjectedPath() {
    s2RemoveProjectedPath();
    if (!s2PendingBall) return;
    const numPts = 14, spacing = 38;
    const points = [];
    for (let i = 1; i <= numPts; i++) {
        const px = s2PendingBall.x + s2AimWorldDirX * spacing * i;
        const pz = s2PendingBall.z + s2AimWorldDirZ * spacing * i;
        const py = computeBlanketY(px, pz, s2PendingBall) + s2PendingBall.radius * 0.35 + 6;
        points.push(new THREE.Vector3(px, py, pz));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineDashedMaterial({
        color: 0x99ddff, transparent: true, opacity: 0.28,
        dashSize: 22, gapSize: 14, depthWrite: false
    });
    s2PathLine = new THREE.Line(geo, mat);
    s2PathLine.computeLineDistances();
    scene.add(s2PathLine);
}

function s2UpdateProjectedPath() {
    if (!s2PathLine || !s2PendingBall) { s2CreateProjectedPath(); return; }
    const numPts = 14, spacing = 38;
    const pos = s2PathLine.geometry.attributes.position;
    for (let i = 0; i < numPts; i++) {
        const px = s2PendingBall.x + s2AimWorldDirX * spacing * (i + 1);
        const pz = s2PendingBall.z + s2AimWorldDirZ * spacing * (i + 1);
        const py = computeBlanketY(px, pz, s2PendingBall) + s2PendingBall.radius * 0.35 + 6;
        pos.setXYZ(i, px, py, pz);
    }
    pos.needsUpdate = true;
    s2PathLine.computeLineDistances();
}

function s2RemoveProjectedPath() {
    if (!s2PathLine) return;
    scene.remove(s2PathLine);
    s2PathLine.geometry.dispose();
    s2PathLine.material.dispose();
    s2PathLine = null;
}
// === OPTIONAL PROJECTED PATH END ===

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
