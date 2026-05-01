// =============================================================================
// ENGINE.JS
// ENGINE configuration constants + AdventureEngine class.
// Depends on: game-data.js, image-cache.js
// =============================================================================

// --- ENGINE CONFIGURATION ---
const ENGINE = {
    FPS: 60,
    TILE_SIZE: 40,
    MAP_WIDTH: 151,
    MAP_HEIGHT: 151
};

let inEncounter = false;

// --- PENDING STAT ALLOCATION (draft mode — not saved until confirmed) ---
let pendingStatAllocations = { str: 0, def: 0, vit: 0, int: 0, end: 0 };
let pendingPointsUsed = 0;


class AdventureEngine {
    constructor(canvasId, heroClass, saveData = null) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.mapCanvas = document.createElement('canvas');
        this.mapCtx = this.mapCanvas.getContext('2d');
        this.lastTime = performance.now();
        this.animationFrameId = null;
        this.terrainMap = new Uint8Array(ENGINE.MAP_WIDTH * ENGINE.MAP_HEIGHT);
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;

        // --- MAP DRAG STATE ---
        this.cameraOffset = { x: 0, y: 0 };   // Pixel offset from player-center
        this._drag = {
            active: false,
            startX: 0, startY: 0,
            lastOffX: 0, lastOffY: 0
        };

        // --- UPDATED PLAYER STATE ---
        this.player = {
            x: 75 * ENGINE.TILE_SIZE,
            y: 75 * ENGINE.TILE_SIZE,
            speed: 80,
            width: ENGINE.TILE_SIZE,
            height: ENGINE.TILE_SIZE,
            direction: 'down',
            frame: 0,
            frameTimer: 0
        };
        this.heroClass = heroClass || 'Black Cat';
        this.keys = {
            w: false, a: false, s: false, d: false,
            arrowup: false, arrowdown: false, arrowleft: false, arrowright: false
        };
        this.zoom = 1;

        // --- LOAD SAVED POSITION ---
        // 1. Check Cloud Save
        let startX, startY;
        if (saveData && saveData.x && saveData.y) {
            startX = saveData.x;
            startY = saveData.y;
        }

        // 2. Override with Fast-Cache (prevents refresh teleportation)
        let localData = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
        if (localData.adventure_state && localData.adventure_state.last_x) {
            startX = localData.adventure_state.last_x;
            startY = localData.adventure_state.last_y;
        }

        // 3. Brand-new player — randomize spawn within the inner half of the map radius
        //    (MAP radius = 73 tiles from center 75,75; we pick a random point within radius 25)
        if (!startX || !startY) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 25; // 0–25 tiles from center
            const tileX = Math.round(75 + Math.cos(angle) * r);
            const tileY = Math.round(75 + Math.sin(angle) * r);
            startX = tileX * ENGINE.TILE_SIZE;
            startY = tileY * ENGINE.TILE_SIZE;
        }

        this.player = {
            x: startX,
            y: startY,
            speed: 80,
            width: ENGINE.TILE_SIZE,
            height: ENGINE.TILE_SIZE,
            direction: 'down',
            frame: 0,
            frameTimer: 0
        };

        // Store the initial spawn location so death can return the player here
        this.spawnLocation = { x: startX, y: startY };

        // --- ENERGY SYSTEM ---
        this.currentEnergy = null; // Loaded lazily from save
        this.maxEnergy = 45;       // Recalculated when save is read
        this.isExhausted = false;
        this.energySaveTimer = 0;
        this.exhaustionNotified = false;
        this.hudUpdateTimer = 0;

        this.exploredTiles = new Set(saveData && saveData.explored ? saveData.explored : []);

        // --- MONSTER LUNGE / AUTO-ENCOUNTER ---
        this.monsterLungeAnimations = {}; // key → { time, dirX, dirY }
        this.monsterLungeSeen = new Set(); // prevents re-triggering the same monster

        // --- SPAWN IMMUNITY ---
        // Prevents an encounter from firing the moment the player loads in / changes maps.
        // Counts down every frame; entity collision is suppressed until it reaches 0.
        this.spawnImmunityTimer = 2.5; // seconds

        this.sharedFogTracker = new Set();
        this.multiplayerSyncTimer = 0;

        // --- PERSONAL SCROLL ENCOUNTER FLAG ---
        // Prevents the personal scroll encounter from re-triggering every frame.
        // Reset to false if the player dismisses without collecting.
        this.personalScrollEncounterSeen = false;

        // --- FOG OF WAR SETUP ---
        this.visionRadius = ENGINE.TILE_SIZE * 2; // How far the player can see

        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = ENGINE.MAP_WIDTH * ENGINE.TILE_SIZE;
        this.fogCanvas.height = ENGINE.MAP_HEIGHT * ENGINE.TILE_SIZE;
        this.fogCtx = this.fogCanvas.getContext('2d');

        // Fill the entire map with a dark overlay
        this.fogCtx.fillStyle = 'rgba(0, 0, 0, 0.95)'; // 0.95 leaves a tiny bit of visibility
        this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
        this.restoreFog();
        this.init();
    }

    // Add this right below the this.exploredTiles Set in the constructor:
    // this.saveTimeout = null;

    triggerSave() {
        // Clear the existing timer if they are still moving/exploring
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Set a new timer to fire after 2 seconds of inactivity
        this.saveTimeout = setTimeout(() => {
            this.saveToFirebase();
        }, 2000);
    }

    async saveToFirebase() {
        // Convert Set back to a standard Array for JSON/Firebase storage
        const payload = {
            x: Math.round(this.player.x),
            y: Math.round(this.player.y),
            explored: Array.from(this.exploredTiles)
        };

        try {
            // Grab the hero name from localStorage to know exactly where to save
            let localData = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
            let heroName = localData.hero_name;

            // Use your existing Firebase v8 Realtime Database structure!
            if (heroName && typeof db !== 'undefined') {
                await db.ref('heroes/' + heroName.toLowerCase() + '/engineData').update(payload);
                console.log("Game state successfully saved to Firebase!");
            }
        } catch (error) {
            console.error("Error saving to Firebase:", error);
        }
    }

    setHero(heroClass) {
        this.heroClass = heroClass;
    }

    setZoom(scale) {
        this.zoom = scale;
    }

    getTile(x, y) {
        // If outside map boundaries, treat it as Void (0)
        if (x < 0 || x >= ENGINE.MAP_WIDTH || y < 0 || y >= ENGINE.MAP_HEIGHT) return 0;
        return this.terrainMap[this.getIndex(x, y)];
    }

    getBitmask(x, y, matchType) {
        let mask = 0;

        const checkTile = (nx, ny) => {
            let tile = this.getTile(nx, ny);
            // If we are calculating Grass (1), pretend the Void (0) is also Grass!
            // This forces the grass to draw a solid block right up to the cliff.
            if (matchType === 1 && tile === 0) return true;
            return tile === matchType;
        };

        if (checkTile(x, y - 1)) mask += 1; // North
        if (checkTile(x + 1, y)) mask += 2; // East
        if (checkTile(x, y + 1)) mask += 4; // South
        if (checkTile(x - 1, y)) mask += 8; // West
        return mask;
    }

    loadMapData(firebaseMapTerrain, mapId) { // Added mapId here
        this.currentMapId = mapId; // <--- ADD THIS LINE
        // 1. Fill the array with the base environment (Grass and Void)
        for (let y = 0; y < ENGINE.MAP_HEIGHT; y++) {
            for (let x = 0; x < ENGINE.MAP_WIDTH; x++) {
                let idx = this.getIndex(x, y);

                // Use the mapId passed into the function instead of the global variable
                if (mapId === 'overworld') {
                    let dx = x - 75;
                    let dy = y - 75;
                    if ((dx * dx + dy * dy) <= (73 * 73)) {
                        this.terrainMap[idx] = 1; // Grass
                    } else {
                        this.terrainMap[idx] = 0; // Void
                    }
                } else {
                    this.terrainMap[idx] = 0; // Cave default
                }
            }
        }

        // 2. Loop through the Firebase dictionary ONCE to carve the dirt paths
        for (let key in firebaseMapTerrain) {
            let parts = key.split(',');
            let x = parseInt(parts[0]);
            let y = parseInt(parts[1]);

            // Ensure coordinates are within bounds
            if (x >= 0 && x < ENGINE.MAP_WIDTH && y >= 0 && y < ENGINE.MAP_HEIGHT) {
                let tileData = firebaseMapTerrain[key];
                let idx = this.getIndex(x, y);

                if (tileData.type === 'dirt') {
                    this.terrainMap[idx] = 2; // 2 = Dirt
                }
            }
        }

        // 3. Data is loaded! Now paint the massive off-screen canvas ONCE
        this.preRenderMap();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupInputs();
        this.loop(performance.now());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupInputs() {
        window.addEventListener('keydown', (e) => {
            if (inEncounter) return; // <-- NEW: Block keys while panels are open

            // Ignore keystrokes if the user is typing in an input field or textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const k = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(k)) this.keys[k] = true;
        });

        window.addEventListener('keyup', (e) => {
            // Ignore keystrokes if the user is typing in an input field or textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const k = e.key.toLowerCase();
            if (this.keys.hasOwnProperty(k)) {
                this.keys[k] = false;
                this.triggerSave();
            }
        });

        // --- MAP DRAG (mouse) ---
        this.canvas.addEventListener('mousedown', (e) => {
            this._drag.active = true;
            this._drag.startX = e.clientX;
            this._drag.startY = e.clientY;
            this._drag.lastOffX = this.cameraOffset.x;
            this._drag.lastOffY = this.cameraOffset.y;
            this.canvas.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', (e) => {
            if (!this._drag.active) return;
            // Dragging right → camera moves right → world appears to shift left → offset is negative
            this.cameraOffset.x = this._drag.lastOffX - (e.clientX - this._drag.startX) / this.zoom;
            this.cameraOffset.y = this._drag.lastOffY - (e.clientY - this._drag.startY) / this.zoom;
        });
        window.addEventListener('mouseup', () => {
            this._drag.active = false;
            this.canvas.style.cursor = '';
        });

        // --- MAP DRAG (touch) ---
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            this._drag.active = true;
            this._drag.startX = t.clientX;
            this._drag.startY = t.clientY;
            this._drag.lastOffX = this.cameraOffset.x;
            this._drag.lastOffY = this.cameraOffset.y;
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (!this._drag.active || e.touches.length !== 1) return;
            const t = e.touches[0];
            this.cameraOffset.x = this._drag.lastOffX - (t.clientX - this._drag.startX) / this.zoom;
            this.cameraOffset.y = this._drag.lastOffY - (t.clientY - this._drag.startY) / this.zoom;
        }, { passive: true });
        window.addEventListener('touchend', () => {
            this._drag.active = false;
        });
    }

    // Convert x,y to 1D array index
    getIndex(x, y) {
        return y * ENGINE.MAP_WIDTH + x;
    }


    preRenderMap() {
        this.mapCanvas.width = ENGINE.MAP_WIDTH * ENGINE.TILE_SIZE;
        this.mapCanvas.height = ENGINE.MAP_HEIGHT * ENGINE.TILE_SIZE;

        const envSprite = getEnvironmentSprite();

        // Failsafe: If the image isn't downloaded yet, wait 50ms and try again
        if (!envSprite.complete || envSprite.naturalWidth === 0) {
            setTimeout(() => this.preRenderMap(), 50);
            return;
        }

        const frameW = 16;
        const frameH = 16;
        const drawOverlap = 0.5; // Prevents micro-gaps between tiles

        // Fill void base
        this.mapCtx.fillStyle = '#0f172a';
        this.mapCtx.fillRect(0, 0, this.mapCanvas.width, this.mapCanvas.height);
        this.mapCtx.imageSmoothingEnabled = false;

        // --- PASS 1: BASE TERRAIN & GRASS OVERLAYS ---
        for (let y = 0; y < ENGINE.MAP_HEIGHT; y++) {
            for (let x = 0; x < ENGINE.MAP_WIDTH; x++) {
                const tileType = this.getTile(x, y);
                if (tileType === 0) continue; // Skip Void

                let hash = ((x * 374761393) ^ (y * 668265263)) % 100;
                if (hash < 0) hash = -hash;

                // 1. Draw Base (Dirt everywhere to prevent holes under grass edges)
                let baseId = 6;
                if (tileType === 2) { // Dirt
                    if (hash < 10) baseId = 7;
                    else if (hash < 20) baseId = 14;
                    else if (hash < 30) baseId = 15;
                    else if (hash < 40) baseId = 22;
                    else if (hash < 50) baseId = 23;
                }

                let basePos = tileDictionary[baseId];
                if (basePos) {
                    this.mapCtx.drawImage(
                        envSprite,
                        basePos.col * frameW, basePos.row * frameH, frameW, frameH,
                        x * ENGINE.TILE_SIZE, y * ENGINE.TILE_SIZE,
                        ENGINE.TILE_SIZE + drawOverlap, ENGINE.TILE_SIZE + drawOverlap
                    );
                }

                // 2. Draw Grass Overlay via Bitmasking
                if (tileType === 1 && tileLogicMap['grass']) {
                    let mask = this.getBitmask(x, y, 1);
                    let tileId = tileLogicMap['grass'][mask] !== undefined ? tileLogicMap['grass'][mask] : 9;

                    if (mask === 15) { // Fully surrounded by grass, check corners for dirt
                        if (this.getTile(x + 1, y + 1) === 2) tileId = 3;
                        else if (this.getTile(x - 1, y + 1) === 2) tileId = 4;
                        else if (this.getTile(x + 1, y - 1) === 2) tileId = 11;
                        else if (this.getTile(x - 1, y - 1) === 2) tileId = 12;
                        else {
                            if (hash < 5) tileId = 5;
                            else if (hash < 10) tileId = 13;
                            else if (hash < 15) tileId = 21;
                        }
                    }

                    let spritePos = tileDictionary[tileId];
                    if (spritePos) {
                        this.mapCtx.drawImage(
                            envSprite,
                            spritePos.col * frameW, spritePos.row * frameH, frameW, frameH,
                            x * ENGINE.TILE_SIZE, y * ENGINE.TILE_SIZE,
                            ENGINE.TILE_SIZE + drawOverlap, ENGINE.TILE_SIZE + drawOverlap
                        );
                    }
                }
            }
        }

        // --- PASS 2: CLIFF BORDERS ---
        // Drawn strictly on void tiles that touch land
        for (let y = 0; y < ENGINE.MAP_HEIGHT; y++) {
            for (let x = 0; x < ENGINE.MAP_WIDTH; x++) {
                if (this.getTile(x, y) !== 0) continue; // Only process void tiles

                let n = this.getTile(x, y - 1) !== 0;
                let s = this.getTile(x, y + 1) !== 0;
                let w = this.getTile(x - 1, y) !== 0;
                let e = this.getTile(x + 1, y) !== 0;
                let nw = this.getTile(x - 1, y - 1) !== 0;
                let ne = this.getTile(x + 1, y - 1) !== 0;
                let sw = this.getTile(x - 1, y + 1) !== 0;
                let se = this.getTile(x + 1, y + 1) !== 0;

                if (!n && !s && !e && !w && !nw && !ne && !sw && !se) continue;

                let cliffId = null;
                if (n && w) cliffId = 27;
                else if (n && e) cliffId = 29;
                else if (s && w) cliffId = 43;
                else if (s && e) cliffId = 45;
                else if (n) cliffId = 28;
                else if (s) cliffId = 44;
                else if (e) cliffId = 37;
                else if (w) cliffId = 35;
                else if (nw) cliffId = 30;
                else if (ne) cliffId = 31;
                else if (sw) cliffId = 38;
                else if (se) cliffId = 39;

                if (cliffId !== null && this.currentMapId !== 'overworld') {
                    cliffId += 24; // Shifts the grass cliffs down to the dirt cliffs
                }

                if (cliffId !== null) {

                    // 1. FIRST, DRAW SOLID UNDERLAY UNDERNEATH THE CLIFF
                    let hash = ((x * 374761393) ^ (y * 668265263)) % 100;
                    if (hash < 0) hash = -hash;

                    let underlayId = 9; // Default to solid grass

                    if (this.currentMapId !== 'overworld') {
                        // CAVE MAPS: Use solid dirt base
                        underlayId = 6;
                        if (hash < 10) underlayId = 7;
                        else if (hash < 20) underlayId = 14;
                        else if (hash < 30) underlayId = 15;
                        else if (hash < 40) underlayId = 22;
                        else if (hash < 50) underlayId = 23;
                    } else {
                        // OVERWORLD: Use solid grass base
                        if (hash < 5) underlayId = 5;
                        else if (hash < 10) underlayId = 13;
                        else if (hash < 15) underlayId = 21;
                    }

                    let underlayPos = tileDictionary[underlayId];
                    if (underlayPos) {
                        this.mapCtx.drawImage(
                            envSprite,
                            underlayPos.col * frameW, underlayPos.row * frameH, frameW, frameH,
                            x * ENGINE.TILE_SIZE, y * ENGINE.TILE_SIZE,
                            ENGINE.TILE_SIZE + drawOverlap, ENGINE.TILE_SIZE + drawOverlap
                        );
                    }

                    // 2. THEN, DRAW THE CLIFF
                    let spritePos = tileDictionary[cliffId];
                    if (spritePos) {
                        this.mapCtx.drawImage(
                            envSprite,
                            spritePos.col * frameW, spritePos.row * frameH, frameW, frameH,
                            x * ENGINE.TILE_SIZE, y * ENGINE.TILE_SIZE,
                            ENGINE.TILE_SIZE + drawOverlap, ENGINE.TILE_SIZE + drawOverlap
                        );
                    }
                }
            }
        }
    }

    restoreFog() {
        this.fogCtx.save();
        this.fogCtx.globalCompositeOperation = 'destination-out';

        this.exploredTiles.forEach(coord => {
            let parts = coord.split(',');
            let tx = parseInt(parts[0]);
            let ty = parseInt(parts[1]);

            // Convert grid tile back to center pixel coordinates
            let px = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
            let py = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);

            let radGrad = this.fogCtx.createRadialGradient(
                px, py, this.visionRadius * 0.4,
                px, py, this.visionRadius
            );
            radGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
            radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            this.fogCtx.fillStyle = radGrad;
            this.fogCtx.beginPath();
            this.fogCtx.arc(px, py, this.visionRadius, 0, Math.PI * 2);
            this.fogCtx.fill();
        });

        this.fogCtx.restore();
    }

    // Add this right below your restoreFog() method
    resetFog(newExploredArray = []) {
        // 1. Reset logic trackers
        this.exploredTiles = new Set(newExploredArray);
        this.sharedFogTracker = new Set();

        this.fogCtx.save();
        this.fogCtx.clearRect(0, 0, this.fogCanvas.width, this.fogCanvas.height); // 👈 wipe to transparent first
        this.fogCtx.globalCompositeOperation = 'source-over';
        this.fogCtx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        this.fogCtx.fillRect(0, 0, this.fogCanvas.width, this.fogCanvas.height);
        this.fogCtx.restore();

        // 3. Punch out the loaded holes for the new map
        this.restoreFog();
    }

    update(dt) {
        // --- SPAWN IMMUNITY COUNTDOWN ---
        if (this.spawnImmunityTimer > 0) {
            this.spawnImmunityTimer = Math.max(0, this.spawnImmunityTimer - dt);
        }

        // --- LAZY-LOAD ENERGY ON FIRST UPDATE ---
        if (this.currentEnergy === null) {
            this._syncEnergyFromSave();
        }

        let dx = 0, dy = 0;

        if (!inEncounter && !this.isExhausted) {
            // Check for WASD or Arrow Keys
            if (this.keys.w || this.keys.arrowup) dy -= 1;
            if (this.keys.s || this.keys.arrowdown) dy += 1;
            if (this.keys.a || this.keys.arrowleft) dx -= 1;
            if (this.keys.d || this.keys.arrowright) dx += 1;
        } else if (this.isExhausted) {
            // Keep keys cleared when exhausted
            this.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
        }

        if (dx !== 0 || dy !== 0) {
            // --- SNAP CAMERA BACK TO PLAYER WHEN WALKING RESUMES ---
            const SNAP_SPEED = 8; // lerp factor per second; adjust for snappiness
            // We lerp in draw() via the loop, but here we just zero it out over time.
            // Use a fast lerp so it snaps within ~2 frames of movement.
            this.cameraOffset.x += (0 - this.cameraOffset.x) * Math.min(1, SNAP_SPEED * dt);
            this.cameraOffset.y += (0 - this.cameraOffset.y) * Math.min(1, SNAP_SPEED * dt);
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;

            // Determine facing direction
            if (Math.abs(dx) > Math.abs(dy)) {
                this.player.direction = dx > 0 ? 'right' : 'left';
            } else {
                this.player.direction = dy > 0 ? 'down' : 'up';
            }

            // Advance animation frame
            this.player.frameTimer += dt;
            if (this.player.frameTimer >= 0.04) {
                this.player.frame = (this.player.frame + 1) % 36;
                this.player.frameTimer = 0;
            }

            // --- AXIS-INDEPENDENT COLLISION DETECTION ---
            // 1. Calculate the exact pixel coordinate the player WANTS to move to
            let nextX = this.player.x + dx * this.player.speed * dt;
            let nextY = this.player.y + dy * this.player.speed * dt;

            // 2. Convert those pixel coordinates into Tile Grid coordinates
            let targetGridX = Math.floor(nextX / ENGINE.TILE_SIZE);
            let targetGridY = Math.floor(nextY / ENGINE.TILE_SIZE);

            let currentGridX = Math.floor(this.player.x / ENGINE.TILE_SIZE);
            let currentGridY = Math.floor(this.player.y / ENGINE.TILE_SIZE);

            // 3. Move X if the target tile is NOT Void (0)
            if (this.getTile(targetGridX, currentGridY) !== 0) {
                this.player.x = nextX;
            }

            // 4. Move Y if the target tile is NOT Void (0)
            if (this.getTile(currentGridX, targetGridY) !== 0) {
                this.player.y = nextY;
            }

            // --- ENERGY DRAIN DURING MOVEMENT ---
            // Base drain: 1 energy per 3 tiles traveled (slightly faster than before).
            // Reduced to 1 energy per 7 tiles when walking an already-lit (explored) path.
            const _drainGridX = Math.floor(this.player.x / ENGINE.TILE_SIZE);
            const _drainGridY = Math.floor(this.player.y / ENGINE.TILE_SIZE);
            const _drainKey = `${_drainGridX},${_drainGridY}`;
            const _onLitPath = this.exploredTiles && this.exploredTiles.has(_drainKey);
            const ENERGY_DRAIN_PER_PX = _onLitPath
                ? 4 / (3 * ENGINE.TILE_SIZE)   // Slower drain on already-explored tiles
                : 4 / (1.5 * ENGINE.TILE_SIZE);  // Faster base drain on new tiles
            const pixelsMoved = this.player.speed * dt; // magnitude, since dx/dy already normalized
            this.currentEnergy = Math.max(0, this.currentEnergy - pixelsMoved * ENERGY_DRAIN_PER_PX);

            // Periodic localStorage save (every 1 second of movement)
            this.energySaveTimer += dt;
            if (this.energySaveTimer >= 1) {
                this.energySaveTimer = 0;
                this._saveEnergy();
            }

            // Trigger exhaustion
            if (this.currentEnergy <= 0 && !this.isExhausted) {
                this.isExhausted = true;
                this._saveEnergy();
                this.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
                // Signal the UI layer
                if (typeof window.onPlayerExhausted === 'function') window.onPlayerExhausted();
                if (typeof updateAdventureHUD === 'function') updateAdventureHUD();
            }

        } else {
            this.player.frame = 0; // Stand still
        }

        // --- TICK MONSTER LUNGE ANIMATIONS ---
        for (let k in this.monsterLungeAnimations) {
            this.monsterLungeAnimations[k].time += dt;
            if (this.monsterLungeAnimations[k].time >= 0.55) {
                delete this.monsterLungeAnimations[k];
            }
        }

        // --- UPDATE FOG OF WAR ---
        this.fogCtx.save();
        this.fogCtx.globalCompositeOperation = 'destination-out';

        // Create a smooth radial gradient for soft flashlight edges
        let radGrad = this.fogCtx.createRadialGradient(
            this.player.x, this.player.y, this.visionRadius * 0.4, // Inner fully revealed radius
            this.player.x, this.player.y, this.visionRadius        // Outer faded radius
        );
        radGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');   // 100% erased
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');   // 0% erased (blends into fog)

        this.fogCtx.fillStyle = radGrad;
        this.fogCtx.beginPath();
        this.fogCtx.arc(this.player.x, this.player.y, this.visionRadius, 0, Math.PI * 2);
        this.fogCtx.fill();
        this.fogCtx.restore();

        // --- RECORD NEW EXPLORATION ---
        let currentGridX = Math.floor(this.player.x / ENGINE.TILE_SIZE);
        let currentGridY = Math.floor(this.player.y / ENGINE.TILE_SIZE);
        let coordKey = `${currentGridX},${currentGridY}`;

        // NEW: Only run Set operations if the player crosses into a new grid tile
        if (this.lastRecordedTile !== coordKey) {

            if (this.exploredTiles.has(coordKey)) {
                // "Freshen" the tile by moving it to the back of the Set (making it the newest)
                this.exploredTiles.delete(coordKey);
                this.exploredTiles.add(coordKey);
            } else {
                // It's a brand new tile
                this.exploredTiles.add(coordKey);
                this.triggerSave();

                // --- CHECK: Did the player just walk onto another player's fog trail? ---
                // otherFogTileSet is a fast-lookup Set built by the multiplayer listener.
                // The popup only fires here — when the player physically steps on a tile
                // that someone else has explored — never on initial load.
                if (!window._seenOtherFog && window.otherFogTileSet && window.otherFogTileSet.has(coordKey)) {
                    window._seenOtherFog = true;
                    setTimeout(() => {
                        if (typeof triggerFogPathExposition === 'function') triggerFogPathExposition();
                    }, 400);
                }

                // --- CHECK: Did the player just step onto the mysterious sparkle trail? ---
                if (!window._seenSparklePath && window.sparklePathTiles && window.sparklePathTiles.has(coordKey)) {
                    window._seenSparklePath = true;
                    setTimeout(() => {
                        if (typeof triggerSparklePathExposition === 'function') triggerSparklePathExposition();
                    }, 400);
                }
            }

            this.lastRecordedTile = coordKey;
        }

        // --- NEW: ENTITY COLLISION DETECTION ---
        if (window.gridEntities && window.gridEntities[coordKey] && !inEncounter && this.spawnImmunityTimer <= 0) {
            let entityType = window.gridEntities[coordKey];

            // Safely ignore chests already looted — either by this player (per-player state)
            // or globally via the legacy `_opened` suffix (kept so pre-existing world data still works).
            const _mapId = this.currentMapId || 'overworld';
            const _myOpened = window.myOpenedChests || {};
            const _alreadyOpenedByMe = !!_myOpened[`${_mapId}:${coordKey}`];
            if (!entityType.endsWith('_opened') && !_alreadyOpenedByMe) {
                // 1. Force the player to stop moving
                this.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

                // 2. Calculate a safe "bounce back" pixel based on facing direction
                let pushX = 0, pushY = 0;
                if (this.player.direction === 'up') pushY = 1;
                if (this.player.direction === 'down') pushY = -1;
                if (this.player.direction === 'left') pushX = 1;
                if (this.player.direction === 'right') pushX = -1;

                // Push them back a solid 60% of a tile so they definitively cross the grid line
                let bouncePx = this.player.x + (pushX * ENGINE.TILE_SIZE * 0.6);
                let bouncePy = this.player.y + (pushY * ENGINE.TILE_SIZE * 0.6);

                // 3. Trigger the UI overlay
                if (typeof window.startEncounter === 'function') {
                    window.startEncounter(currentGridX, currentGridY, entityType, bouncePx, bouncePy);
                }
            }
        }

        // --- MULTIPLAYER COLLISION DETECTION ---
        if (window.otherPlayers && !inEncounter) {
            for (let pName in window.otherPlayers) {
                let op = window.otherPlayers[pName];

                // Check if they have a valid position and match your current grid coordinates
                if (op.pos && op.pos.x === currentGridX && op.pos.y === currentGridY) {

                    // 1. Force the player to stop moving
                    this.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };

                    // 2. Calculate a safe "bounce back" pixel based on facing direction
                    let pushX = 0, pushY = 0;
                    if (this.player.direction === 'up') pushY = 1;
                    if (this.player.direction === 'down') pushY = -1;
                    if (this.player.direction === 'left') pushX = 1;
                    if (this.player.direction === 'right') pushX = -1;

                    let bouncePx = this.player.x + (pushX * ENGINE.TILE_SIZE * 0.6);
                    let bouncePy = this.player.y + (pushY * ENGINE.TILE_SIZE * 0.6);

                    // 3. Trigger the UI overlay for the player encounter
                    if (typeof window.startEncounter === 'function') {
                        // Pass the type as 'player:Name' to trigger the specific logic in startEncounter
                        window.startEncounter(currentGridX, currentGridY, 'player:' + pName, bouncePx, bouncePy);
                    }

                    break; // Stop checking so we only trigger one encounter at a time
                }
            }
        }

        // --- MULTIPLAYER SYNC ---
        this.multiplayerSyncTimer += dt;
        if (this.multiplayerSyncTimer >= 0.1) { // Broadcast position 10 times a second

            // CHANGE THIS LINE:
            if (typeof window.syncPlayerPosition === 'function') window.syncPlayerPosition();

            this.multiplayerSyncTimer = 0;
        }

        // --- RENDER SHARED FOG ---
        if (window.otherPlayers) {
            this.fogCtx.save();
            this.fogCtx.globalCompositeOperation = 'destination-out';

            for (let p in window.otherPlayers) {
                let op = window.otherPlayers[p];
                if (!op.normPos) continue;

                // 1. Reveal fog around their live moving position
                let opX = op.normPos.x * ENGINE.TILE_SIZE;
                let opY = op.normPos.y * ENGINE.TILE_SIZE;

                let radGrad = this.fogCtx.createRadialGradient(
                    opX, opY, this.visionRadius * 0.4,
                    opX, opY, this.visionRadius
                );
                radGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                this.fogCtx.fillStyle = radGrad;
                this.fogCtx.beginPath();
                this.fogCtx.arc(opX, opY, this.visionRadius, 0, Math.PI * 2);
                this.fogCtx.fill();

                // 2. Process their historical fog safely without lagging
                if (op.parsedFog && op.parsedFog.length > 0) {
                    for (let i = 0; i < op.parsedFog.length; i++) {
                        let coord = op.parsedFog[i];

                        // Only process tiles we haven't rendered yet
                        if (!this.sharedFogTracker.has(coord) && !this.exploredTiles.has(coord)) {
                            this.sharedFogTracker.add(coord);

                            let parts = coord.split(',');
                            let tx = parseInt(parts[0]);
                            let ty = parseInt(parts[1]);
                            let cx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                            let cy = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);

                            let histGrad = this.fogCtx.createRadialGradient(cx, cy, this.visionRadius * 0.4, cx, cy, this.visionRadius);
                            histGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
                            histGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                            this.fogCtx.fillStyle = histGrad;
                            this.fogCtx.beginPath();
                            this.fogCtx.arc(cx, cy, this.visionRadius, 0, Math.PI * 2);
                            this.fogCtx.fill();
                        }
                    }
                }
            }
            this.fogCtx.restore();
        }

        // --- PERSONAL SCROLL PROXIMITY ENCOUNTER ---
        // Fires when the local player steps close to their private scroll.
        // Only visible/triggerable to the owning player (personalScrollKey is never
        // written to Firebase, so other players never see it).
        if (window.personalScrollKey && !inEncounter && !this.personalScrollEncounterSeen && this.spawnImmunityTimer <= 0) {
            const _sParts = window.personalScrollKey.split(',');
            const _sTx = parseInt(_sParts[0]);
            const _sTy = parseInt(_sParts[1]);
            const _sDist = Math.hypot(
                this.player.x - (_sTx * ENGINE.TILE_SIZE + ENGINE.TILE_SIZE / 2),
                this.player.y - (_sTy * ENGINE.TILE_SIZE + ENGINE.TILE_SIZE / 2)
            );
            if (_sDist <= ENGINE.TILE_SIZE * 1.5) {
                this.personalScrollEncounterSeen = true;
                // Freeze movement for the dramatic pause
                this.keys = {
                    w: false, a: false, s: false, d: false,
                    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false
                };
                const _snapX = this.player.x;
                const _snapY = this.player.y;
                setTimeout(() => {
                    if (!inEncounter && window.personalScrollKey && typeof window.startEncounter === 'function') {
                        window.startEncounter(_sTx, _sTy, 'personal_scroll', _snapX, _snapY);
                    }
                }, 250);
            }
        }

        // Update camera position
        this.camera.x = this.player.x - (this.canvas.width / 2);
        this.camera.y = this.player.y - (this.canvas.height / 2);
    }

    draw() {
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // --- NATIVE CANVAS CAMERA & ZOOM ---
        // 1. Move the canvas origin to the center of the screen
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        // 2. Apply the zoom scale
        this.ctx.scale(this.zoom, this.zoom);
        // 3. Move the canvas origin so the player is centered, offset by any drag pan
        this.ctx.translate(-this.player.x - this.cameraOffset.x, -this.player.y - this.cameraOffset.y);

        // Draw the massive pre-rendered map at true 0,0
        this.ctx.drawImage(this.mapCanvas, 0, 0);

        let renderables = [];

        // Add the Player (No longer needs manual camera subtraction!)
        renderables.push({
            type: 'player',
            y: this.player.y,
            drawLogic: () => {
                let sheetDir = this.player.direction;
                if (sheetDir === 'right') sheetDir = 'left';

                let pSprite = getHeroSprite(this.heroClass, sheetDir);
                let drawSize = ENGINE.TILE_SIZE * 1.2;
                let centerX = this.player.x;
                let centerY = this.player.y;

                if (pSprite.complete && pSprite.naturalWidth !== 0) {
                    let col = this.player.frame % 6;
                    let row = Math.floor(this.player.frame / 6);
                    let frameW = pSprite.naturalWidth / 6;
                    let frameH = pSprite.naturalHeight / 6;

                    this.ctx.save();
                    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    this.ctx.shadowBlur = 5;

                    if (this.player.direction === 'right') {
                        this.ctx.translate(centerX, centerY);
                        this.ctx.scale(-1, 1);
                        this.ctx.translate(-centerX, -centerY);
                    }

                    this.ctx.drawImage(
                        pSprite,
                        col * frameW, row * frameH, frameW, frameH,
                        centerX - (drawSize / 2), centerY - (drawSize / 2), drawSize, drawSize
                    );
                    this.ctx.restore();
                }
            }
        });

        // --- ADD MULTIPLAYER AVATARS ---
        if (window.otherPlayers) {
            for (let pName in window.otherPlayers) {
                let op = window.otherPlayers[pName];
                if (!op.normPos) continue;

                let opX = op.normPos.x * ENGINE.TILE_SIZE;
                let opY = op.normPos.y * ENGINE.TILE_SIZE;

                renderables.push({
                    type: 'other_player',
                    y: opY,
                    drawLogic: () => {
                        // Use their synced direction, default to 'down' if missing
                        let sheetDir = op.direction || 'down';
                        if (sheetDir === 'right') sheetDir = 'left';

                        let opSprite = getHeroSprite(op.class || 'Black Cat', sheetDir);
                        let drawSize = ENGINE.TILE_SIZE * 1.2;

                        if (opSprite.complete && opSprite.naturalWidth !== 0) {
                            let frame = op.frame || 0;
                            let col = frame % 6;
                            let row = Math.floor(frame / 6);
                            let frameW = opSprite.naturalWidth / 6;
                            let frameH = opSprite.naturalHeight / 6;

                            this.ctx.save();
                            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                            this.ctx.shadowBlur = 5;

                            if (op.direction === 'right') {
                                this.ctx.translate(opX, opY);
                                this.ctx.scale(-1, 1);
                                this.ctx.translate(-opX, -opY);
                            }

                            this.ctx.drawImage(
                                opSprite,
                                col * frameW, row * frameH, frameW, frameH,
                                opX - (drawSize / 2), opY - (drawSize / 2), drawSize, drawSize
                            );
                            this.ctx.restore();

                            // Draw Nameplate above their head
                            this.ctx.save();
                            this.ctx.fillStyle = '#10b981'; // Mint green for allies!
                            this.ctx.font = 'bold 12px Arial';
                            this.ctx.textAlign = 'center';
                            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                            this.ctx.shadowBlur = 4;
                            this.ctx.fillText(pName, opX, opY - (drawSize / 2) - 5);
                            this.ctx.restore();
                        }
                    }
                });
            }
        }

        // Calculate visible boundaries factoring in the zoom level
        let visibleWidth = (this.canvas.width / this.zoom);
        let visibleHeight = (this.canvas.height / this.zoom);

        // Camera center in world space (player pos + drag offset)
        let camCenterX = this.player.x + this.cameraOffset.x;
        let camCenterY = this.player.y + this.cameraOffset.y;

        let startTileX = Math.max(0, Math.floor((camCenterX - visibleWidth / 2) / ENGINE.TILE_SIZE) - 2);
        let startTileY = Math.max(0, Math.floor((camCenterY - visibleHeight / 2) / ENGINE.TILE_SIZE) - 4);
        let endTileX = Math.min(ENGINE.MAP_WIDTH, Math.ceil((camCenterX + visibleWidth / 2) / ENGINE.TILE_SIZE) + 2);
        let endTileY = Math.min(ENGINE.MAP_HEIGHT, Math.ceil((camCenterY + visibleHeight / 2) / ENGINE.TILE_SIZE) + 8);

        const decorSprite = getDecorationSprite();

        for (let ty = startTileY; ty <= endTileY; ty++) {
            for (let tx = startTileX; tx <= endTileX; tx++) {
                let key = `${tx},${ty}`;

                if (window.mapTerrain && window.mapTerrain[key] && window.mapTerrain[key].decor) {
                    let decorId = window.mapTerrain[key].decor;

                    if (gameDecorations[decorId]) {
                        let decorConfig = gameDecorations[decorId];
                        if (!decorSprite.complete || decorSprite.naturalWidth === 0) continue;

                        let sw = decorConfig.endX - decorConfig.startX;
                        let sh = decorConfig.endY - decorConfig.startY;
                        let sortY = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                        if (decorConfig.isFlat) sortY -= ENGINE.TILE_SIZE;

                        renderables.push({
                            type: 'decor',
                            y: sortY,
                            drawLogic: () => {
                                let destW = sw * decorConfig.scale;
                                let destH = sh * decorConfig.scale;

                                // Draw at true world coordinates!
                                let dx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2) - (destW / 2);
                                let dy = (ty * ENGINE.TILE_SIZE) + ENGINE.TILE_SIZE - destH;

                                this.ctx.drawImage(
                                    decorSprite,
                                    decorConfig.startX, decorConfig.startY, sw, sh,
                                    dx, dy, destW, destH
                                );
                            }
                        });
                    }
                }
            }
        }

        // --- ADD ENTITIES (MONSTERS & CHESTS) ---
        for (let key in window.gridEntities) {
            let parts = key.split(',');
            let tx = parseInt(parts[0]);
            let ty = parseInt(parts[1]);

            // Only process entities currently visible on the camera
            if (tx >= startTileX && tx <= endTileX && ty >= startTileY && ty <= endTileY) {
                let entityKey = window.gridEntities[key];
                let sortY = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);

                // We'll calculate what the visibility SHOULD be right now based on distance
                let currentVisibility = 0;

                // 1. If the tile was permanently explored, it's definitely 1.0
                if (this.exploredTiles.has(key) || this.sharedFogTracker.has(key)) {
                    currentVisibility = 1.0;
                } else {
                    // 2. Check if it is currently within the flashlight radius
                    let entityCenterX = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                    let entityCenterY = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);

                    let closestDist = Math.hypot(entityCenterX - this.player.x, entityCenterY - this.player.y);

                    if (window.otherPlayers) {
                        for (let p in window.otherPlayers) {
                            let op = window.otherPlayers[p];
                            if (op.normPos) {
                                let opX = op.normPos.x * ENGINE.TILE_SIZE;
                                let opY = op.normPos.y * ENGINE.TILE_SIZE;
                                let d = Math.hypot(entityCenterX - opX, entityCenterY - opY);
                                if (d < closestDist) closestDist = d;
                            }
                        }
                    }

                    // 3. INSTANT REVEAL & PERMANENT SAVE
                    if (closestDist <= this.visionRadius) {
                        currentVisibility = 1.0;
                        this.exploredTiles.add(key); // Memorize this tile permanently
                        this.triggerSave();          // Push the new memory to Firebase/LocalStorage

                        // --- MONSTER LUNGE + AUTO-ENCOUNTER ---
                        // Fires exactly once the first time a monster tile enters the player's vision.
                        const _lEntityKey = window.gridEntities[key];
                        if (gameMonsters[_lEntityKey] && !this.monsterLungeSeen.has(key) && !window.inEncounter) {
                            this.monsterLungeSeen.add(key);

                            // Build a direction vector: monster center → player
                            const _lMonCX = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                            const _lMonCY = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                            let _lDx = this.player.x - _lMonCX;
                            let _lDy = this.player.y - _lMonCY;
                            const _lLen = Math.sqrt(_lDx * _lDx + _lDy * _lDy) || 1;
                            this.monsterLungeAnimations[key] = { time: 0, dirX: _lDx / _lLen, dirY: _lDy / _lLen };

                            // Freeze the player immediately (dramatic pause)
                            this.keys = {
                                w: false, a: false, s: false, d: false,
                                arrowup: false, arrowdown: false, arrowleft: false, arrowright: false
                            };

                            // Snapshot values — closure vars can drift during the timeout
                            const _snapX = this.player.x;
                            const _snapY = this.player.y;
                            const _monTx = tx;
                            const _monTy = ty;
                            const _monType = _lEntityKey;
                            const _monKey = key;

                            // Open the encounter panel once the lunge animation has peaked (~350 ms)
                            setTimeout(() => {
                                if (window.inEncounter) return; // Already in another encounter
                                if (!window.gridEntities || !window.gridEntities[_monKey]) return; // Monster already gone
                                if (typeof window.startEncounter === 'function') {
                                    window.startEncounter(_monTx, _monTy, _monType, _snapX, _snapY);
                                }
                            }, 350);
                        }
                    }
                }

                let entityAlpha = currentVisibility;

                // If it has never been seen at all, skip rendering entirely
                if (entityAlpha <= 0) continue;

                // --- 1. MONSTER RENDERING ---
                let monsterConfig = gameMonsters[entityKey];
                if (monsterConfig) {
                    let mSprite = getMonsterSprite(entityKey);
                    if (!mSprite.complete || mSprite.naturalWidth === 0) continue;

                    let drawSize = ENGINE.TILE_SIZE * (monsterConfig.scale || 1);

                    renderables.push({
                        type: 'monster',
                        y: sortY,
                        drawLogic: () => {
                            // Apply lunge animation offset
                            let lOffX = 0, lOffY = 0;
                            const lAnim = this.monsterLungeAnimations[key];
                            if (lAnim) {
                                const t = Math.min(1, lAnim.time / 0.55);
                                const lungeAmount = Math.sin(t * Math.PI) * ENGINE.TILE_SIZE * 1.1;
                                lOffX = lAnim.dirX * lungeAmount;
                                lOffY = lAnim.dirY * lungeAmount;
                            }

                            let dx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2) - (drawSize / 2) + lOffX;
                            let dy = (ty * ENGINE.TILE_SIZE) + ENGINE.TILE_SIZE - drawSize + lOffY;

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha; // <-- NEW: Apply vision fade

                            if (monsterConfig.glow) {
                                this.ctx.shadowColor = monsterConfig.glow;
                                this.ctx.shadowBlur = 10;
                            }
                            this.ctx.drawImage(mSprite, dx, dy, drawSize, drawSize);
                            this.ctx.restore();
                        }
                    });
                    continue; // Skip the chest check if it was a monster
                }

                // --- 2. CHEST RENDERING ---
                // A chest is drawn "opened" if either (a) the legacy global suffix is set,
                // or (b) THIS player has personally opened it (per-player state).
                let _hasLegacySuffix = entityKey.endsWith('_opened');
                let baseChestKey = _hasLegacySuffix ? entityKey.replace('_opened', '') : entityKey;
                let _renderMapId = this.currentMapId || 'overworld';
                let _myOpenedRender = window.myOpenedChests || {};
                let _openedByMe = !!_myOpenedRender[`${_renderMapId}:${tx},${ty}`];
                let isOpened = _hasLegacySuffix || _openedByMe;
                let chestConfig = chestTypes[baseChestKey];

                if (chestConfig) {
                    let cSprite = getChestSheet();
                    if (!cSprite.complete || cSprite.naturalWidth === 0) continue;

                    let drawSize = ENGINE.TILE_SIZE * 1.0;

                    renderables.push({
                        type: 'chest',
                        y: sortY,
                        drawLogic: () => {
                            let dx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2) - (drawSize / 2);
                            let dy = (ty * ENGINE.TILE_SIZE) + ENGINE.TILE_SIZE - drawSize;

                            let frameW = cSprite.naturalWidth / 12;
                            let frameH = cSprite.naturalHeight / 8;

                            let drawCol = chestConfig.col;
                            // Shift down 3 rows to grab the opened frame
                            let drawRow = isOpened ? chestConfig.row + 3 : chestConfig.row;

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha; // <-- NEW: Apply vision fade

                            // Only glow if it's unopened
                            if (!isOpened && chestConfig.glow) {
                                this.ctx.shadowColor = chestConfig.glow;
                                this.ctx.shadowBlur = 10;
                            }
                            this.ctx.drawImage(
                                cSprite,
                                drawCol * frameW, drawRow * frameH, frameW, frameH,
                                dx, dy, drawSize, drawSize
                            );
                            this.ctx.restore();
                        }
                    });
                }

                // --- QUEST CHEST RENDERING ---
                if (entityKey.startsWith('quest_chest_')) {
                    let questItemId = entityKey.replace('quest_chest_', '');
                    let qItemConfig = typeof questItems !== 'undefined' ? questItems[questItemId] : null;
                    let cSprite = getChestSheet();
                    if (!cSprite.complete || cSprite.naturalWidth === 0) continue;

                    // Render using the Crystal Chest sprite (tier 7: col 6, row 0)
                    const qChestBase = chestTypes['chest_tier7'];
                    let drawSize = ENGINE.TILE_SIZE * 1.1;

                    // Determine glow color from questItems config
                    let glowColor = qItemConfig ? qItemConfig.color : 'rgba(168, 85, 247, 0.9)';

                    renderables.push({
                        type: 'chest',
                        y: sortY,
                        drawLogic: () => {
                            let dx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2) - (drawSize / 2);
                            let dy = (ty * ENGINE.TILE_SIZE) + ENGINE.TILE_SIZE - drawSize;
                            let frameW = cSprite.naturalWidth / 12;
                            let frameH = cSprite.naturalHeight / 8;

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha;
                            // Animated pulsing glow for quest chests
                            let pulse = 0.6 + 0.4 * Math.sin(performance.now() / 500);
                            this.ctx.shadowColor = glowColor;
                            this.ctx.shadowBlur = 18 * pulse;
                            this.ctx.drawImage(
                                cSprite,
                                qChestBase.col * frameW, qChestBase.row * frameH, frameW, frameH,
                                dx, dy, drawSize, drawSize
                            );
                            this.ctx.restore();
                        }
                    });
                    continue;
                }

                // --- MYSTERIOUS WIZARD RENDERING ---
                if (entityKey === 'mysterious_wizard') {
                    renderables.push({
                        type: 'monster',
                        y: sortY,
                        drawLogic: () => {
                            let cx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                            let cy = (ty * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                            let pulse = 0.5 + 0.5 * Math.sin(performance.now() / 700);
                            const wizImg = getWizardSprite();
                            const drawSize = ENGINE.TILE_SIZE * 2.0;

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha;
                            this.ctx.shadowColor = `rgba(168, 85, 247, ${0.7 * pulse})`;
                            this.ctx.shadowBlur = 20;

                            if (wizImg && wizImg.complete && wizImg.naturalWidth > 0) {
                                // Draw sprite image centered on tile
                                this.ctx.drawImage(
                                    wizImg,
                                    cx - drawSize / 2,
                                    cy - drawSize / 2,
                                    drawSize,
                                    drawSize
                                );
                            } else {
                                // Fallback: emoji
                                this.ctx.font = `${ENGINE.TILE_SIZE * 1.4}px serif`;
                                this.ctx.textAlign = 'center';
                                this.ctx.textBaseline = 'middle';
                                this.ctx.fillText('🧙', cx, cy);
                            }

                            this.ctx.restore();
                        }
                    });
                    continue;
                }

                // --- SHRINE RENDERING ---
                if (entityKey === 'shrine') {
                    renderables.push({
                        type: 'decor',
                        y: sortY - ENGINE.TILE_SIZE,
                        drawLogic: () => {
                            let cx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2);
                            let cy = (ty * ENGINE.TILE_SIZE) - ENGINE.TILE_SIZE * 0.2;
                            let pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha;
                            this.ctx.shadowColor = `rgba(252, 211, 77, ${0.8 * pulse})`;
                            this.ctx.shadowBlur = 30 * pulse;
                            this.ctx.font = `${ENGINE.TILE_SIZE * 2.0}px serif`;
                            this.ctx.textAlign = 'center';
                            this.ctx.textBaseline = 'middle';
                            this.ctx.fillText('🏛️', cx, cy);
                            this.ctx.restore();
                        }
                    });
                    continue;
                }

                // --- 3. CAVE ENTRANCE RENDERING ---
                if (entityKey === 'cave') {
                    let decorSprite = getDecorationSprite();
                    if (!decorSprite.complete || decorSprite.naturalWidth === 0) continue;

                    // 1. Fetch the exact coordinates and scale from your gameDecorations object
                    const caveData = gameDecorations['cave_entrance'];
                    const sWidth = caveData.endX - caveData.startX;
                    const sHeight = caveData.endY - caveData.startY;

                    // 2. Calculate the actual width/height to draw based on its scale property
                    // (If this renders too big or small, you can adjust the scale property in gameDecorations)
                    const dWidth = sWidth * caveData.scale;
                    const dHeight = sHeight * caveData.scale;

                    renderables.push({
                        type: 'cave',
                        y: sortY,
                        drawLogic: () => {
                            // Center the entrance horizontally on the tile
                            let dx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2) - (dWidth / 2);
                            // Anchor the bottom of the entrance to the bottom of the tile
                            let dy = (ty * ENGINE.TILE_SIZE) + ENGINE.TILE_SIZE - dHeight;

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha; // Apply flashlight vision fade

                            // Give it an ominous dark glow
                            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                            this.ctx.shadowBlur = 15;

                            // 3. Use the 9-argument drawImage to crop out just the cave
                            this.ctx.drawImage(
                                decorSprite,       // The full sprite sheet
                                caveData.startX,   // Source X
                                caveData.startY,   // Source Y
                                sWidth,            // Source Width
                                sHeight,           // Source Height
                                dx,                // Destination X
                                dy,                // Destination Y
                                dWidth,            // Destination Width
                                dHeight            // Destination Height
                            );
                            this.ctx.restore();
                        }
                    });
                    continue; // Skip further checks for this entity
                }

                else if (entityKey === 'exit') {
                    let decorSprite = getDecorationSprite();
                    if (!decorSprite.complete || decorSprite.naturalWidth === 0) continue;

                    // 1. Fetch the exact coordinates and scale from your gameDecorations object
                    const caveData = gameDecorations['cave_exit'];
                    const sWidth = caveData.endX - caveData.startX;
                    const sHeight = caveData.endY - caveData.startY;

                    // 2. Calculate the actual width/height to draw based on its scale property
                    // (If this renders too big or small, you can adjust the scale property in gameDecorations)
                    const dWidth = sWidth * caveData.scale;
                    const dHeight = sHeight * caveData.scale;

                    renderables.push({
                        type: 'exit',
                        y: sortY,
                        drawLogic: () => {
                            // Center the entrance horizontally on the tile
                            let dx = (tx * ENGINE.TILE_SIZE) + (ENGINE.TILE_SIZE / 2) - (dWidth / 2);
                            // Anchor the bottom of the entrance to the bottom of the tile
                            let dy = (ty * ENGINE.TILE_SIZE) + ENGINE.TILE_SIZE - dHeight;

                            this.ctx.save();
                            this.ctx.globalAlpha = entityAlpha; // Apply flashlight vision fade

                            // Give it an ominous dark glow
                            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                            this.ctx.shadowBlur = 15;

                            // 3. Use the 9-argument drawImage to crop out just the cave
                            this.ctx.drawImage(
                                decorSprite,       // The full sprite sheet
                                caveData.startX,   // Source X
                                caveData.startY,   // Source Y
                                sWidth,            // Source Width
                                sHeight,           // Source Height
                                dx,                // Destination X
                                dy,                // Destination Y
                                dWidth,            // Destination Width
                                dHeight            // Destination Height
                            );
                            this.ctx.restore();
                        }
                    });
                    continue; // Skip further checks for this entity
                }
            }
        }

        renderables.sort((a, b) => a.y - b.y);
        for (let i = 0; i < renderables.length; i++) {
            renderables[i].drawLogic();
        }
        this.ctx.drawImage(this.fogCanvas, 0, 0);

        // --- SPARKLE PATH RENDERING (drawn over fog so trail peeks through the dark) ---
        if (window.sparklePathTiles && window.sparklePathTiles.size > 0) {
            const now = performance.now();
            this.ctx.save();

            for (let key of window.sparklePathTiles) {
                const sparts = key.split(',');
                const stx = parseInt(sparts[0]);
                const sty = parseInt(sparts[1]);

                // Only draw tiles near the visible area (with a small buffer)
                if (stx < startTileX - 2 || stx > endTileX + 2 || sty < startTileY - 2 || sty > endTileY + 2) continue;

                const cx = stx * ENGINE.TILE_SIZE + ENGINE.TILE_SIZE / 2;
                const cy = sty * ENGINE.TILE_SIZE + ENGINE.TILE_SIZE / 2;

                // Each tile gets a unique animated phase so they twinkle independently
                const hash = (((stx * 374761393) ^ (sty * 668265263)) & 0x7FFFFFFF) % 10000;
                const phase = ((now / 1400) + hash * 0.0001) % 1;
                const twinkle = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);

                // Faint golden ambient glow — barely visible, just hinting the path
                const glowAlpha = 0.07 + 0.07 * twinkle;
                const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, ENGINE.TILE_SIZE * 0.7);
                grad.addColorStop(0, `rgba(255, 225, 100, ${glowAlpha})`);
                grad.addColorStop(0.6, `rgba(200, 160,  60, ${glowAlpha * 0.4})`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                this.ctx.globalAlpha = 1;
                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, ENGINE.TILE_SIZE * 0.7, 0, Math.PI * 2);
                this.ctx.fill();

                // Tiny bright center spark
                const sparkR = 1.2 + 1.6 * twinkle;
                this.ctx.globalAlpha = 0.18 + 0.22 * twinkle;
                this.ctx.fillStyle = 'rgba(255, 245, 180, 1)';
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, sparkR, 0, Math.PI * 2);
                this.ctx.fill();

                // Four-pointed cross gleam on the brightest frames
                if (twinkle > 0.55) {
                    const armLen = sparkR * 2.8;
                    const lineAlpha = (twinkle - 0.55) * 0.5; // 0 → 0.225
                    this.ctx.globalAlpha = lineAlpha;
                    this.ctx.strokeStyle = 'rgba(255, 250, 210, 1)';
                    this.ctx.lineWidth = 0.8;
                    this.ctx.lineCap = 'round';
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx - armLen, cy); this.ctx.lineTo(cx + armLen, cy);
                    this.ctx.moveTo(cx, cy - armLen); this.ctx.lineTo(cx, cy + armLen);
                    this.ctx.stroke();
                }
            }

            this.ctx.globalAlpha = 1;
            this.ctx.restore();
        }

        // --- PERSONAL SCROLL SPRITE ---
        // Drawn after fog so it glows through the darkness, just like the sparkle trail.
        // Only the local player's client has window.personalScrollKey, so this is
        // completely invisible to anyone else in the multiplayer realm.
        if (window.personalScrollKey) {
            const _sp = window.personalScrollKey.split(',');
            const _stx = parseInt(_sp[0]);
            const _sty = parseInt(_sp[1]);
            const _scx = _stx * ENGINE.TILE_SIZE + ENGINE.TILE_SIZE / 2;
            const _scy = _sty * ENGINE.TILE_SIZE + ENGINE.TILE_SIZE / 2;
            const _now = performance.now();
            const _bob = Math.sin(_now / 700) * 3;
            const _pulse = 0.75 + 0.25 * Math.sin(_now / 900);

            this.ctx.save();
            // Warm golden halo glow behind the scroll
            const _halo = this.ctx.createRadialGradient(_scx, _scy, 0, _scx, _scy, ENGINE.TILE_SIZE * 1.1);
            _halo.addColorStop(0, `rgba(252, 211, 77, ${0.30 * _pulse})`);
            _halo.addColorStop(0.6, `rgba(252, 180, 30, ${0.12 * _pulse})`);
            _halo.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = _halo;
            this.ctx.beginPath();
            this.ctx.arc(_scx, _scy, ENGINE.TILE_SIZE * 1.1, 0, Math.PI * 2);
            this.ctx.fill();

            // Scroll icon with animated bob and golden shadow glow
            this.ctx.globalAlpha = 0.93;
            this.ctx.font = `${ENGINE.TILE_SIZE * 0.9}px serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowColor = '#fcd34d';
            this.ctx.shadowBlur = 18 * _pulse;
            this.ctx.fillText('📜', _scx, _scy - ENGINE.TILE_SIZE * 0.2 + _bob);
            this.ctx.restore();
        }

        this.ctx.restore(); // Resets the camera transforms for the next frame
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1; // Cap dt to prevent massive jumps on lag spikes
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        // Update HUD in real time (10x per second — smooth without hammering the DOM)
        this.hudUpdateTimer += dt;
        if (this.hudUpdateTimer >= 0.1) {
            this.hudUpdateTimer = 0;
            if (typeof updateAdventureHUD === 'function') updateAdventureHUD();
        }

        this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }

    // --- ENERGY SYSTEM METHODS ---
    _syncEnergyFromSave() {
        let data = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
        if (data.stats) {
            const endStat = data.stats.end || 5;
            // Also factor in equipped END bonuses
            let bonusEnd = 0;
            if (data.equipped) {
                Object.values(data.equipped).forEach(item => {
                    if (item && item.targetStat === 'end') bonusEnd += item.statBonus;
                });
            }
            this.maxEnergy = 20 + ((endStat + bonusEnd) * 5);
            const saved = data.stats.current_energy;
            this.currentEnergy = (saved !== undefined && saved !== null)
                ? Math.min(saved, this.maxEnergy)
                : this.maxEnergy;
        }
        this.isExhausted = this.currentEnergy !== null && this.currentEnergy <= 0;
    }

    _saveEnergy() {
        let data = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
        if (data.stats) {
            data.stats.current_energy = Math.max(0, Math.round(this.currentEnergy * 10) / 10);
            localStorage.setItem('motivation_RPG', JSON.stringify(data));
        }
    }
}
