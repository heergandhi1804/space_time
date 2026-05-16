// level2_common.js
// Shared state and constants for Level 2

// Physics Constants
const G = 10;
const SURFACE_OFFSET = 300;
const GRID_SIZE = 5000;
const GRID_RES = 80;
const GRID_SEGS = Math.floor(GRID_SIZE * 2 / GRID_RES);

// Stage 2 Physics Tweaks
const STAGE_2_SUBSTEPS = 12;
const STAGE_2_TIME_SCALE = 1.6;
const PLANET_GRAVITY_MULT = 1.0;
const MIN_PHYSICS_DISTANCE = 5.0;
const COLLAPSE_SAFETY_MARGIN = 2.0;
const COLLISION_PADDING = 5.0;
const TOUCH_HIT_RADIUS = 50;
const STAGE2_ORBIT_MULT_STRENGTH = 0.25;

// Global State
let lastStage2WarningTime = 0;
let s2FrameCounter = 0;


// Planet Config
const SPIN_RATES = { Sun: 0.1, Mercury: 0.8, Venus: 0.7, Earth: 1.0, Mars: 0.9, Jupiter: 1.6, Saturn: 1.5, Uranus: 1.2, Neptune: 1.1 };
const ORBIT_SPEED_MULT = { Mercury: 1.45, Venus: 1.15, Earth: 1.0, Mars: 0.8, Jupiter: 0.45, Saturn: 0.35, Uranus: 0.25, Neptune: 0.18 };
const GLOW_PARAMS = {
    'Sun': { color: '#FFD700', sizeMultiplier: 2.8 },
    'Mercury': { color: '#A5A5A5', sizeMultiplier: 1.8 },
    'Venus': { color: '#E3BB76', sizeMultiplier: 1.8 },
    'Earth': { color: '#2271B3', sizeMultiplier: 1.8 },
    'Mars': { color: '#E27B58', sizeMultiplier: 1.8 },
    'Jupiter': { color: '#D39C7E', sizeMultiplier: 2.2 },
    'Saturn': { color: '#C5AB6E', sizeMultiplier: 2.2 },
    'Uranus': { color: '#B5E3E3', sizeMultiplier: 2.0 },
    'Neptune': { color: '#6081FF', sizeMultiplier: 2.0 }
};

function getGlowParams(name) {
    return GLOW_PARAMS[name] || { color: '#ffffff', sizeMultiplier: 1.8 };
}

function hexColor(c) { return '#' + c.toString(16).padStart(6, '0'); }
function threeColor(hex) { return new THREE.Color(hex); }

const SOLAR = [
    { name: 'Mercury', m: 35, c: 0xA5A5A5, r: 420, shape: 'circle' },
    { name: 'Venus', m: 45, c: 0xE3BB76, r: 650, shape: 'circle' },
    { name: 'Earth', m: 48, c: 0x2271B3, r: 900, shape: 'circle' },
    { name: 'Mars', m: 40, c: 0xE27B58, r: 1180, shape: 'circle' },
    { name: 'Jupiter', m: 110, c: 0xD39C7E, r: 1550, shape: 'circle' },
    { name: 'Saturn', m: 95, c: 0xC5AB6E, r: 1980, shape: 'circle' },
    { name: 'Uranus', m: 70, c: 0xB5E3E3, r: 2400, shape: 'circle' },
    { name: 'Neptune', m: 68, c: 0x6081FF, r: 2850, shape: 'circle' }
];

const SHAPES = ['circle', 'triangle', 'square', 'trapezoid'];
const PRESET_NAMES = ['Aero', 'Zephyr', 'Nova', 'Calyx', 'Eon', 'Vesper', 'Aura', 'Pax'];

function geoPos(a, r, s) {
    let d = r;
    if (s === 'triangle') {
        const mod = ((a % (Math.PI * 2 / 3)) + Math.PI * 2 / 3) % (Math.PI * 2 / 3);
        const den = Math.cos(mod - Math.PI / 3);
        d = Math.abs(den) > 0.001 ? r * Math.cos(Math.PI / 3) / den : r;
    } else if (s === 'square') {
        d = r / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    } else if (s === 'trapezoid') {
        const sr = Math.max(Math.abs(Math.sin(a)), Math.abs(Math.cos(a)) + 0.3 * Math.sin(a));
        d = r * 0.8 / Math.max(sr, 0.01);
    }
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}
