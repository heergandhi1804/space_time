// ═══════════════════════════════════════════════════
//  LEVEL 1 COMMON STATE & CONSTANTS
// ═══════════════════════════════════════════════════

let s1CentralObj = null, selectedS1Ball = null, s1Balls = [];

const prevDragPt = new THREE.Vector3();
let pointerDownX = 0, pointerDownY = 0, isPanning = false, panStart = { x: 0, y: 0 };

const G = 5, SURFACE_OFFSET = 300;
const GRID_SIZE = 2600, GRID_RES = 14, GRID_SEGS = Math.floor(GRID_SIZE * 2 / GRID_RES);
// Larger scale spreads L1S3 planets for better visibility (sqrt-distance preserves Kepler spacing)
const ORBIT_SCALE = 26;
const STAGE2_ESCAPE_DIST = 5800;
let stage2SpeedMode = 'normal';

// Real orbital data for L1S3 display (scientifically accurate labels)
const SOLAR_REAL = {
    Mercury: { speedKms: 47.87, speedMph: 107082, periodDays: 88 },
    Venus:   { speedKms: 35.02, speedMph: 78337,  periodDays: 225 },
    Earth:   { speedKms: 29.78, speedMph: 66615,  periodDays: 365.25 },
    Mars:    { speedKms: 24.08, speedMph: 53858,  periodDays: 687 },
    Jupiter: { speedKms: 13.07, speedMph: 29236,  periodDays: 4307 },
    Saturn:  { speedKms: 9.69,  speedMph: 21675,  periodDays: 10768 },
    Uranus:  { speedKms: 6.81,  speedMph: 15233,  periodDays: 30660 },
    Neptune: { speedKms: 5.43,  speedMph: 12146,  periodDays: 60190 }
};

const SOLAR = [
    { name: 'Mercury', m: 38,  c: 0x9b8a7d, distance: 108.9 },
    { name: 'Venus',   m: 52,  c: 0xe8c878, distance: 175.0 },
    { name: 'Earth',   m: 55,  c: 0x3a7fb8, distance: 230.0 },
    { name: 'Mars',    m: 45,  c: 0xc1502a, distance: 340.0 },
    { name: 'Jupiter', m: 110, c: 0xc9a878, distance: 828.5 },
    { name: 'Saturn',  m: 95,  c: 0xd9c89a, distance: 1482.0 },
    { name: 'Uranus',  m: 72,  c: 0x8fd5d3, distance: 2917.0 },
    { name: 'Neptune', m: 70,  c: 0x3858a8, distance: 4565.0 }
].map(p => ({ ...p, r: Math.sqrt(p.distance) * ORBIT_SCALE }));

// Central mass presets — no black hole in L1S1
const S1_CENTRAL_PRESETS = {
    light:  { mass: 90 },
    medium: { mass: 160 },
    heavy:  { mass: 260 }
};

// Ball presets — names: big+slow=Mega Marshmallow, big+fast=Comet, small+slow=Marble, small+fast=Bullet
const S1_BALL_PRESETS = {
    cometMango:  { mass: 150, baseSpeed: 2.8, color: 0xff8844, label: '🟠 The Mega Marshmallow' },
    tinyRocket:  { mass: 150, baseSpeed: 6.2, color: 0xffcc44, label: '🔴 The Comet' },
    spaceMarble: { mass: 30,  baseSpeed: 2.8, color: 0x66c8ff, label: '🔵 The Marble' },
    orbitBerry:  { mass: 30,  baseSpeed: 6.2, color: 0xcc66ff, label: '🟣 The Bullet' }
};

let s1Config = { centralPreset: 'light', ballPreset: 'cometMango' };
const S1_BLANKET_HALF = 1100;
const S1_PLACE_LIMIT = 980;

// L1S2: pending direction selection state
let s2PendingBall = null;   // ball awaiting direction choice
let s2Aiming = false;        // true when the 3D aim arrow is visible
let s2AimPointerMoved = false; // true if pointer moved since aim session started (drag detection)
