// ═══════════════════════════════════════════════════
//  LEVEL 1 COMMON STATE & CONSTANTS
// ═══════════════════════════════════════════════════

let s1CentralObj = null, selectedS1Ball = null, s1Balls = [];

const prevDragPt = new THREE.Vector3();
let pointerDownX = 0, pointerDownY = 0, isPanning = false, panStart = { x: 0, y: 0 };

const G = 5, SURFACE_OFFSET = 300;
const GRID_SIZE = 5000, GRID_RES = 14, GRID_SEGS = Math.floor(GRID_SIZE * 2 / GRID_RES);
const ORBIT_SCALE = 15.8;
const STAGE2_ESCAPE_DIST = 5800;
let stage2SpeedMode = 'normal';

const SOLAR = [
    { name: 'Mercury', m: 25, c: 0x9b8a7d, distance: 108.9 },
    { name: 'Venus', m: 38, c: 0xe8c878, distance: 158.2 },
    { name: 'Earth', m: 40, c: 0x3a7fb8, distance: 199.6 },
    { name: 'Mars', m: 30, c: 0xc1502a, distance: 298.0 },
    { name: 'Jupiter', m: 90, c: 0xc9a878, distance: 828.5 },
    { name: 'Saturn', m: 75, c: 0xd9c89a, distance: 1482.0 },
    { name: 'Uranus', m: 55, c: 0x8fd5d3, distance: 2917.0 },
    { name: 'Neptune', m: 53, c: 0x3858a8, distance: 4565.0 }
].map(p => ({ ...p, r: Math.sqrt(p.distance) * ORBIT_SCALE }));

const S1_CENTRAL_PRESETS = {
    light: { mass: 90 },
    medium: { mass: 160 },
    heavy: { mass: 260 },
    blackhole: { mass: 360 }
};
const S1_BALL_PRESETS = {
    slowHeavy: { mass: 88, speedMultiplier: 1.72, color: 0x66c8ff },
    fastHeavy: { mass: 88, speedMultiplier: 2.65, color: 0xffcc44 },
    slowLight: { mass: 44, speedMultiplier: 1.72, color: 0x9eff70 },
    fastLight: { mass: 44, speedMultiplier: 2.65, color: 0xff6688 }
};

let s1Config = { centralPreset: 'light', ballPreset: 'slowHeavy', direction: 'forward' };
const S1_BLANKET_HALF = 1100;
const S1_PLACE_LIMIT = 980;
