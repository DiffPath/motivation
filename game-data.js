// --- CHEST CONFIGURATION (12x8 Sprite Sheet) ---
const chestTypes = {
    // Bottom Half (Rows 5-8, index 4 is closed) - Least to slightly rare
    'chest_tier1': { name: 'Tiny Chest', col: 9, row: 4, glow: 'rgba(148, 163, 184, 0.4)' }, // Col 10
    'chest_tier2': { name: 'Wooden Chest', col: 6, row: 4, glow: 'rgba(148, 163, 184, 0.6)' }, // Col 7
    'chest_tier3': { name: 'Reinforced Chest', col: 3, row: 4, glow: 'rgba(16, 185, 129, 0.5)' },  // Col 4
    'chest_tier4': { name: 'Iron Chest', col: 0, row: 4, glow: 'rgba(59, 130, 246, 0.5)' },  // Col 1

    // Top Half (Rows 1-4, index 0 is closed) - Rare to Mythic
    'chest_tier5': { name: 'Ruby Chest', col: 0, row: 0, glow: 'rgba(59, 130, 246, 0.8)' },  // Col 1
    'chest_tier6': { name: 'Golden Chest', col: 3, row: 0, glow: 'rgba(250, 204, 21, 0.6)' },  // Col 4
    'chest_tier7': { name: 'Crystal Chest', col: 6, row: 0, glow: 'rgba(168, 85, 247, 0.8)' },  // Col 7
    'chest_tier8': { name: 'Mythic Chest', col: 9, row: 0, glow: 'rgba(239, 68, 68, 0.9)' }    // Col 10
};

const lootConfig = {
    rarities: [
        { name: 'Common', color: '#94a3b8', glow: 'none', weight: 50, statMin: 1, statMax: 2 },
        { name: 'Uncommon', color: '#10b981', glow: 'none', weight: 25, statMin: 2, statMax: 4 },
        { name: 'Rare', color: '#3b82f6', glow: 'none', weight: 14, statMin: 4, statMax: 5 },
        { name: 'Epic', color: '#a855f7', glow: 'none', weight: 8, statMin: 6, statMax: 7 },
        { name: 'Legendary', color: '#f97316', glow: '0 0 12px rgba(249, 115, 22, 0.7)', weight: 2.5, statMin: 8, statMax: 10 },
        { name: 'Mythic', color: '#ef4444', glow: '0 0 20px rgba(239, 68, 68, 0.9), inset 0 0 10px rgba(239, 68, 68, 0.4)', weight: 0.5, statMin: 12, statMax: 15 }
    ],
    nouns: {
        weapon: ['Sword', 'Dagger', 'Staff', 'Mace'],
        armor: ['Tunic', 'Breastplate', 'Cloak', 'Helm'],
        accessory: ['Ring', 'Amulet', 'Charm', 'Pendant']
    },
    icons: { weapon: '⚔️', armor: '🛡️', accessory: '💍' }
};

const gameAssets = {
    tileset: 'https://i.ibb.co/sBp099k/Tileset.png',
    decorations: 'https://i.ibb.co/ZpzvdZzw/Decorations2.png',
    fogTextured: 'https://i.ibb.co/My9Vh5Nm/Gemini-Generated-Image-867rcf867rcf867r.png',
    chestSprite: 'https://i.ibb.co/Ndx9nCJS/101-1016940-chest-top-down-chest-sprite.png',
    caveEntrance: 'https://i.ibb.co/4w5gLS11/1777166973895-019dc767-1ca2-7e76-9398-95c20789c9dd-Photoroom.png',
    wizardSprite: 'https://i.ibb.co/2YvMR6L7/wizard-Photoroom.png'  // <-- Paste your wizard sprite URL here
};

const getIntroCinematicText = (heroName) => [
    "In ages past, the land was full of light. Creatures thrived, and so did the world around them.",
    "But darkness did not announce itself. It crept in slowly, first in the quiet moments, then everywhere at once.",
    "A shroud fell over the land, and with it came creatures born from shadow, drawn to despair and idleness.",
    "They are patient. They grow stronger the longer we stagnate, go through the motions, and get lost in the fog.",
    "But there are those who choose to push back. To build something. To become something.",
    "Each small act of discipline, each promise kept, each step forward. These are acts of defiance against the dark.",
    "And they do not go unnoticed. Light has a way of finding others who carry it.",
    `Arise, <span style="color:var(--accent-color);">${heroName}</span>, for the light begins with you!`
];

const gameMonsters = {
    // --- STANDARD MONSTERS ---
    'slime': {
        name: 'Slime',
        isBoss: false,
        overworldUrl: 'https://i.ibb.co/FkPvNfgg/Slime-sprite.png',
        glow: 'rgba(34, 197, 94, 0.5)',
        battleImg: 'https://i.ibb.co/wFsrvq8s/1777339939200-019dd1b6-1b0e-7d6d-b357-bb22534136d5.png',
        allowedZones: ['overworld'],
        scale: 2.0,
        hp: 20, str: 3, def: 1,
        spawnWeight: 40
    }, 
    'forest_dweller': {
        name: 'Forest Dweller',
        isBoss: false,
        overworldUrl: 'https://i.imgur.com/pJGcFgm.png',
        glow: 'rgba(34, 197, 94, 0.5)',
        battleImg: 'https://i.imgur.com/2o29aov.jpeg',
        allowedZones: ['overworld'],
        scale: 2.0,
        hp: 20, str: 3, def: 1,
        spawnWeight: 40
    },
    'glowburrow': {
        name: 'Glowburrow',
        isBoss: false,
        overworldUrl: 'https://i.imgur.com/pJGcFgm.png',
        glow: 'rgba(34, 197, 94, 0.5)',
        battleImg: 'https://i.imgur.com/PNUqNiP.jpeg', //https://imgur.com/a/nkeCj4e
        allowedZones: ['overworld'],
        scale: 2.0,
        hp: 20, str: 3, def: 3,
        spawnWeight: 40
    },
    'pebblin': {
        name: 'Pebblin',
        isBoss: false,
        overworldUrl: 'https://i.imgur.com/pJGcFgm.png',
        glow: 'rgba(34, 197, 94, 0.5)',
        battleImg: 'https://i.imgur.com/FxCGSDk.jpeg',  //https://imgur.com/a/nkeCj4e
        allowedZones: ['overworld'],
        scale: 2.0,
        hp: 15, str: 4, def: 2,
        spawnWeight: 40
    },
    'skeleton': {
        name: 'Restless Skeleton',
        isBoss: false,
        overworldUrl: 'https://i.ibb.co/hJS7NdD6/skeleton-sprite.png',
        glow: 'rgba(209, 213, 219, 0.5)',
        battleImg: 'https://i.ibb.co/BHVQxPmc/image.png',
        allowedZones: ['cave'],
        scale: 2.0,
        hp: 40, str: 6, def: 1,
        spawnWeight: 35
    },
    'cave_goblin': {
        name: 'Cave Goblin',
        isBoss: false,
        overworldUrl: 'https://i.imgur.com/pJGcFgm.png',
        glow: 'rgba(16, 185, 129, 0.5)',
        battleImg: 'https://i.imgur.com/XR3veyB.jpeg',
        allowedZones: ['cave'],
        scale: 2.0,
        hp: 60, str: 3, def: 8,
        spawnWeight: 20
    },
    'phantom': {
        name: 'Dark Phantom',
        isBoss: false,
        overworldUrl: 'https://i.ibb.co/QvMqCNTn/image-Photoroom-2.png',
        glow: 'rgba(115, 115, 115, 0.5)',
        battleImg: 'https://i.ibb.co/K43pXMC/image.png',
        allowedZones: ['overworld'],
        scale: 2.0,
        hp: 80, str: 10, def: 6,
        spawnWeight: 15 // Rarer spawn
    },
    'vampire_bat': {
        name: 'Vampire Bat',
        isBoss: false,
        overworldUrl: 'https://i.ibb.co/G3PYVr6f/image-Photoroom-1.png',
        glow: 'rgba(168, 85, 247, 0.5)',
        battleImg: 'https://i.ibb.co/zTMNhZRr/image.png',
        allowedZones: ['cave'],
        scale: 1.5,
        hp: 20, str: 4, def: 4,
        spawnWeight: 20
    },

    // --- BOSSES ---
    'boss_dragon': {
        name: 'Abyssal Dragon',
        isBoss: true,
        overworldUrl: 'URL_TO_DRAGON_SPRITE.png',
        glow: 'rgba(220, 38, 38, 0.8)',
        battleImg: 'https://placehold.co/160x160/0f172a/3b82f6?text=Dragon',
        scale: 2.0,
        hp: 250, str: 18, def: 12,
        spawnWeight: 0 // Set to 0 so it never spawns as a random random mob
    },
    'boss_doom_scroller': {
        name: 'The Doom Scroller',
        isBoss: true,
        overworldUrl: 'URL_TO_DOOM_SCROLLER_SPRITE.png',
        glow: 'rgba(99, 102, 241, 0.8)',
        battleImg: 'https://placehold.co/160x160/1e1b4b/6366f1?text=Doom+Scroller',
        allowedZones: ['overworld', 'cave'],
        scale: 1.5,
        hp: 100, str: 8, def: 5,
        spawnWeight: 0 // Boss — never random-spawned
    },
    'boss_squirrel': {
        name: 'The Great Squirrel of Distraction',
        isBoss: true,
        overworldUrl: 'URL_TO_SQUIRREL_SPRITE.png',
        glow: 'rgba(252, 211, 77, 0.8)',
        battleImg: 'https://placehold.co/160x160/78350f/fcd34d?text=Squirrel',
        scale: 1.5,
        hp: 120, str: 10, def: 6,
        spawnWeight: 0
    },
    'boss_knight': {
        name: 'Shadow Knight',
        isBoss: true,
        overworldUrl: 'URL_TO_KNIGHT_SPRITE.png',
        glow: 'rgba(0, 0, 0, 0.8)',
        allowedZones: ['cave'],
        battleImg: 'https://placehold.co/160x160/000000/dc2626?text=Knight',
        scale: 1.2,
        hp: 150, str: 12, def: 10,
        spawnWeight: 0
    }
};

const heroClasses = {
    "Black Cat": {
        name: "Black Cat",
        portraitSheet: "https://i.ibb.co/qY3k1CMr/cat-profile-sheet2.png",
        emoji: "🐈‍⬛",
        stats: { str: 5, def: 4, vit: 3, int: 8, end: 7 },
        sprites: {
            up: "https://i.ibb.co/0yDYF2FK/sprite-max-px-36-away2.png",
            down: "https://i.ibb.co/B2f11Dj0/sprite-max-px-36-towards.png",
            left: "https://i.ibb.co/HLQK8RZQ/sprite-max-px-36.png"
        }
    },
    "Rock Hyrax": {
        name: "Rock Hyrax",
        portraitSheet: "https://i.ibb.co/5gJ03k3m/1777180021506-019dc82e-5b6c-7219-9906-289ed08390ae.png",
        emoji: "🪨",
        stats: { str: 6, def: 8, vit: 7, int: 3, end: 6 },
        sprites: { up: "URL_HYRAX_UP.png", down: "URL_HYRAX_DOWN.png", left: "URL_HYRAX_LEFT.png" }
    },
    "Earthworm": {
        name: "Earthworm",
        portraitSheet: "https://i.ibb.co/mrDDK0P5/gpt-image-2-medium-b-Generate-a-10-image.png",
        emoji: "🪱",
        stats: { str: 2, def: 4, vit: 9, int: 2, end: 10 },
        sprites: { up: "URL_WORM_UP.png", down: "URL_WORM_DOWN.png", left: "URL_WORM_LEFT.png" }
    },
    "Gray Wolf": {
        name: "Gray Wolf",
        portraitSheet: "https://i.ibb.co/Fbp9wD4F/1777180211455-019dc831-3e8c-78f8-9132-1a495d50df9b.png",
        emoji: "🐺",
        stats: { str: 8, def: 4, vit: 4, int: 4, end: 7 },
        sprites: { up: "https://i.ibb.co/1J4gKtdD/wolf-Photoroom.png", down: "https://i.ibb.co/jZLrkzdW/sprite-max-px-36-2.png", left: "https://i.ibb.co/zhv1y0mW/sprite-max-px-36-1.png" }
    },
    "Frog": {
        name: "Frog",
        portraitSheet: "https://i.ibb.co/G371cJYM/1777180515761-019dc835-db2d-73c5-9122-2bb3758e2721-1.png",
        emoji: "🐸",
        stats: { str: 5, def: 4, vit: 5, int: 6, end: 6 },
        sprites: { up: "URL_FROG_UP.png", down: "URL_FROG_DOWN.png", left: "URL_FROG_LEFT.png" }
    }
};

const gameDecorations = {
    'large_tree': {
        startX: 11, startY: 143, endX: 80, endY: 240, // Replace with your exact numbers
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 20, 
        isFlat: false,
        spawnNearTerrain: [],
        spawnNearDecor: [] 
    },
    'small_tree': {
        startX: 161, startY: 161, endX: 200, endY: 236, // Replace with your exact numbers
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 20,
        isFlat: false, // FREQUENCY: Higher number = more common relative to others
        spawnNearTerrain: [], // Leave empty if it can spawn anywhere
        spawnNearDecor: [] 
    },
    'mushroom_1': {
        startX: 170, startY: 42, endX: 182, endY: 53,
        terrain: ['grass'],
        allowedZones: ['overworld','cave'],
        scale: 2.0,
        weight: 10,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: ['log_grass']
    },
    'mushroom_2': {
        startX: 204, startY: 40, endX: 216, endY: 52,
        terrain: ['grass'],
        allowedZones: ['overworld','cave'],
        scale: 2.0,
        weight: 10,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: ['log_grass']
    },
    'mushroom_3': {
        startX: 235, startY: 41, endX: 246, endY: 54,
        terrain: ['grass'],
        allowedZones: ['overworld','cave'],
        scale: 2.0,
        weight: 10,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: ['log_grass']
    },
    'log_grass': {
        startX: 75, startY: 0, endX: 115, endY: 32,
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 5,
        isFlat: false,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'large_rock_grass': {
        startX: 163, startY: 133, endX: 189, endY: 155,
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 5,
        isFlat: false,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'large_rock_dirt': {
        startX: 194, startY: 133, endX: 221, endY: 156,
        terrain: ['dirt'],
        allowedZones: ['overworld','cave'],
        scale: 2.0,
        weight: 1,
        isFlat: false,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'medium_rock_grass': {
        startX: 163, startY: 133, endX: 189, endY: 155,
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 5,        
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'medium_rock_dirt': {
        startX: 200, startY: 109, endX: 216, endY: 121,
        terrain: ['dirt'],
        allowedZones: ['overworld','cave'],
        scale: 2.0,
        weight: 2,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'small_rock': {
        startX: 138, startY: 110, endX: 150, endY: 120,
        terrain: ['dirt'],
        allowedZones: ['overworld','cave'],
        scale: 2.0,
        weight: 2,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'fern': {
        startX: 135, startY: 8, endX: 152, endY: 23,
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 60,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: [] // Strictly grows near trees
    },
    'bush': {
        startX: 12, startY: 3, endX: 48, endY: 31,
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 2.0,
        weight: 20,
        isFlat: false,
        spawnNearTerrain: [],
        spawnNearDecor: ['large_tree'] // Strictly grows near trees
    },
    'cave_entrance': {
        startX: 255, startY: 2, endX: 376, endY: 96,
        terrain: ['grass'],
        allowedZones: ['overworld'],
        scale: 1.5,
        weight: 0,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: []
    },
    'cave_exit': {
        startX: 255, startY: 2, endX: 376, endY: 96,
        terrain: ['grass'],
        allowedZones: ['cave'],
        scale: 1.5,
        weight: 0,
        isFlat: true,
        spawnNearTerrain: [],
        spawnNearDecor: []
    }
};

const tileDictionary = {
    // --- ROW 0 ---
    0: { col: 0, row: 0 }, // 0: Top left corner light green grass transition...
    1: { col: 1, row: 0 }, // 1: Top middle light green grass transition...
    2: { col: 2, row: 0 }, // 2: Top right corner light green grass transition...
    3: { col: 3, row: 0 }, // 3: Bottom right corner light green grass transition mostly grass...
    4: { col: 4, row: 0 }, // 4: Bottom left corner light green grass transition mostly grass...
    5: { col: 5, row: 0 }, // 5: All light green grass with small plant/weed
    6: { col: 6, row: 0 }, // 6: All dirt, plain
    7: { col: 7, row: 0 }, // 7: All dirt with small amount of rocks

    // --- ROW 1 ---
    8: { col: 0, row: 1 }, // 8:
    9: { col: 1, row: 1 }, // 9:
    10: { col: 2, row: 1 }, // 10:
    11: { col: 3, row: 1 }, // 11:
    12: { col: 4, row: 1 }, // 12:
    13: { col: 5, row: 1 }, // 13:
    14: { col: 6, row: 1 }, // 14:
    15: { col: 7, row: 1 }, // 15:

    // --- ROW 2 ---
    16: { col: 0, row: 2 }, // 16:
    17: { col: 1, row: 2 }, // 17:
    18: { col: 2, row: 2 }, // 18:
    19: { col: 3, row: 2 }, // 19:
    20: { col: 4, row: 2 }, // 20:
    21: { col: 5, row: 2 }, // 21:
    22: { col: 6, row: 2 }, // 22:
    23: { col: 7, row: 2 }, // 23:

    // --- ROW 3 ---
    24: { col: 0, row: 3 }, // 24:
    25: { col: 1, row: 3 }, // 25:
    26: { col: 2, row: 3 }, // 26:
    27: { col: 3, row: 3 }, // 27:
    28: { col: 4, row: 3 }, // 28:
    29: { col: 5, row: 3 }, // 29:
    30: { col: 6, row: 3 }, // 30:
    31: { col: 7, row: 3 }, // 31:

    // --- ROW 4 ---
    32: { col: 0, row: 4 }, // 32:
    33: { col: 1, row: 4 }, // 33:
    34: { col: 2, row: 4 }, // 34:
    35: { col: 3, row: 4 }, // 35:
    36: { col: 4, row: 4 }, // 36:
    37: { col: 5, row: 4 }, // 37:
    38: { col: 6, row: 4 }, // 38:
    39: { col: 7, row: 4 }, // 39:

    // --- ROW 5 ---
    40: { col: 0, row: 5 }, // 40:
    41: { col: 1, row: 5 }, // 41:
    42: { col: 2, row: 5 }, // 42:
    43: { col: 3, row: 5 }, // 43:
    44: { col: 4, row: 5 }, // 44:
    45: { col: 5, row: 5 }, // 45:
    46: { col: 6, row: 5 }, // 46:
    47: { col: 7, row: 5 }, // 47:

    // --- ROW 6 ---
    48: { col: 0, row: 6 }, // 48:
    49: { col: 1, row: 6 }, // 49:
    50: { col: 2, row: 6 }, // 50:
    51: { col: 3, row: 6 }, // 51:
    52: { col: 4, row: 6 }, // 52:
    53: { col: 5, row: 6 }, // 53:
    54: { col: 6, row: 6 }, // 54:
    55: { col: 7, row: 6 }, // 55:

    // --- ROW 7 ---
    56: { col: 0, row: 7 }, // 56:
    57: { col: 1, row: 7 }, // 57:
    58: { col: 2, row: 7 }, // 58:
    59: { col: 3, row: 7 }, // 59:
    60: { col: 4, row: 7 }, // 60:
    61: { col: 5, row: 7 }, // 61:
    62: { col: 6, row: 7 }, // 62:
    63: { col: 7, row: 7 }, // 63:

    // --- ROW 8 ---
    64: { col: 0, row: 8 }, // 64:
    65: { col: 1, row: 8 }, // 65:
    66: { col: 2, row: 8 }, // 66:
    67: { col: 3, row: 8 }, // 67:
    68: { col: 4, row: 8 }, // 68:
    69: { col: 5, row: 8 }, // 69:
    70: { col: 6, row: 8 }, // 70:
    71: { col: 7, row: 8 }, // 71:

    // --- ROW 9 ---
    72: { col: 0, row: 9 }, // 72:
    73: { col: 1, row: 9 }, // 73:
    74: { col: 2, row: 9 }, // 74:
    75: { col: 3, row: 9 }, // 75:
    76: { col: 4, row: 9 }, // 76:
    77: { col: 5, row: 9 }, // 77:
    78: { col: 6, row: 9 }, // 78:
    79: { col: 7, row: 9 }, // 79:

    // --- ROW 10 ---
    80: { col: 0, row: 10 }, // 80:
    81: { col: 1, row: 10 }, // 81:
    82: { col: 2, row: 10 }, // 82:
    83: { col: 3, row: 10 }, // 83:
    84: { col: 4, row: 10 }, // 84:
    85: { col: 5, row: 10 }, // 85:
    86: { col: 6, row: 10 }, // 86:
    87: { col: 7, row: 10 }, // 87:

    // --- ROW 11 ---
    88: { col: 0, row: 11 }, // 88:
    89: { col: 1, row: 11 }, // 89:
    90: { col: 2, row: 11 }, // 90:
    91: { col: 3, row: 11 }, // 91:
    92: { col: 4, row: 11 }, // 92:
    93: { col: 5, row: 11 }, // 93:
    94: { col: 6, row: 11 }, // 94:
    95: { col: 7, row: 11 }, // 95:

    // --- ROW 12 ---
    96: { col: 0, row: 12 }, // 96:
    97: { col: 1, row: 12 }, // 97:
    98: { col: 2, row: 12 }, // 98:
    99: { col: 3, row: 12 }, // 99:
    100: { col: 4, row: 12 }, // 100:
    101: { col: 5, row: 12 }, // 101:
    102: { col: 6, row: 12 }, // 102:
    103: { col: 7, row: 12 }, // 103:

    // --- ROW 13 ---
    104: { col: 0, row: 13 }, // 104:
    105: { col: 1, row: 13 }, // 105:
    106: { col: 2, row: 13 }, // 106:
    107: { col: 3, row: 13 }, // 107:
    108: { col: 4, row: 13 }, // 108:
    109: { col: 5, row: 13 }, // 109:
    110: { col: 6, row: 13 }, // 110:
    111: { col: 7, row: 13 }, // 111:

    // --- ROW 14 ---
    112: { col: 0, row: 14 }, // 112:
    113: { col: 1, row: 14 }, // 113:
    114: { col: 2, row: 14 }, // 114:
    115: { col: 3, row: 14 }, // 115:
    116: { col: 4, row: 14 }, // 116:
    117: { col: 5, row: 14 }, // 117:
    118: { col: 6, row: 14 }, // 118:
    119: { col: 7, row: 14 }  // 119:
};

// =============================================================================
// --- QUEST ITEM SYSTEM ---
// =============================================================================
const questItems = {
    scroll: {
        id: 'scroll',
        name: 'The Ancient Scroll',
        icon: '📜',
        color: '#fcd34d',
        glow: '0 0 20px rgba(252, 211, 77, 0.8)',
        description: 'A tattered parchment whose edges crumble at your touch. The ink is old — older than it should be. Five fragments of something once whole, scattered when the fog descended. Find them. Unite them. The realm will show you the rest.',
        hints: [
            '🔵 At the very edge of the world, where the land gives way to nothing, something waits in iron. Walk until you cannot walk further.',
            '🟢 Darkness is not empty. Those who descend and do not turn back will find what the light abandoned. Seek the furthest point.',
            '🔴 The depths are not forgiving. Another shadow, another descent — but the patient are rewarded with what the earth buried long ago.',
            '🟡 Something restless and ancient claims the open land as its own. It scatters and distracts, but it cannot hold what was never truly its.',
            '🟣 A wanderer moves through this realm unseen by those who are not looking. They have been waiting. They will know you when they see you.'
        ]
    },
    crystal_focus: {
        id: 'crystal_focus',
        name: 'Crystal of Focus',
        icon: '🔵',
        color: '#38bdf8',
        glow: '0 0 20px rgba(56, 189, 248, 0.9), 0 0 40px rgba(56, 189, 248, 0.4)',
        description: 'A cool blue crystal that hums with a quiet, clarifying resonance. It feels like a clear mind on a crisp morning.'
    },
    crystal_perseverance: {
        id: 'crystal_perseverance',
        name: 'Crystal of Perseverance',
        icon: '🟢',
        color: '#10b981',
        glow: '0 0 20px rgba(16, 185, 129, 0.9), 0 0 40px rgba(16, 185, 129, 0.4)',
        description: 'A steady green crystal that pulses with a slow, relentless rhythm. It radiates the power of showing up every single day.'
    },
    crystal_vitality: {
        id: 'crystal_vitality',
        name: 'Crystal of Vitality',
        icon: '🔴',
        color: '#ef4444',
        glow: '0 0 20px rgba(239, 68, 68, 0.9), 0 0 40px rgba(239, 68, 68, 0.4)',
        description: 'A warm red crystal that throbs with life energy. It feels like the burn of a hard workout — painful, yet exhilarating.'
    },
    crystal_courage: {
        id: 'crystal_courage',
        name: 'Crystal of Courage',
        icon: '🟡',
        color: '#fcd34d',
        glow: '0 0 20px rgba(252, 211, 77, 0.9), 0 0 40px rgba(252, 211, 77, 0.4)',
        description: 'A blazing yellow crystal seized from the Great Squirrel of Distraction. Its warmth fortifies the will against all temptation.'
    },
    crystal_wisdom: {
        id: 'crystal_wisdom',
        name: 'Crystal of Wisdom',
        icon: '🟣',
        color: '#a855f7',
        glow: '0 0 20px rgba(168, 85, 247, 0.9), 0 0 40px rgba(168, 85, 247, 0.4)',
        description: 'A deep violet crystal bestowed by the Mysterious Wizard of Motivation. It holds the accumulated knowledge of ten thousand self-improvement journeys.'
    }
};

// The 5 crystal IDs required to form the shrine
const SHRINE_CRYSTALS = ['crystal_focus', 'crystal_perseverance', 'crystal_vitality', 'crystal_courage', 'crystal_wisdom'];

// --- LOGIC GATES: Maps a 0-15 bitmask to your specific tile IDs ---
// N=1, E=2, S=4, W=8
const tileLogicMap = {
    'grass': {
        0: 9,   // No neighbors -> Center grass
        1: 17,  // North only -> Bottom middle
        2: 8,   // East only -> Left middle
        3: 16,  // North & East -> Bottom left corner
        4: 1,   // South only -> Top middle
        5: 9,   // North & South -> Vertical (Fallback to center)
        6: 0,   // South & East -> Top left corner
        7: 8,   // N, E, S -> Left edge
        8: 10,  // West only -> Right middle
        9: 18,  // North & West -> Bottom right corner
        10: 9,  // East & West -> Horizontal (Fallback to center)
        11: 17, // N, E, W -> Bottom edge
        12: 2,  // South & West -> Top right corner
        13: 10, // N, S, W -> Right edge
        14: 1,  // E, S, W -> Top edge
        15: 9   // All neighbors -> Center solid grass
    },
    'dirt': {
        0: 33,  // (9 + 24)  No neighbors
        1: 41,  // (17 + 24) North only
        2: 32,  // (8 + 24)  East only
        3: 40,  // (16 + 24) North & East
        4: 25,  // (1 + 24)  South only
        5: 33,  // (9 + 24)  North & South
        6: 24,  // (0 + 24)  South & East
        7: 32,  // (8 + 24)  N, E, S
        8: 34,  // (10 + 24) West only
        9: 42,  // (18 + 24) North & West
        10: 33, // (9 + 24)  East & West
        11: 41, // (17 + 24) N, E, W
        12: 26, // (2 + 24)  South & West
        13: 34, // (10 + 24) N, S, W
        14: 25, // (1 + 24)  E, S, W
        15: 33  // (9 + 24)  All neighbors
    }
};
