// =============================================================================
// IMAGE-CACHE.JS
// Fast image pre-loading and caching utilities.
// Depends on: game-data.js  (heroClasses, gameAssets, gameMonsters)
// =============================================================================

// --- FAST IMAGE CACHING SYSTEM ---
const imageCache = {};

function getEnvironmentSprite() {
    if (!imageCache['environment']) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = gameAssets.tileset;
        imageCache['environment'] = img;
    }
    return imageCache['environment'];
}

function getHeroSprite(className, direction) {
    // SAFEGUARD: If the class doesn't exist, default to Black Cat
    if (!heroClasses[className]) {
        className = "Black Cat";
    }

    // SAFEGUARD: If the direction is missing, default to down
    if (!heroClasses[className].sprites[direction]) {
        direction = "down";
    }

    const key = `${className}_${direction}`;
    if (!imageCache[key]) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = heroClasses[className].sprites[direction];
        imageCache[key] = img;
    }
    return imageCache[key];
}

function getDecorationSprite() {
    if (!imageCache['decorations']) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = gameAssets.decorations;
        imageCache['decorations'] = img;
    }
    return imageCache['decorations'];
}

function getMonsterSprite(monsterKey) {
    if (!imageCache[monsterKey]) {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        // Ensure the monster exists in your dictionary before assigning the URL
        if (typeof gameMonsters !== 'undefined' && gameMonsters[monsterKey]) {
            img.src = gameMonsters[monsterKey].overworldUrl;
        }
        imageCache[monsterKey] = img;
    }
    return imageCache[monsterKey];
}

function getChestSheet() {
    if (!imageCache['chestSheet']) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = gameAssets.chestSprite; // This grabs the URL from your gameAssets dictionary!
        imageCache['chestSheet'] = img;
    }
    return imageCache['chestSheet'];
}

function getCaveSprite() {
    if (!imageCache['cave']) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        // Grab the URL from your existing gameAssets dictionary
        if (typeof gameAssets !== 'undefined' && gameAssets.caveEntrance) {
            img.src = gameAssets.caveEntrance;
        }
        imageCache['cave'] = img;
    }
    return imageCache['cave'];
}

function getWizardSprite() {
    if (!imageCache['wizard']) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        if (typeof gameAssets !== 'undefined' && gameAssets.wizardSprite && gameAssets.wizardSprite !== 'YOUR_WIZARD_SPRITE_URL_HERE') {
            img.src = gameAssets.wizardSprite;
        }
        imageCache['wizard'] = img;
    }
    return imageCache['wizard'];
}

function getPortraitFrameIndex(level) {
    // Each level band of 5 advances one frame (0-indexed, capped at 9)
    const spriteIndex = Math.max(0, Math.min(Math.floor((level - 1) / 5), 9));
    return {
        col: spriteIndex % 5,
        row: Math.floor(spriteIndex / 5)
    };
}

function updatePortraitUI(elementId, className, level = 1) {
    const el = document.getElementById(elementId);
    const charData = heroClasses[className];
    if (!el || !charData) return;

    const { col, row } = getPortraitFrameIndex(level);

    // Clear previous state
    el.innerHTML = '';
    el.style.overflow = 'hidden';
    el.style.position = 'relative';

    const img = document.createElement('img');
    img.src = charData.portraitSheet;
    img.crossOrigin = 'anonymous';
    img.draggable = false;

    // --- Pure percentage layout — resize-proof, no JS measurement needed ---
    // The sprite sheet is a 5-column × 2-row grid.
    // Setting the image to 500% × 200% of the container means each cell exactly
    // fills the container. Percentage left/top then select the right cell.
    //
    // Why this works on resize:
    //   - Container width changes → image 500% width recomputes automatically.
    //   - Container height changes (via aspect-ratio) → image 200% height and
    //     the -row*100% top offset both recompute together. No stale pixels.
    img.style.position = 'absolute';
    img.style.width    = '500%';            // 5 cols → each col = 100% container width
    img.style.height   = '200%';            // 2 rows → each row = 100% container height
    img.style.left     = `${-col * 100}%`; // col N → shift left by N container widths
    img.style.top      = `${-row * 100}%`; // row N → shift up  by N container heights
    img.style.maxWidth  = 'none';
    img.style.maxHeight = 'none';

    // Lock the container's aspect ratio to exactly one cell.
    // After this fires once, all further resizing is handled by CSS with no JS.
    const lockAspect = () => {
        const { naturalWidth, naturalHeight } = img;
        if (!naturalWidth || !naturalHeight) return;
        // cellW = naturalWidth/5,  cellH = naturalHeight/2
        el.style.aspectRatio = `${naturalWidth / 5} / ${naturalHeight / 2}`;
    };

    if (img.complete && img.naturalHeight > 0) {
        lockAspect();
    } else {
        img.addEventListener('load', lockAspect, { once: true });
    }

    el.appendChild(img);
}
