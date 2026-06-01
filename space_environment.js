// space_environment.js
// Visual background space additions for Space-Time Explorer

const starVertexShader = `
  uniform float uTime;
  attribute float aSize;
  attribute float aTwinkleSpeed;
  attribute float aTwinkleDelay;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
      vColor = color;
      // Twinkle: oscillate between 0.45 and 1.0 (warmer, less fading)
      vTwinkle = 0.45 + 0.55 * sin(uTime * aTwinkleSpeed + aTwinkleDelay);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      // Independent of depth so they remain beautifully visible and crisp at all zoom levels
      gl_PointSize = aSize;
      gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.15, dist) * vTwinkle;
      gl_FragColor = vec4(vColor, alpha);
  }
`;

let spaceEnvironment = {
    initialized: false,
    starMaterial: null,
    starSystems: [],
    nebulae: [],
    comet: null,
    cometActive: false,
    cometTimer: 5, // spawn first comet in 5 seconds
    spaceDust: null,
    spaceDustGeometry: null,
    spaceDustPositions: null,
    spaceDustVelocities: null,
    spaceDustCount: 150,
    spaceDustBoxSize: 4500
};

// Generates a beautiful procedural cloud texture on canvas
function generateNebulaTexture(seed) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);

    // Simple FBM implementation since core.js might be loaded after/before
    // We can use a local noise/fbm helper to guarantee self-containment
    function localNoise2D(x, y, s) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
        return n - Math.floor(n);
    }
    function localSmoothNoise(x, y, s) {
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const a = localNoise2D(ix, iy, s);
        const b = localNoise2D(ix + 1, iy, s);
        const c = localNoise2D(ix, iy + 1, s);
        const d = localNoise2D(ix + 1, iy + 1, s);
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);
        return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    }
    function localFbm(x, y, s, oct = 4) {
        let v = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < oct; i++) {
            v += amp * localSmoothNoise(x * freq, y * freq, s + i * 17);
            amp *= 0.5; freq *= 2;
        }
        return v;
    }

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = x / size - 0.5;
            const ny = y / size - 0.5;
            const dist = Math.sqrt(nx * nx + ny * ny);
            const fade = Math.max(0, 1 - dist * 2);

            if (fade <= 0) {
                const idx = (y * size + x) * 4;
                img.data[idx] = 0; img.data[idx + 1] = 0; img.data[idx + 2] = 0; img.data[idx + 3] = 0;
                continue;
            }

            const n1 = localFbm(x / 55, y / 55, seed, 4);
            const n2 = localFbm(x / 35, y / 35, seed + 15.7, 3);

            // Highly vibrant, rich deep space colors (Vibrant Violet/Electric Cyan/Vivid Magenta)
            const r1 = 140, g1 = 30, b1 = 220;
            const r2 = 20, g2 = 150, b2 = 255;
            const r3 = 255, g3 = 50, b3 = 160;

            const t1 = n1;
            let r = r1 * (1 - t1) + r2 * t1;
            let g = g1 * (1 - t1) + g2 * t1;
            let b = b1 * (1 - t1) + b2 * t1;

            if (n2 > 0.55) {
                const t3 = (n2 - 0.55) / 0.45;
                r = r * (1 - t3) + r3 * t3;
                g = g * (1 - t3) + g3 * t3;
                b = b * (1 - t3) + b3 * t3;
            }

            // More prominent opacity curve for the nebula clouds
            const alpha = Math.max(0, (n1 * 0.7 + n2 * 0.3 - 0.20)) * fade * 1.35;
            const idx = (y * size + x) * 4;
            img.data[idx] = Math.min(255, Math.max(0, r));
            img.data[idx + 1] = Math.min(255, Math.max(0, g));
            img.data[idx + 2] = Math.min(255, Math.max(0, b));
            img.data[idx + 3] = Math.min(255, Math.max(0, alpha * 255));
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// Generates a fading comet tail texture
function generateCometTailTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(200, 240, 255, 0.9)');
    grad.addColorStop(0.2, 'rgba(110, 190, 255, 0.5)');
    grad.addColorStop(0.7, 'rgba(70, 120, 210, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

// Initializes all visual additions
function initSpaceEnvironment(scene, camera) {
    if (spaceEnvironment.initialized) {
        // Clean up first if already exists
        clearSpaceEnvironment(scene);
    }

    // Adjust density based on mobile screen width
    const isMobile = window.innerWidth <= 768;
    const starMult = isMobile ? 0.45 : 1.0;

    // 1. STAR MATERIAL (Twinkling shader)
    spaceEnvironment.starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    // Helper to build a shell points layer
    function buildStarField(count, minR, maxR, minSize, maxSize) {
        const geo = new THREE.BufferGeometry();
        const pos = [];
        const colors = [];
        const sizes = [];
        const speeds = [];
        const delays = [];

        for (let i = 0; i < count; i++) {
            // Random direction on sphere
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = minR + Math.random() * (maxR - minR);

            pos.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );

            // Color variation: 70% white/blue, 20% yellow, 8% cyan, 2% red
            const rnd = Math.random();
            let color;
            if (rnd < 0.70) {
                color = new THREE.Color(0.85 + Math.random() * 0.15, 0.9 + Math.random() * 0.1, 1.0);
            } else if (rnd < 0.90) {
                color = new THREE.Color(1.0, 0.85 + Math.random() * 0.15, 0.65 + Math.random() * 0.15);
            } else if (rnd < 0.98) {
                color = new THREE.Color(0.65 + Math.random() * 0.15, 0.9 + Math.random() * 0.1, 1.0);
            } else {
                // Red Giant (make it larger too)
                color = new THREE.Color(1.0, 0.45 + Math.random() * 0.15, 0.35 + Math.random() * 0.15);
            }
            colors.push(color.r, color.g, color.b);

            // Sizes
            const size = (rnd >= 0.98) ? (minSize + Math.random() * (maxSize - minSize)) * 1.8 : (minSize + Math.random() * (maxSize - minSize));
            sizes.push(size);

            // Twinkle parameters
            speeds.push(1.0 + Math.random() * 2.5); // speed of pulse
            delays.push(Math.random() * Math.PI * 2.0); // offset
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
        geo.setAttribute('aTwinkleSpeed', new THREE.Float32BufferAttribute(speeds, 1));
        geo.setAttribute('aTwinkleDelay', new THREE.Float32BufferAttribute(delays, 1));

        const pts = new THREE.Points(geo, spaceEnvironment.starMaterial);
        scene.add(pts);
        return pts;
    }

    // Create 3 layers of stars (increased density and sizes for starry prominence)
    spaceEnvironment.starSystems.push(buildStarField(Math.floor(2000 * starMult), 22000, 26000, 2.2, 3.6)); // Far, small
    spaceEnvironment.starSystems.push(buildStarField(Math.floor(1000 * starMult), 16000, 21000, 3.6, 5.5)); // Mid, medium
    spaceEnvironment.starSystems.push(buildStarField(Math.floor(350 * starMult), 10000, 15000, 5.5, 8.5)); // Near, bright

    // 2. PROCEDURAL NEBULA CLOUDS (increased opacity and visibility)
    const nebulaGeo = new THREE.PlaneGeometry(16000, 16000);
    
    // Nebula 1 (deep violet)
    const nebulaMat1 = new THREE.MeshBasicMaterial({
        map: generateNebulaTexture(77.7),
        transparent: true,
        opacity: isMobile ? 0.22 : 0.38,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const nebula1 = new THREE.Mesh(nebulaGeo, nebulaMat1);
    nebula1.position.set(-8000, -3000, -18000);
    nebula1.rotation.set(0.3, 0.5, 0.2);
    scene.add(nebula1);
    spaceEnvironment.nebulae.push(nebula1);

    // Nebula 2 (glowing cyan/indigo)
    const nebulaMat2 = new THREE.MeshBasicMaterial({
        map: generateNebulaTexture(154.3),
        transparent: true,
        opacity: isMobile ? 0.18 : 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const nebula2 = new THREE.Mesh(nebulaGeo, nebulaMat2);
    nebula2.position.set(9000, 2000, -19000);
    nebula2.rotation.set(-0.4, -0.3, 0.6);
    scene.add(nebula2);
    spaceEnvironment.nebulae.push(nebula2);

    // 3. DECORATIVE COMET (Visual-only)
    // We create a Group for the comet
    const cometGroup = new THREE.Group();
    cometGroup.visible = false;

    // Comet head: high intensity glowing sprite
    const headCanvas = document.createElement('canvas');
    headCanvas.width = 64; headCanvas.height = 64;
    const hctx = headCanvas.getContext('2d');
    const hgrad = hctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    hgrad.addColorStop(0, 'rgba(255,255,255,1.0)');
    hgrad.addColorStop(0.2, 'rgba(180,230,255,0.85)');
    hgrad.addColorStop(0.6, 'rgba(80,160,255,0.25)');
    hgrad.addColorStop(1, 'rgba(0,0,0,0)');
    hctx.fillStyle = hgrad;
    hctx.fillRect(0, 0, 64, 64);
    const headSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(headCanvas),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
    headSprite.scale.set(120, 120, 1);
    cometGroup.add(headSprite);

    // Comet tail: stretched plane with gradient texture
    const tailTex = generateCometTailTexture();
    const tailGeo = new THREE.PlaneGeometry(650, 90);
    // Align plane so width is along Y/local and length stretches along X/local
    // By default PlaneGeometry is centered, let's offset vertices so tail extends behind head (to the right of origin)
    tailGeo.translate(325, 0, 0); 
    const tailMat = new THREE.MeshBasicMaterial({
        map: tailTex,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
    });
    const tailMesh = new THREE.Mesh(tailGeo, tailMat);
    // Rotate so it stretches horizontally in the group
    tailMesh.rotation.y = Math.PI; // Face opposite direction
    cometGroup.add(tailMesh);

    scene.add(cometGroup);
    spaceEnvironment.comet = cometGroup;
    spaceEnvironment.cometActive = false;

    // 4. DRIFTING SPACE DUST (Foreground)
    const dustCount = isMobile ? 60 : spaceEnvironment.spaceDustCount;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustVels = [];

    const box = spaceEnvironment.spaceDustBoxSize;
    for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * box;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * box * 0.4; // flat disc
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * box;

        // Slow drift velocity
        dustVels.push(
            (Math.random() - 0.5) * 12 - 3, // slightly prograde drift
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 12 + 2
        );
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    
    // Draw small soft stars for dust particles
    const dustCanvas = document.createElement('canvas');
    dustCanvas.width = 16; dustCanvas.height = 16;
    const dctx = dustCanvas.getContext('2d');
    const dgrad = dctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    dgrad.addColorStop(0, 'rgba(200, 240, 255, 0.7)');
    dgrad.addColorStop(0.5, 'rgba(100, 180, 255, 0.18)');
    dgrad.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = dgrad;
    dctx.fillRect(0, 0, 16, 16);

    const dustMat = new THREE.PointsMaterial({
        size: 16,
        map: new THREE.CanvasTexture(dustCanvas),
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    spaceEnvironment.spaceDust = new THREE.Points(dustGeo, dustMat);
    scene.add(spaceEnvironment.spaceDust);
    spaceEnvironment.spaceDustGeometry = dustGeo;
    spaceEnvironment.spaceDustPositions = dustPos;
    spaceEnvironment.spaceDustVelocities = dustVels;

    spaceEnvironment.initialized = true;
}

// Clears all environment visual elements from scene
function clearSpaceEnvironment(scene) {
    if (!spaceEnvironment.initialized) return;

    spaceEnvironment.starSystems.forEach(s => {
        scene.remove(s);
        s.geometry.dispose();
    });
    spaceEnvironment.starSystems = [];

    if (spaceEnvironment.starMaterial) {
        spaceEnvironment.starMaterial.dispose();
        spaceEnvironment.starMaterial = null;
    }

    spaceEnvironment.nebulae.forEach(n => {
        scene.remove(n);
        n.geometry.dispose();
        n.material.map.dispose();
        n.material.dispose();
    });
    spaceEnvironment.nebulae = [];

    if (spaceEnvironment.comet) {
        scene.remove(spaceEnvironment.comet);
        spaceEnvironment.comet.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
                if (c.material.map) c.material.map.dispose();
                c.material.dispose();
            }
        });
        spaceEnvironment.comet = null;
        spaceEnvironment.cometActive = false;
    }

    if (spaceEnvironment.spaceDust) {
        scene.remove(spaceEnvironment.spaceDust);
        spaceEnvironment.spaceDustGeometry.dispose();
        spaceEnvironment.spaceDust.material.map.dispose();
        spaceEnvironment.spaceDust.material.dispose();
        spaceEnvironment.spaceDust = null;
    }

    spaceEnvironment.initialized = false;
}

// Update loop for background elements (twinkling, comets, dust drift)
function tickSpaceEnvironment(dt, camera) {
    if (!spaceEnvironment.initialized) return;

    // 1. UPDATE TIME FOR TWINKLE SHADER
    if (spaceEnvironment.starMaterial) {
        // Increment uniform time (modulo to avoid precision issues)
        if (!spaceEnvironment.starTime) spaceEnvironment.starTime = 0.0;
        spaceEnvironment.starTime = (spaceEnvironment.starTime + dt) % 1000.0;
        spaceEnvironment.starMaterial.uniforms.uTime.value = spaceEnvironment.starTime;
    }

    // 2. COMET TICK
    if (spaceEnvironment.comet) {
        if (spaceEnvironment.cometActive) {
            // Move comet
            const pos = spaceEnvironment.comet.position;
            pos.x += spaceEnvironment.cometVel.x * dt;
            pos.y += spaceEnvironment.cometVel.y * dt;
            pos.z += spaceEnvironment.cometVel.z * dt;

            // Fade comet trail out slightly if nearing end
            const limit = 12000;
            const dist = Math.hypot(pos.x, pos.z);
            if (dist > limit) {
                spaceEnvironment.cometActive = false;
                spaceEnvironment.comet.visible = false;
                spaceEnvironment.cometTimer = 18.0 + Math.random() * 18.0; // spawn next in 18-36s
            }
        } else {
            // Comet spawn timer
            spaceEnvironment.cometTimer -= dt;
            if (spaceEnvironment.cometTimer <= 0) {
                // Spawn comet
                spaceEnvironment.cometActive = true;
                
                // Select entry side: left or right of deep background
                const side = Math.random() > 0.5 ? 1 : -1;
                const startX = -10000 * side;
                const startZ = -14000;
                const startY = 1200 + Math.random() * 1500;

                spaceEnvironment.comet.position.set(startX, startY, startZ);

                // Set speed (slow, elegant traverse)
                const speedX = (150 + Math.random() * 150) * side;
                const speedZ = -20 + Math.random() * 80;
                const speedY = -40 - Math.random() * 60;
                spaceEnvironment.cometVel = { x: speedX, y: speedY, z: speedZ };

                // Rotate comet group to point in velocity vector direction
                const angle = Math.atan2(speedY, speedX);
                spaceEnvironment.comet.rotation.set(0, 0, angle);

                spaceEnvironment.comet.visible = true;
            }
        }
    }

    // 3. DRIFTING SPACE DUST TICK (wrapped around camera/viewport position)
    if (spaceEnvironment.spaceDust && camera) {
        const posAttr = spaceEnvironment.spaceDustGeometry.attributes.position;
        const positions = spaceEnvironment.spaceDustPositions;
        const velocities = spaceEnvironment.spaceDustVelocities;
        const box = spaceEnvironment.spaceDustBoxSize;
        const halfBox = box / 2;

        const camX = camera.position.x;
        const camY = camera.position.y;
        const camZ = camera.position.z;

        for (let i = 0; i < positions.length / 3; i++) {
            const idx = i * 3;
            // Apply drift velocity
            positions[idx] += velocities[idx] * dt;
            positions[idx + 1] += velocities[idx + 1] * dt;
            positions[idx + 2] += velocities[idx + 2] * dt;

            // Wrap coordinates relative to current camera position to keep dust local
            const rx = positions[idx] - camX;
            const ry = positions[idx + 1] - camY;
            const rz = positions[idx + 2] - camZ;

            if (rx > halfBox) positions[idx] -= box;
            else if (rx < -halfBox) positions[idx] += box;

            if (ry > halfBox * 0.4) positions[idx + 1] -= box * 0.4;
            else if (ry < -halfBox * 0.4) positions[idx + 1] += box * 0.4;

            if (rz > halfBox) positions[idx + 2] -= box;
            else if (rz < -halfBox) positions[idx + 2] += box;
        }
        posAttr.needsUpdate = true;
    }
}
