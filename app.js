// =============================================================================
// APP.JS
// Main application logic (DOMContentLoaded).
// Depends on: game-data.js, image-cache.js, engine.js, firebase-config.js,
//             boss-fight.js
// =============================================================================

document.addEventListener('DOMContentLoaded', function () {
    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const themeSelectors = document.querySelectorAll('.theme-selector');
    const activityForm = document.getElementById('daily-activity-form');
    const activityLogContainer = document.getElementById('activity-history-log');
    const welcomeScreen = document.getElementById('welcome-screen');
    const appContainer = document.getElementById('app-container');
    const creatorForm = document.getElementById('character-creator-form');
    const statsBtns = document.querySelectorAll('.stats-tab-btn');
    const statsViews = document.querySelectorAll('.stats-sub-view');
    const prevCalBtn = document.getElementById('cal-prev-btn');
    const nextCalBtn = document.getElementById('cal-next-btn');
    const actPrevBtn = document.getElementById('act-prev-btn');
    const actNextBtn = document.getElementById('act-next-btn');
    const simpleFogToggle = document.getElementById('simple-fog-toggle');
    const softFogToggle = document.getElementById('soft-fog-toggle');
    const characters = Object.values(heroClasses);
    let chartTotalXp = null;
    let chartDailyXp = null;
    let chartActivity = null;
    let chartXpSource = null;
    let currentCalendarYear = 2026;
    let currentActivityDateOffset = 0;
    let cachedSimpleFog = false;
    let cachedSoftFog = true;

    // --- ACTIVITY GROUP CONFIGURATION ---
    const ACTIVITY_GROUPS = {
        original: {
            label: "Sportsballer's Path",
            icon: '⚽',
            activities: [
                { id: 'act-exercise', key: 'exercise', label: 'Exercise', icon: 'fas fa-running', unit: '2 xp/minute', xpRate: 2 },
                { id: 'act-chores', key: 'chores', label: 'Chores', icon: 'fas fa-broom', unit: '2 xp/minute', xpRate: 2 },
                { id: 'act-reading', key: 'reading', label: 'Reading', icon: 'fas fa-book-open', unit: '1 xp/minute', xpRate: 1 },
                { id: 'act-work', key: 'work', label: 'Work/Productivity', icon: 'fas fa-briefcase', unit: '1 xp/minute', xpRate: 1 },
                { id: 'act-socializing', key: 'socializing', label: 'Socializing', icon: 'fas fa-users', unit: '0.5 xp/minute', xpRate: 0.5 },
                { id: 'act-minortodo', key: 'minortodo', label: 'Minor To-Do Items', icon: 'fas fa-clipboard-check', unit: '10 xp/item', xpRate: 10 },
                { id: 'act-majortodo', key: 'majortodo', label: 'Major To-Do Items', icon: 'fas fa-clipboard-check', unit: '40 xp/item', xpRate: 40 }
            ]
        },
        wellness: {
            label: 'Wellness Path',
            icon: '🌿',
            activities: [
                { id: 'act-journaling', key: 'journaling', label: 'Journaling', icon: 'fas fa-pen-nib', unit: '2 xp/minute', xpRate: 2 },
                { id: 'act-exercise', key: 'exercise', label: 'Exercise', icon: 'fas fa-running', unit: '2 xp/minute', xpRate: 3 },
                { id: 'act-hobbies', key: 'hobbies', label: 'Hobbies', icon: 'fas fa-book-open', unit: '1 xp/minute', xpRate: 2 },
                { id: 'act-chores', key: 'chores', label: 'Chores', icon: 'fas fa-broom', unit: '2 xp/minute', xpRate: 2 },
                { id: 'act-water', key: 'water', label: 'Drinking Water', icon: 'fas fa-tint', unit: '10 xp/60 oz', xpRate: 10 },
                { id: 'act-socializing', key: 'socializing', label: 'Socializing', icon: 'fas fa-users', unit: '0.5 xp/minute', xpRate: 0.5 },
                { id: 'act-volunteering', key: 'volunteering', label: 'Volunteering', icon: 'fas fa-hand-holding-heart', unit: '2 xp/minute', xpRate: 2 },
                { id: 'act-minortodo', key: 'minortodo', label: 'Minor To-Do Items', icon: 'fas fa-clipboard-check', unit: '10 xp/item', xpRate: 10 },
                { id: 'act-majortodo', key: 'majortodo', label: 'Major To-Do Items', icon: 'fas fa-clipboard-check', unit: '40 xp/item', xpRate: 40 }
            ]
        }
    };

    // Icon / unit metadata for rendering log entries from saved stat keys
    const STAT_META = {
        exercise: { icon: 'fas fa-running', unit: 'min' },
        chores: { icon: 'fas fa-broom', unit: 'min' },
        reading: { icon: 'fas fa-book-open', unit: 'min' },
        work: { icon: 'fas fa-briefcase', unit: 'min' },
        socializing: { icon: 'fas fa-users', unit: 'min' },
        movie: { icon: 'fas fa-film', unit: 'min' },  // legacy key
        todo: { icon: 'fas fa-clipboard-check', unit: '' },
        journaling: { icon: 'fas fa-pen-nib', unit: 'min' },
        water: { icon: 'fas fa-tint', unit: 'glasses' },
        volunteering: { icon: 'fas fa-hand-holding-heart', unit: 'min' }
    };

    // Universal XP calculator — handles all known stat keys
    // Pass an optional `date` (string or Date) to apply the weekend half-XP penalty.
    function calculateXpFromStats(s, date) {
        if (!s) return 0;
        const day = date ? new Date(date).getDay() : -1;
        const isWeekend = day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
        const weekendMultiplier = isWeekend ? 0.5 : 1;
        return Math.floor((
            (s.exercise || 0) * 3 +
            (s.chores || 0) * 2 +
            (s.reading || 0) * 2 +
            (s.work || 0) * 1 +
            (s.socializing || s.movie || 0) * 0.5 +
            (s.volunteering || 0) * 2 +
            (s.todo || 0) * 10 +
            (s.journaling || 0) * 2 +
            (s.water || 0) * 5
        ) * weekendMultiplier);
    }

    // Returns the current player's ACTIVITY_GROUPS entry (defaults to original)
    function getActiveGroup() {
        const data = getSaveData();
        return ACTIVITY_GROUPS[data.activity_group] || ACTIVITY_GROUPS['original'];
    }



    function getRandomChestType() {
        let rand = Math.random() * 100;
        if (rand < 40) return 'chest_tier1';       // 40%
        if (rand < 65) return 'chest_tier2';       // 25%
        if (rand < 80) return 'chest_tier3';       // 15%
        if (rand < 90) return 'chest_tier4';       // 10%
        if (rand < 95) return 'chest_tier5';       // 5%
        if (rand < 98) return 'chest_tier6';       // 3%
        if (rand < 99.5) return 'chest_tier7';     // 1.5%
        return 'chest_tier8';                      // 0.5%
    }

    // --- UNIFIED MONSTER CONFIGURATION ---

    // Dynamic weighted random spawner
    function getRandomMonsterType(currentZone) {
        let totalWeight = 0;
        let spawnable = [];

        // Tally up the weights of all non-boss monsters allowed in this zone
        for (let key in gameMonsters) {
            let monster = gameMonsters[key];

            if (!monster.isBoss && monster.spawnWeight > 0) {
                // SAFEGUARD: If allowedZones is missing, assume it can spawn anywhere to prevent breaking
                let isAllowed = !monster.allowedZones || monster.allowedZones.includes(currentZone);

                if (isAllowed) {
                    totalWeight += monster.spawnWeight;
                    spawnable.push({ key: key, weight: monster.spawnWeight });
                }
            }
        }

        // Failsafe if no monsters are allowed in this zone
        if (spawnable.length === 0) return 'slime';

        let randomNum = Math.random() * totalWeight;
        let cumulativeWeight = 0;

        // Pick the monster that the random number lands on
        for (let i = 0; i < spawnable.length; i++) {
            cumulativeWeight += spawnable[i].weight;
            if (randomNum <= cumulativeWeight) {
                return spawnable[i].key;
            }
        }

        return 'slime'; // Fallback just in case
    }

    // --- Stats Sub-Navigation Toggle ---

    statsBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            // Remove active classes from all buttons and views
            statsBtns.forEach(b => b.classList.remove('active'));
            statsViews.forEach(v => v.classList.remove('active'));

            // Add active class to the clicked button and its target view
            this.classList.add('active');
            const targetId = this.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'stats-gratitude-view') {
                renderGratitudeLog();
            }
        });
    });

    // --- Calendar Navigation Listeners ---

    if (prevCalBtn && nextCalBtn) {
        prevCalBtn.addEventListener('click', function () {
            if (currentCalendarYear > 2026) {
                currentCalendarYear--;
                renderCalendarUI();
            }
        });
        nextCalBtn.addEventListener('click', function () {
            currentCalendarYear++;
            renderCalendarUI();
        });
    }

    if (actPrevBtn && actNextBtn) {
        actPrevBtn.addEventListener('click', function () {
            currentActivityDateOffset--;
            renderActivityFormUI();
        });

        actNextBtn.addEventListener('click', function () {
            if (currentActivityDateOffset < 0) {
                currentActivityDateOffset++;
                renderActivityFormUI();
            }
        });
    }

    renderActivityFormUI();

    // --- Global Save State Helpers ---
    function getSaveData() {
        const defaultData = {
            hero_name: "",
            hero_class: "",
            user_theme: "theme-modern",
            activity_group: "original",
            last_dawn_rest: "",
            active_day_tally: { exercise: 0, chores: 0, reading: 0, work: 0, movie: 0, todo: 0 },
            eternal_chronicles: [],
            adventure_state: null,
            friends_list: [],
            stats: null,
            inventory: [],
            equipped: { weapon: null, armor: null, accessory: null },
            quest_items: [],
            wardens_key: false,
            pachinko_tokens: 0,
            opened_chests: {},
            // --- Folded into the main save (formerly separate localStorage keys) ---
            fog_master: {},        // { [mapId]: [exploredTile, ...] }
            fog_decay: 0,          // ms timestamp of last daily decay
            personal_scroll: null  // tile coord string like "82,71", or null after pickup
        };

        let savedData = JSON.parse(localStorage.getItem('motivation_RPG'));
        if (!savedData) return defaultData;

        // SAVE FILE PATCH: Retroactively apply stats to existing characters
        if (!savedData.stats && savedData.hero_class) {
            savedData.stats = heroClasses[savedData.hero_class].stats;
        }

        // NEW PATCH: Ensure current HP and Energy exist
        if (savedData.stats) {
            const maxHp = 50 + (savedData.stats.vit * 10);
            const maxEnergy = 50 + (savedData.stats.end * 5);
            if (savedData.stats.current_hp === undefined) savedData.stats.current_hp = maxHp;
            if (savedData.stats.current_energy === undefined) savedData.stats.current_energy = maxEnergy;

            // Level patch
            if (savedData.stats.level === undefined) savedData.stats.level = 1;
            if (savedData.stats.xp === undefined) savedData.stats.xp = 0;
            if (Number.isNaN(savedData.stats.xp)) savedData.stats.xp = 0;
            if (savedData.stats.unspent_points === undefined) savedData.stats.unspent_points = 0;
            // Equipment Patch
            if (savedData.equipped === undefined) {
                savedData.equipped = { weapon: null, armor: null, accessory: null };
            }

            // Quest Items Patch
            if (!savedData.quest_items) savedData.quest_items = [];

            // Fate Coins Patch (legacy field — retained for backward compat)
            if (savedData.fate_coins === undefined) savedData.fate_coins = 0;

            // --- Warden's Key & Pachinko Token Patch -------------------------
            // The Warden's Key unlocks the Mini-Games tab (one-time gift from
            // the Mysterious Wizard).  Pachinko tokens are spent per drop and
            // earned at 1 per 10 XP after the key is owned.
            if (savedData.wardens_key === undefined) savedData.wardens_key = false;
            if (savedData.pachinko_tokens === undefined) savedData.pachinko_tokens = 0;

            // Migrate older saves: anyone who collected a Fate Coin under the
            // old system automatically receives the key.  Their leftover coins
            // are converted to pachinko tokens 1-for-1 so progress isn't lost.
            if (!savedData.wardens_key && (savedData.fate_coins || 0) > 0) {
                savedData.wardens_key = true;
                savedData.pachinko_tokens = (savedData.pachinko_tokens || 0) + savedData.fate_coins;
                savedData.fate_coins = 0;
            }

            // Retroactively assign stat targets to older items
            if (savedData.inventory) {
                savedData.inventory.forEach(item => {
                    if (!item.targetStat) {
                        if (item.type === 'weapon') item.targetStat = 'str';
                        else if (item.type === 'armor') item.targetStat = 'def';
                        else item.targetStat = ['str', 'def', 'vit', 'int', 'end'][Math.floor(Math.random() * 5)];
                    }
                });
            }

            if (!savedData.opened_chests) savedData.opened_chests = {};
            window.myOpenedChests = savedData.opened_chests;

            // --- New-fields patch (folded-in keys) -----------------------
            // Default the three new top-level fields if this save predates them.
            if (savedData.fog_master === undefined)     savedData.fog_master = {};
            if (savedData.fog_decay === undefined)      savedData.fog_decay = 0;
            if (savedData.personal_scroll === undefined) savedData.personal_scroll = null;

            // --- One-time legacy-key migration ---------------------------
            // Earlier versions stored these three pieces of state in their own
            // localStorage keys, scoped by hero_name.  Fold any surviving
            // values into the main save and remove the legacy keys so the
            // user ends up with a single entry going forward.
            if (savedData.hero_name) {
                const _legacyFogKey    = 'rpg_fog_master_' + savedData.hero_name;
                const _legacyDecayKey  = 'fog_decay_' + savedData.hero_name;
                const _legacyScrollKey = 'rpg_personal_scroll_' + savedData.hero_name;

                const _legacyFog = localStorage.getItem(_legacyFogKey);
                if (_legacyFog !== null) {
                    try {
                        const parsed = JSON.parse(_legacyFog);
                        // Only overwrite if the new field is empty — never clobber fresher data.
                        if (parsed && typeof parsed === 'object' && Object.keys(savedData.fog_master).length === 0) {
                            savedData.fog_master = parsed;
                        }
                    } catch (_e) { /* corrupt legacy value — drop it */ }
                    localStorage.removeItem(_legacyFogKey);
                }

                const _legacyDecay = localStorage.getItem(_legacyDecayKey);
                if (_legacyDecay !== null) {
                    const n = parseInt(_legacyDecay, 10);
                    if (!Number.isNaN(n) && n > savedData.fog_decay) savedData.fog_decay = n;
                    localStorage.removeItem(_legacyDecayKey);
                }

                const _legacyScroll = localStorage.getItem(_legacyScrollKey);
                if (_legacyScroll !== null) {
                    if (!savedData.personal_scroll) savedData.personal_scroll = _legacyScroll;
                    localStorage.removeItem(_legacyScrollKey);
                }

                // Persist the migrated save so the next read sees the consolidated shape.
                localStorage.setItem('motivation_RPG', JSON.stringify(savedData));
            }
        }



        return savedData;
    }

    function updateSaveData(newData) {
        window.myOpenedChests = newData.opened_chests || {};   // <-- ADD
        localStorage.setItem('motivation_RPG', JSON.stringify(newData));

        if (newData.hero_name) {
            const publicData = {
                hero_name: newData.hero_name,
                hero_class: newData.hero_class,
                active_day_tally: newData.active_day_tally,
                stats: newData.stats,
                equipped: newData.equipped || null,
                eternal_chronicles: newData.eternal_chronicles || [],
                last_active: new Date().toISOString()
            };

            db.ref('heroes/' + newData.hero_name.toLowerCase())
                .update(publicData)
                .catch(err => {
                    console.error("Failed to sync hero to realm:", err);
                });
        }
    }

    // --- NEW: MASTER FOG SAVER ---
    function saveFogData() {
        let data = getSaveData();
        if (!data.hero_name) return;

        // FIX: Pull the LIVE fog directly from the game engine
        if (window.gameEngine) {
            if (!data.fog_master) data.fog_master = {};
            data.fog_master[currentMapId] = Array.from(window.gameEngine.exploredTiles);

            // --- NEW: FAST-CACHE EXACT PIXEL POSITION ---
            if (!data.adventure_state) data.adventure_state = {};
            data.adventure_state.last_x = window.gameEngine.player.x;
            data.adventure_state.last_y = window.gameEngine.player.y;
            data.adventure_state.last_map = currentMapId;
        }

        // SAFEGUARD: Prevent LocalStorage 5MB quota errors by pruning old caves
        let savedMaps = Object.keys(data.fog_master || {});
        if (savedMaps.length > 15) {
            let staleMap = savedMaps.find(k => k !== 'overworld' && k !== currentMapId);
            if (staleMap) delete data.fog_master[staleMap];
        }

        // Save synchronously so the browser closure doesn't interrupt it
        localStorage.setItem('motivation_RPG', JSON.stringify(data));
    }

    function applyGlobalFogDecay(heroName) {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        let data = getSaveData();
        if (!data.hero_name) return;

        let lastDecay = data.fog_decay || 0;
        let now = Date.now();

        // If 24 hours have passed since the last chop...
        if (now - lastDecay >= ONE_DAY_MS) {
            let masterFog = data.fog_master || {};
            let didDecay = false;

            // Loop through the overworld and all saved caves
            for (let mapId in masterFog) {
                let exploredArray = masterFog[mapId];
                if (exploredArray && exploredArray.length > 1) {
                    // Figure out exactly half the tiles
                    let tilesToKeep = Math.ceil(exploredArray.length / 2);

                    // Slice the end of the array (keeping the newest tiles)
                    masterFog[mapId] = exploredArray.slice(-tilesToKeep);
                    didDecay = true;
                }
            }

            if (didDecay) {
                data.fog_master = masterFog;
                console.log("Daily fog decay applied. Oldest paths forgotten.");
            }

            // Record today's decay timestamp and persist (single write)
            data.fog_decay = now;
            localStorage.setItem('motivation_RPG', JSON.stringify(data));
        }
    }

    // --- UI Update Helpers ---
    function updateStatusLog(message) {
        const statusContent = document.getElementById('status-content');
        if (!statusContent) return; // Failsafe in case the UI isn't loaded

        // Create a new paragraph for the message
        const newEntry = document.createElement('p');
        newEntry.style.color = 'var(--text-dim)';
        newEntry.style.fontSize = '0.85rem';
        newEntry.style.margin = '0 0 5px 0';
        newEntry.innerText = message;

        // Add it to the log
        statusContent.appendChild(newEntry);

        // Automatically scroll to the bottom
        statusContent.scrollTop = statusContent.scrollHeight;
    }

    function updateAdventureHUD() {
        let data = getSaveData();
        if (!data || !data.stats) return;

        let hud = document.getElementById('adventure-hud');
        if (!hud) {
            const viewport = document.getElementById('viewport-container');
            if (!viewport) return;

            // Create the HUD overlay dynamically
            hud = document.createElement('div');
            hud.id = 'adventure-hud';
            hud.style.cssText = "position: absolute; top: 15px; left: 15px; z-index: 100; display: flex; flex-direction: column; gap: 10px; width: 220px; pointer-events: none;";

            hud.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.85); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #fff; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">
                    <span>HP</span> <span id="hud-hp-text"></span>
                </div>
                <div style="height: 10px; background: rgba(0,0,0,0.6); border-radius: 5px; overflow: hidden; border: 1px solid #000;">
                    <div id="hud-hp-fill" style="height: 100%; background: linear-gradient(90deg, #b91c1c, #ef4444); width: 100%; transition: width 0.2s ease-out;"></div>
                </div>
            </div>
            <div style="background: rgba(15, 23, 42, 0.85); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #fff; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">
                    <span>ENERGY</span> <span id="hud-energy-text"></span>
                </div>
                <div style="height: 10px; background: rgba(0,0,0,0.6); border-radius: 5px; overflow: hidden; border: 1px solid #000;">
                    <div id="hud-energy-fill" style="height: 100%; background: linear-gradient(90deg, #0284c7, #38bdf8); width: 100%; transition: width 0.2s ease-out;"></div>
                </div>
            </div>
            <div id="hud-heal-btn-wrap" style="pointer-events: all;">
                <button id="hud-heal-btn" onclick="window.healPlayer()" style="
                    width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid #10b981;
                    background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.75rem;
                    font-weight: bold; letter-spacing: 0.5px; cursor: pointer;
                    transition: background 0.15s, opacity 0.15s;
                " onmouseover="if(!this.disabled)this.style.background='rgba(16,185,129,0.3)'"
                   onmouseout="if(!this.disabled)this.style.background='rgba(16,185,129,0.15)'">
                    💚 Heal
                </button>
            </div>
        `;
            viewport.appendChild(hud);
        }

        if (inEncounter) {
            hud.style.display = 'none';
            return; // No need to update the math if it's hidden
        } else {
            hud.style.display = 'flex';
        }

        const maxHp = 50 + (getTotalStat(data, 'vit') * 10);
        const maxEnergy = 20 + (getTotalStat(data, 'end') * 5);

        const hpPercent = Math.max(0, Math.min(100, (data.stats.current_hp / maxHp) * 100));

        // Use LIVE engine energy for the HUD if engine is running
        const liveEnergy = (window.gameEngine && window.gameEngine.currentEnergy !== null)
            ? window.gameEngine.currentEnergy
            : data.stats.current_energy;
        const isExhausted = window.gameEngine && window.gameEngine.isExhausted;
        const energyPercent = Math.max(0, Math.min(100, (liveEnergy / maxEnergy) * 100));

        document.getElementById('hud-hp-text').textContent = `${Math.floor(data.stats.current_hp)} / ${maxHp}`;
        document.getElementById('hud-hp-fill').style.width = `${hpPercent}%`;

        document.getElementById('hud-energy-text').textContent = `${Math.floor(liveEnergy)} / ${maxEnergy}`;
        document.getElementById('hud-energy-fill').style.width = `${energyPercent}%`;

        // Update energy bar color based on level
        const energyFill = document.getElementById('hud-energy-fill');
        if (energyFill) {
            if (isExhausted) {
                energyFill.style.background = 'linear-gradient(90deg, #374151, #6b7280)';
            } else if (energyPercent < 25) {
                energyFill.style.background = 'linear-gradient(90deg, #b45309, #fbbf24)';
            } else {
                energyFill.style.background = 'linear-gradient(90deg, #0284c7, #38bdf8)';
            }
        }

        // --- HEAL BUTTON STATE ---
        const healBtn = document.getElementById('hud-heal-btn');
        if (healBtn) {
            const rawHeal = Math.floor(10 + getTotalStat(data, 'int') * 2);
            const actualHeal = Math.min(rawHeal, maxHp - data.stats.current_hp);
            const healCost = Math.max(1, Math.ceil(actualHeal / 2));
            const canHeal = actualHeal > 0 && liveEnergy >= healCost && !isExhausted;

            healBtn.disabled = !canHeal;
            if (canHeal) {
                healBtn.style.opacity = '1';
                healBtn.style.cursor = 'pointer';
                healBtn.style.borderColor = '#10b981';
                healBtn.style.color = '#10b981';
                healBtn.innerHTML = `💚 Heal (+${actualHeal} HP, −${healCost} ⚡)`;
            } else {
                healBtn.style.opacity = '0.4';
                healBtn.style.cursor = 'not-allowed';
                healBtn.style.background = 'rgba(16,185,129,0.05)';
                const reason = actualHeal <= 0 ? 'HP Full' : 'Not Enough Energy';
                healBtn.innerHTML = `💚 Heal <span style="font-size:0.7rem; opacity:0.8;">(${reason})</span>`;
            }
        }

        // --- EXHAUSTION OVERLAY ---
        const viewport2 = document.getElementById('viewport-container');
        let exhaustBanner = document.getElementById('exhaustion-banner');
        if (isExhausted) {
            if (!exhaustBanner && viewport2) {
                exhaustBanner = document.createElement('div');
                exhaustBanner.id = 'exhaustion-banner';
                exhaustBanner.innerHTML = `
                    <div class="exhaustion-inner">
                        <div class="exhaustion-icon">😮‍💨</div>
                        <div class="exhaustion-title">You're Exhausted</div>
                        <div class="exhaustion-body">Your body is spent for today. Log your activities to restore energy — rewards arrive at 2&nbsp;AM&nbsp;tomorrow.</div>
                        <button class="exhaustion-cta" onclick="(function(){ document.querySelector('[data-tab=activities]').click(); })()">
                            ⚡ Log Activities
                        </button>
                    </div>
                `;
                viewport2.appendChild(exhaustBanner);
            }
            if (exhaustBanner) exhaustBanner.style.display = 'flex';
        } else {
            if (exhaustBanner) exhaustBanner.style.display = 'none';
        }
    }

    window.healPlayer = function () {
        if (inEncounter) return; // Safety: no healing mid-combat
        let data = getSaveData();
        if (!data || !data.stats) return;

        const maxHp = 50 + (getTotalStat(data, 'vit') * 10);
        const rawHeal = Math.floor(10 + getTotalStat(data, 'int') * 2);
        const actualHeal = Math.min(rawHeal, maxHp - data.stats.current_hp);
        const healCost = Math.max(1, Math.ceil(actualHeal / 2));

        const liveEnergy = (window.gameEngine && window.gameEngine.currentEnergy !== null)
            ? window.gameEngine.currentEnergy
            : data.stats.current_energy;

        if (actualHeal <= 0) {
            updateStatusLog("💚 You're already at full health.");
            return;
        }
        if (liveEnergy < healCost) {
            updateStatusLog(`💚 Not enough energy to heal. Need ${healCost} ⚡, have ${Math.floor(liveEnergy)}.`);
            return;
        }

        // Apply heal
        data.stats.current_hp = Math.min(maxHp, data.stats.current_hp + actualHeal);

        // Deduct energy from both live engine tracker and save data
        if (window.gameEngine && window.gameEngine.currentEnergy !== null) {
            window.gameEngine.currentEnergy = Math.max(0, window.gameEngine.currentEnergy - healCost);
            if (window.gameEngine.currentEnergy <= 0) window.gameEngine.isExhausted = true;
        }
        data.stats.current_energy = Math.max(0, (data.stats.current_energy || 0) - healCost);

        updateSaveData(data);
        updateAdventureHUD();
        updateCharacterTabUI();
        updateStatusLog(`💚 You rested and recovered ${actualHeal} HP (−${healCost} ⚡).`);
    };

    function updateProfileUI() {
        const data = getSaveData();

        // Target the top-left sidebar elements
        const sidebarAvatar = document.querySelector('.profile-mini .avatar-placeholder');
        const sidebarUsername = document.querySelector('.profile-mini .username');
        const sidebarLevel = document.querySelector('.profile-mini .level');

        if (sidebarAvatar && data.hero_class) {
            sidebarAvatar.id = 'sidebar-portrait';
            sidebarAvatar.innerHTML = '';
            updatePortraitUI('sidebar-portrait', data.hero_class, data.stats.level);
        }

        if (sidebarUsername && data.hero_name) {
            sidebarUsername.textContent = data.hero_name;
        }

        if (sidebarLevel && data.stats && data.stats.level !== undefined) {
            const currentXP = data.stats.xp || 0;
            const requiredXP = data.stats.level * 100;
            const xpPercent = Math.min(100, Math.max(0, (currentXP / requiredXP) * 100));

            sidebarLevel.innerHTML = `
                Level ${data.stats.level}
                <div class="sidebar-xp-container">
                    <div class="sidebar-xp-fill" style="width: ${xpPercent}%;"></div>
                    <div class="sidebar-xp-text">${currentXP} / ${requiredXP} XP</div>
                </div>
            `;
        }
    }

    function updateCharacterTabUI() {
        const data = getSaveData();
        const statsPanel = document.getElementById('character-stats-panel');
        const portraitBox = document.getElementById('char-tab-portrait');

        if (portraitBox && data.hero_class) {
            portraitBox.innerHTML = '';
            updatePortraitUI('char-tab-portrait', data.hero_class, data.stats.level);
        }

        if (!statsPanel || !data.stats) return;

        // 1. Calculate Equipment Bonuses
        let eq = data.equipped || { weapon: null, armor: null, accessory: null };
        let bonuses = { str: 0, def: 0, vit: 0, int: 0, end: 0 };

        Object.values(eq).forEach(item => {
            if (item && item.targetStat) {
                bonuses[item.targetStat] += item.statBonus;
            }
        });

        // 2. Calculate True Totals
        let totalStr = data.stats.str + bonuses.str;
        let totalDef = data.stats.def + bonuses.def;
        let totalVit = data.stats.vit + bonuses.vit;
        let totalInt = data.stats.int + bonuses.int;
        let totalEnd = data.stats.end + bonuses.end;

        // 3. Derived Combat Stats
        const maxHp = 50 + (totalVit * 10);
        const maxEnergy = 20 + (totalEnd * 5);

        data.stats.current_hp = Math.min(data.stats.current_hp, maxHp);
        data.stats.current_energy = Math.min(data.stats.current_energy, maxEnergy);

        const requiredXP = data.stats.level * 100;
        const xpPercent = Math.min(100, Math.max(0, (data.stats.xp / requiredXP) * 100));

        const formatStat = (base, bonus) => bonus > 0 ? `${base + bonus} <span style="color:#10b981; font-size:0.8rem;">(+${bonus})</span>` : `${base}`;

        statsPanel.innerHTML = `
            <div class="xp-wrapper">
                <div class="level-title">Level ${data.stats.level}</div>
                <div class="xp-container">
                    <div class="xp-fill" style="width: ${xpPercent}%;"></div>
                    <div class="xp-text">${data.stats.xp} / ${requiredXP} XP</div>
                </div>
            </div>

            <div class="vitals-layout">
                <div class="vital-card vital-hp">
                    <span class="vital-label">HP</span>
                    <span class="vital-value">${data.stats.current_hp} / ${maxHp}</span>
                </div>
                <div class="vital-card vital-energy">
                    <span class="vital-label">ENERGY</span>
                    <span class="vital-value">${data.stats.current_energy} / ${maxEnergy}</span>
                </div>
            </div>

            ${data.stats.unspent_points > 0 ? `
                <div style="text-align: center; color: var(--accent-color); font-weight: bold; margin-bottom: 15px; padding: 10px; background: rgba(56, 189, 248, 0.1); border-radius: 8px; border: 1px solid var(--accent-color);">
                    You have ${data.stats.unspent_points - pendingPointsUsed > 0 ? `${data.stats.unspent_points - pendingPointsUsed} Unspent Stat Point${data.stats.unspent_points - pendingPointsUsed > 1 ? 's' : ''}` : 'points ready to save'}!
                </div>
            ` : ''}

            <h3 style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Core Attributes</h3>
            
            ${[
                { key: 'str', label: 'Strength (STR)', desc: 'Attack Damage', base: data.stats.str, bonus: bonuses.str },
                { key: 'def', label: 'Defense (DEF)', desc: 'Damage Reduction', base: data.stats.def, bonus: bonuses.def },
                { key: 'end', label: 'Endurance (END)', desc: 'Max Energy Baseline', base: data.stats.end, bonus: bonuses.end },
                { key: 'vit', label: 'Vitality (VIT)', desc: 'Max Health Baseline', base: data.stats.vit, bonus: bonuses.vit },
                { key: 'int', label: 'Intelligence (INT)', desc: 'Activity Energy Yield', base: data.stats.int, bonus: bonuses.int }
            ].map(s => {
                const pending = pendingStatAllocations[s.key] || 0;
                const availablePoints = data.stats.unspent_points - pendingPointsUsed;
                const displayVal = s.bonus > 0
                    ? `${s.base + s.bonus} <span style="color:#10b981; font-size:0.8rem;">(+${s.bonus})</span>`
                    : `${s.base}`;
                const pendingTag = pending > 0 ? `<span class="stat-pending-val">+${pending}</span>` : '';
                const plusBtn = data.stats.unspent_points > 0
                    ? `<button class="stat-alloc-btn plus"  onclick="allocateStatPoint('${s.key}')"   ${availablePoints <= 0 ? 'disabled' : ''}>+</button>`
                    : '';
                const minusBtn = pending > 0
                    ? `<button class="stat-alloc-btn minus" onclick="deallocateStatPoint('${s.key}')">−</button>`
                    : '';
                return `
                <div class="stat-row">
                    <span>${s.label} <small style="color:var(--text-dim); display:block; font-size: 0.75rem;">${s.desc}</small></span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="stat-val">${displayVal}</span>
                        ${pendingTag}
                        ${minusBtn}
                        ${plusBtn}
                    </div>
                </div>`;
            }).join('')}

            ${pendingPointsUsed > 0 ? `
                <button class="save-attrs-btn" onclick="saveStatAllocations()">
                    ✔ Save Attributes
                </button>
            ` : ''}
        `;

        // Update Character-tab notification dot
        const charBadge = document.getElementById('character-tab-badge');
        if (charBadge) {
            if (data.stats.unspent_points > 0) {
                charBadge.classList.add('visible');
            } else {
                charBadge.classList.remove('visible');
            }
        }

        // 4. Render Equipped Items
        const renderSlot = (slotId, itemObj, defaultText, iconHtml) => {
            const slotEl = document.getElementById(slotId);
            if (slotEl) {
                if (itemObj) {
                    const itemColor = itemObj.color || "var(--accent-color)";
                    const itemGlow = itemObj.glow || "none";

                    slotEl.innerHTML = `<div style="font-size:1.8rem; margin-bottom:5px; text-shadow: ${itemGlow !== 'none' ? itemGlow : 'none'};">${itemObj.icon}</div>
                                        <div style="font-size:0.7rem; line-height:1; color: ${itemColor}; font-weight: bold;">${itemObj.name}<br><span style="color:#10b981; font-weight: normal;">+${itemObj.statBonus} ${itemObj.targetStat.toUpperCase()}</span></div>`;
                    slotEl.style.borderColor = itemColor;
                    slotEl.style.boxShadow = itemGlow;
                    slotEl.style.cursor = "pointer";
                    slotEl.title = "Click to unequip";
                } else {
                    slotEl.innerHTML = `${iconHtml} ${defaultText}`;
                    slotEl.style.borderColor = "var(--border-color)";
                    slotEl.style.boxShadow = "none";
                    slotEl.style.cursor = "default";
                    slotEl.title = "";
                }
            }
        };

        renderSlot('slot-weapon', eq.weapon, 'Weapon', '<i class="fas fa-sword"></i>');
        renderSlot('slot-armor', eq.armor, 'Armor', '<i class="fas fa-shield"></i>');
        renderSlot('slot-accessory', eq.accessory, 'Accessory', '<i class="fas fa-ring"></i>');

        // 5. Render Clickable Inventory
        const inventoryPanel = document.getElementById('inventory-panel');
        if (inventoryPanel && data.inventory) {
            if (data.inventory.length === 0) {
                inventoryPanel.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-dim); text-align: center; font-size: 0.85rem;">Your bag is empty. Go fight some monsters!</div>';
            } else {
                // Apply sorting
                let sorted = [...data.inventory];
                if (_inventorySort === 'type') {
                    const typeOrder = { weapon: 0, armor: 1, accessory: 2 };
                    sorted.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
                } else if (_inventorySort === 'stat-desc') {
                    sorted.sort((a, b) => (b.statBonus || 0) - (a.statBonus || 0));
                } else if (_inventorySort === 'stat-asc') {
                    sorted.sort((a, b) => (a.statBonus || 0) - (b.statBonus || 0));
                }

                inventoryPanel.innerHTML = sorted.map(item => {
                    const itemColor = item.color || "var(--border-color)";
                    const itemGlow = item.glow || "none";
                    const deleteClass = _inventoryDeleteMode ? ' delete-mode' : '';
                    const clickHandler = _inventoryDeleteMode
                        ? `deleteInventoryItem('${item.id}')`
                        : `equipItem('${item.id}')`;
                    const titleText = _inventoryDeleteMode
                        ? `Discard ${item.name}`
                        : `Equip ${item.name} (+${item.statBonus} ${item.targetStat.toUpperCase()})`;
                    return `
                    <div class="inventory-item${deleteClass}" style="border-color: ${itemColor}; box-shadow: ${itemGlow};" title="${titleText}" onclick="${clickHandler}">
                        <div style="font-size: 1.5rem; text-shadow: ${itemGlow !== 'none' ? itemGlow : 'none'};">${item.icon}</div>
                        <span style="bottom: 20px;">+${item.statBonus}</span>
                        <span style="color: ${itemColor};">${item.targetStat.toUpperCase()}</span>
                    </div>
                `}).join('');
            }
        }

        // Refresh quest log if its sub-tab is currently visible
        const questView = document.getElementById('char-view-quest');
        if (questView && questView.classList.contains('active')) {
            const questLogContainer = document.getElementById('quest-log-panel');
            if (questLogContainer) questLogContainer.innerHTML = renderQuestLog();
        }
    }

    // --- Character Sub-Tab Switch ---
    window.switchCharTab = function (tabId) {
        document.querySelectorAll('.char-subtab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.char-sub-view').forEach(view => view.classList.remove('active'));

        const btn = document.getElementById('char-btn-' + tabId);
        const view = document.getElementById('char-view-' + tabId);
        if (btn) btn.classList.add('active');
        if (view) view.classList.add('active');

        // Always refresh the quest log when switching to it
        if (tabId === 'quest') {
            const questLogContainer = document.getElementById('quest-log-panel');
            if (questLogContainer) questLogContainer.innerHTML = renderQuestLog();
        }
    };

    // --- Navigation Logic ---
    function switchTab(tabId) {
        navItems.forEach(function (item) {
            item.classList.remove('active');
        });

        tabContents.forEach(function (content) {
            content.classList.remove('active');
        });

        const activeItem = document.querySelector(`[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(tabId);

        if (activeItem && activeContent) {
            activeItem.classList.add('active');
            activeContent.classList.add('active');
        }

        if (tabId === 'stats') {
            renderStatsCharts();
            renderRecordsUI();
            renderCalendarUI();
            renderGratitudeLog();
        }
    }

    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            switchTab(item.getAttribute('data-tab'));
        });
    });

    themeSelectors.forEach(function (item) {
        item.addEventListener('change', function (e) {
            setTheme(e.target.value);
        });
    });

    if (simpleFogToggle) {
        simpleFogToggle.addEventListener('change', function (e) {
            let data = getSaveData();
            data.simple_fog = e.target.checked;
            cachedSimpleFog = data.simple_fog; // Update cache
            updateSaveData(data);
        });
    }

    if (softFogToggle) {
        softFogToggle.addEventListener('change', function (e) {
            let data = getSaveData();
            data.soft_fog = e.target.checked;
            cachedSoftFog = data.soft_fog; // Update cache
            updateSaveData(data);
        });
    }
    // --- Theme Management ---
    function setTheme(themeName) {
        document.body.className = themeName;
        let data = getSaveData();
        data.user_theme = themeName;
        updateSaveData(data);

        if (themeSelectors) {
            themeSelectors.value = themeName;
        }
    }

    function syncThemeDropdowns() {
        const data = getSaveData();
        const activeTheme = data.user_theme || 'theme-modern';

        const themeSelectors = document.querySelectorAll('.theme-selector');
        themeSelectors.forEach(select => {
            if (select) {
                select.value = activeTheme;
            }
        });
    }

    // --- Persistence and Date Checking ---
    function checkDateAndLoadData() {
        const today = new Date().toLocaleDateString();
        let data = getSaveData();

        if (data.last_dawn_rest !== today) {
            data.last_dawn_rest = today;
            data.active_day_tally = { exercise: 0, chores: 0, reading: 0, work: 0, movie: 0, todo: 0 };
            updateSaveData(data);
        }

        // Delegate actual input population to renderActivityFormUI (which is group-aware)
        renderActivityFormUI();
    }

    // --- Activity Submission (Daily Update) ---
    if (activityForm) {
        activityForm.addEventListener('submit', function (e) {
            e.preventDefault();

            let targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + currentActivityDateOffset);
            const logDate = targetDate.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });

            let data = getSaveData();

            const group = ACTIVITY_GROUPS[data.activity_group] || ACTIVITY_GROUPS['original'];
            const todaysDeeds = {};
            let pendingXP = 0;

            group.activities.forEach(act => {
                const val = parseInt(document.getElementById(act.id)?.value) || 0;
                todaysDeeds[act.key] = val;
                pendingXP += val * act.xpRate;
            });

            // --- GRATITUDE BONUS: +5 XP for filling out the gratitude field ---
            const gratitudeText = (document.getElementById('act-gratitude-input')?.value || '').trim();
            if (gratitudeText.length > 0) pendingXP += 5;

            // Weekends grant half XP
            const _logDay = new Date(logDate).getDay();
            const _isWeekend = _logDay === 0 || _logDay === 6;
            if (_isWeekend) pendingXP *= 0.5;

            pendingXP = Math.floor(pendingXP);

            // --- COMPUTE ENERGY GAIN (matches XP earned, capped at player's max energy) ---
            const maxEnergy = 20 + (getTotalStat(data, 'end') * 5);
            const pendingEnergy = Math.min(pendingXP, maxEnergy);
            const existingIndex = data.eternal_chronicles.findIndex(entry => entry.date === logDate);
            if (existingIndex !== -1) {
                data.eternal_chronicles[existingIndex].stats = todaysDeeds;
                data.eternal_chronicles[existingIndex].gratitude = gratitudeText;
            } else {
                data.eternal_chronicles.unshift({ date: logDate, stats: todaysDeeds, gratitude: gratitudeText });
                data.eternal_chronicles.sort((a, b) => new Date(b.date) - new Date(a.date));
            }

            if (currentActivityDateOffset === 0) {
                data.last_dawn_rest = logDate;
            }

            // --- STORE PENDING REWARD (XP + energy applied after 2 AM CST next day) ---
            // Calculate unlock timestamp: 2 AM CST on the day after the log date
            const logDateObj = new Date(logDate);
            const unlockDay = new Date(logDateObj);
            unlockDay.setDate(unlockDay.getDate() + 1);
            // 2 AM CST = UTC-6 → 8 AM UTC; 2 AM CDT = UTC-5 → 7 AM UTC
            const month = unlockDay.getMonth() + 1;
            const isDST = month >= 3 && month <= 11; // Approximate DST
            unlockDay.setUTCHours(isDST ? 7 : 8, 0, 0, 0);
            const unlockTimestamp = unlockDay.getTime();

            if (!data.pending_rewards) data.pending_rewards = [];

            // Remove any existing pending reward for this date before adding
            data.pending_rewards = data.pending_rewards.filter(r => r.date !== logDate);
            data.pending_rewards.push({
                date: logDate,
                xp: pendingXP,
                energyGain: pendingEnergy,
                unlockTimestamp: unlockTimestamp
            });

            updateSaveData(data);
            renderActivityLog();
            updateCharacterTabUI();
            updateProfileUI();

            if (document.getElementById('stats').classList.contains('active')) {
                renderStatsCharts();
                renderRecordsUI();
                renderCalendarUI();
            }

            // Show a "banked" message instead of instant XP alert
            const unlockDateLabel = unlockDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' });
            showActivityBankedToast(pendingXP, pendingEnergy, unlockDateLabel);
        });
    }

    // --- Render Log ---
    function renderActivityLog() {
        const data = getSaveData();
        if (!activityLogContainer) return;

        if (window.myActivityWeekOffset === undefined) window.myActivityWeekOffset = 0;

        let today = new Date();
        let dayOfWeek = today.getDay();

        let startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek + (window.myActivityWeekOffset * 7));
        startOfWeek.setHours(0, 0, 0, 0);

        let endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        let formatOpts = { month: 'short', day: 'numeric' };
        let dateRangeString = `${startOfWeek.toLocaleDateString('en-US', formatOpts)} - ${endOfWeek.toLocaleDateString('en-US', formatOpts)}`;

        let weekTitle = "This Week";
        if (window.myActivityWeekOffset !== 0 && data.eternal_chronicles && data.eternal_chronicles.length > 0) {
            let oldestDate = new Date();
            data.eternal_chronicles.forEach(entry => {
                let d = new Date(entry.date);
                if (d < oldestDate) oldestDate = d;
            });

            let firstWeekStart = new Date(oldestDate);
            firstWeekStart.setDate(oldestDate.getDate() - oldestDate.getDay());
            firstWeekStart.setHours(0, 0, 0, 0);

            let msDiff = startOfWeek.getTime() - firstWeekStart.getTime();
            let weekNum = Math.floor(msDiff / (1000 * 60 * 60 * 24 * 7)) + 1;
            weekTitle = `Week ${Math.max(1, weekNum)}`;
        }

        let pageLogs = [];
        if (data.eternal_chronicles && data.eternal_chronicles.length > 0) {
            pageLogs = data.eternal_chronicles.filter(entry => {
                let eDate = new Date(entry.date);
                return eDate >= startOfWeek && eDate <= endOfWeek;
            });
        }

        const canGoForward = window.myActivityWeekOffset < 0;
        const canGoBack = data.eternal_chronicles && data.eternal_chronicles.some(entry => new Date(entry.date) < startOfWeek);

        let html = `
            <div class="calendar-header" style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                <button type="button" class="cal-nav-btn" style="visibility: ${canGoBack ? 'visible' : 'hidden'};" onclick="changeMyLogWeek(-1)"><i class="fas fa-chevron-left"></i></button>
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <h2 style="font-size: 1.1rem; margin: 0; color: var(--text-main); letter-spacing: 1px;">${weekTitle}</h2>
                    <span style="font-size: 0.75rem; color: var(--text-dim);">${dateRangeString}</span>
                </div>
                <button type="button" class="cal-nav-btn" style="visibility: ${canGoForward ? 'visible' : 'hidden'};" onclick="changeMyLogWeek(1)"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;"> 
        `;

        if (pageLogs.length === 0) {
            html += `<div class="no-data-msg" style="border: none;">No activity recorded for this week.</div>`;
        } else {
            pageLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
            html += pageLogs.map(entry => window.renderLogEntryHTML(entry)).join('');
        }

        html += `</div>`;
        activityLogContainer.innerHTML = html;
    }

    window.renderLogEntryHTML = function (entry) {
        const s = entry.stats || {};

        let eDate = new Date(entry.date);
        let dayName = eDate.toLocaleDateString('en-US', { weekday: 'long' });

        const statItems = Object.entries(s)
            .filter(([key, val]) => STAT_META[key] && val > 0)
            .map(([key, val]) => {
                const meta = STAT_META[key];
                const display = meta.unit ? `${val} ${meta.unit}` : `${val}`;
                return `<div style="display: flex; align-items: center; gap: 6px;"><i class="${meta.icon}" style="color: var(--accent-color);"></i><span style="font-family: 'Courier New', monospace; font-weight: bold; color: var(--text-main);">${display}</span></div>`;
            }).join('');

        return `
            <div class="log-entry" style="background: transparent; border: none; border-bottom: 1px dashed var(--border-color); border-radius: 0; padding: 0 0 10px 0; margin-bottom: 0;">
                <div style="font-weight: bold; color: var(--text-main); font-size: 0.95rem; margin-bottom: 8px;">
                    ${dayName}, ${entry.date}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.85rem; color: var(--text-dim);">
                    ${statItems || '<span style="color: var(--text-dim);">No activity logged.</span>'}
                </div>
            </div>
        `;
    };

    // --- Statistics & Charting Engine ---
    function renderStatsCharts() {
        const data = getSaveData();
        if (!data || !data.eternal_chronicles || data.eternal_chronicles.length === 0) return;

        const chronologicalLogs = [...data.eternal_chronicles].reverse();

        let labelsTotal = [0];
        let labelsDaily = [];

        let totalXpData = [0];
        let dailyXpData = [];
        let cumulativeXP = 0;

        let activityTimeTotals = {};
        let xpSourceTotals = {};

        const group = getActiveGroup();
        group.activities.forEach(act => {
            if (act.unit.toLowerCase().includes('minute')) activityTimeTotals[act.key] = 0;
            xpSourceTotals[act.key] = 0;
        });

        chronologicalLogs.forEach((entry, index) => {
            let dayNum = index + 1;
            labelsTotal.push(dayNum);
            labelsDaily.push(dayNum);

            const s = entry.stats || {};
            let dayXp = calculateXpFromStats(s, entry.date);
            cumulativeXP += dayXp;

            dailyXpData.push(dayXp);
            totalXpData.push(cumulativeXP);

            group.activities.forEach(act => {
                const val = s[act.key] || 0;
                if (act.unit.toLowerCase().includes('minute') && activityTimeTotals.hasOwnProperty(act.key)) {
                    activityTimeTotals[act.key] += val;
                }
                if (xpSourceTotals.hasOwnProperty(act.key)) {
                    xpSourceTotals[act.key] += val * act.xpRate;
                }
            });
        });

        Chart.defaults.color = '#94a3b8';

        const xAxisConfig = {
            title: { display: true, text: 'Day', color: '#94a3b8', font: { weight: 'bold' } },
            ticks: { autoSkip: true, maxTicksLimit: 10 }
        };

        const ctxTotal = document.getElementById('totalXpChart');
        if (chartTotalXp) chartTotalXp.destroy();
        chartTotalXp = new Chart(ctxTotal, {
            type: 'line',
            data: {
                labels: labelsTotal,
                datasets: [{
                    label: 'Total Accumulated XP',
                    data: totalXpData,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#0f172a'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { x: xAxisConfig, y: { beginAtZero: true } }
            }
        });

        const ctxDaily = document.getElementById('dailyXpChart');
        if (chartDailyXp) chartDailyXp.destroy();
        chartDailyXp = new Chart(ctxDaily, {
            type: 'line',
            data: {
                labels: labelsDaily,
                datasets: [{
                    label: 'XP Gained',
                    data: dailyXpData,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#0f172a'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { x: xAxisConfig, y: { beginAtZero: true } }
            }
        });

        const ctxPie = document.getElementById('activityPieChart');
        if (chartActivity) chartActivity.destroy();
        const pieColors = ['#ef4444', '#eab308', '#3b82f6', '#f97316', '#10b981', '#a855f7'];
        const timeActivities = group.activities.filter(act => act.unit.toLowerCase().includes('minute'));
        chartActivity = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: timeActivities.map(a => a.label),
                datasets: [{
                    data: timeActivities.map(a => activityTimeTotals[a.key] || 0),
                    backgroundColor: pieColors.slice(0, timeActivities.length),
                    borderWidth: 2, borderColor: '#1e293b'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });

        const ctxSource = document.getElementById('xpSourcePieChart');
        if (chartXpSource) chartXpSource.destroy();
        chartXpSource = new Chart(ctxSource, {
            type: 'doughnut',
            data: {
                labels: group.activities.map(a => a.label),
                datasets: [{
                    data: group.activities.map(a => xpSourceTotals[a.key] || 0),
                    backgroundColor: pieColors.slice(0, group.activities.length),
                    borderWidth: 2, borderColor: '#1e293b'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }

    // --- Gratitude Log ---
    window.gratitudeWeekOffset = 0;

    window.changeGratitudeWeek = function (dir) {
        window.gratitudeWeekOffset += dir;
        renderGratitudeLog();
    };

    async function renderGratitudeLog() {
        const container = document.getElementById('gratitude-log-container');
        if (!container) return;

        const data = getSaveData();
        const myName = data.hero_name || 'You';
        const chronicles = data.eternal_chronicles || [];

        // Week range calculation
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek + (window.gratitudeWeekOffset * 7));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Build date list for the week (Sun–Sat)
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            weekDates.push(d.toLocaleDateString('en-US', { timeZone: 'America/Chicago' }));
        }

        const formatOpts = { month: 'short', day: 'numeric' };
        const dateRangeString = `${startOfWeek.toLocaleDateString('en-US', formatOpts)} – ${endOfWeek.toLocaleDateString('en-US', formatOpts)}`;
        const canGoForward = window.gratitudeWeekOffset < 0;
        const canGoBack = chronicles.some(e => new Date(e.date) < startOfWeek);

        // Gather friends from cache (already fetched when friends tab was loaded)
        const friendsData = {};
        if (window.cachedFriendChronicles) {
            for (const [fname, fChronicles] of Object.entries(window.cachedFriendChronicles)) {
                friendsData[fname] = fChronicles || [];
            }
        }

        // If no friends cached yet, try fetching them
        if (Object.keys(friendsData).length === 0 && data.friends_list && data.friends_list.length > 0) {
            for (const friendName of data.friends_list) {
                const allyData = await fetchHeroFromFirebase(friendName);
                if (allyData) {
                    window.cachedFriendChronicles = window.cachedFriendChronicles || {};
                    window.cachedFriendChronicles[allyData.hero_name] = allyData.eternal_chronicles || [];
                    friendsData[allyData.hero_name] = allyData.eternal_chronicles || [];
                }
            }
        }

        const friendNames = Object.keys(friendsData);
        const allColumns = [myName, ...friendNames];

        // Build gratitude lookup maps
        function buildGratitudeMap(chrList) {
            const map = {};
            (chrList || []).forEach(entry => {
                if (entry.gratitude) map[entry.date] = entry.gratitude;
            });
            return map;
        }

        const myGratMap = buildGratitudeMap(chronicles);
        const friendGratMaps = {};
        friendNames.forEach(fn => {
            friendGratMaps[fn] = buildGratitudeMap(friendsData[fn]);
        });

        // Check if there's any gratitude data in the whole dataset
        const hasAnyData = weekDates.some(dateStr => {
            if (myGratMap[dateStr]) return true;
            return friendNames.some(fn => friendGratMaps[fn][dateStr]);
        });

        // Build the table
        const headerCells = allColumns.map((name, i) =>
            `<th style="padding: 10px 14px; text-align: left; color: ${i === 0 ? 'var(--accent-color)' : '#10b981'}; font-size: 0.85rem; letter-spacing: 1px; white-space: nowrap; border-bottom: 2px solid var(--border-color);">${name}</th>`
        ).join('');

        const rows = weekDates.map(dateStr => {
            const d = new Date(dateStr);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const myText = myGratMap[dateStr] || '';
            const friendCells = friendNames.map(fn => {
                const text = friendGratMaps[fn][dateStr] || '';
                return `<td style="padding: 10px 14px; vertical-align: top; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem; color: ${text ? 'var(--text-main)' : 'var(--text-dim)'}; max-width: 220px; word-wrap: break-word;">${text || '<em>—</em>'}</td>`;
            }).join('');

            return `
                <tr>
                    <td style="padding: 10px 14px; vertical-align: top; border-bottom: 1px dashed var(--border-color); white-space: nowrap; font-size: 0.8rem; color: var(--text-dim);">${dayName}</td>
                    <td style="padding: 10px 14px; vertical-align: top; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem; color: ${myText ? 'var(--text-main)' : 'var(--text-dim)'}; max-width: 220px; word-wrap: break-word;">${myText || '<em>—</em>'}</td>
                    ${friendCells}
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- Week Nav -->
                <div class="calendar-header" style="margin-bottom: 0; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                    <button type="button" class="cal-nav-btn" style="visibility: ${canGoBack ? 'visible' : 'hidden'};" onclick="changeGratitudeWeek(-1)"><i class="fas fa-chevron-left"></i></button>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                        <h2 style="font-size: 1.1rem; margin: 0; color: var(--text-main); letter-spacing: 1px;">Daily Gratitude</h2>
                        <span style="font-size: 0.75rem; color: var(--text-dim);">${dateRangeString}</span>
                    </div>
                    <button type="button" class="cal-nav-btn" style="visibility: ${canGoForward ? 'visible' : 'hidden'};" onclick="changeGratitudeWeek(1)"><i class="fas fa-chevron-right"></i></button>
                </div>

                ${!hasAnyData ? `
                    <div class="no-data-msg" style="border: none; text-align: center; padding: 40px 20px; color: var(--text-dim);">
                        <div style="font-size: 2rem; margin-bottom: 10px;">💭</div>
                        No gratitude entries logged this week. Fill out your daily activity log to add one!
                    </div>
                ` : `
                    <!-- Table -->
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr>
                                    <th style="padding: 10px 14px; text-align: left; color: var(--text-dim); font-size: 0.85rem; letter-spacing: 1px; white-space: nowrap; border-bottom: 2px solid var(--border-color);">Date</th>
                                    ${headerCells}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `}

                ${friendNames.length === 0 ? `
                    <p style="font-size: 0.8rem; color: var(--text-dim); text-align: center; margin: 0;">
                        Add teammates in the <strong style="color: var(--accent-color);">Friends</strong> tab to see their gratitude entries here.
                    </p>` : ''}
            </div>
        `;
    }

    function renderRecordsUI() {
        const data = getSaveData();
        const container = document.getElementById('records-container');
        if (!container || !data.eternal_chronicles) return;

        const logs = [...data.eternal_chronicles].reverse();
        const group = getActiveGroup();

        let records = {
            dailyXp: { val: 0, date: 'N/A' },
            weeklyXp: { val: 0, date: 'N/A' },
            monthlyXp: { val: 0, date: 'N/A' }
        };
        group.activities.forEach(act => {
            records[act.key] = { val: 0, date: 'N/A' };
        });

        let monthlyTotals = {};

        logs.forEach((entry, i) => {
            const s = entry.stats || {};
            const dateParts = entry.date.split('/');
            const monthYear = dateParts.length === 3 ? `${dateParts[0]}/${dateParts[2]}` : entry.date;

            let dayXp = calculateXpFromStats(s, entry.date);

            if (dayXp > records.dailyXp.val) { records.dailyXp = { val: dayXp, date: entry.date }; }

            group.activities.forEach(act => {
                const val = s[act.key] || 0;
                if (val > (records[act.key]?.val || 0)) {
                    records[act.key] = { val, date: entry.date };
                }
            });

            if (!monthlyTotals[monthYear]) monthlyTotals[monthYear] = 0;
            monthlyTotals[monthYear] += dayXp;

            let weeklySum = 0;
            let endDate = entry.date;
            for (let j = i; j < Math.min(i + 7, logs.length); j++) {
                weeklySum += calculateXpFromStats(logs[j].stats || {}, logs[j].date);
                endDate = logs[j].date;
            }
            if (weeklySum > records.weeklyXp.val) {
                records.weeklyXp = { val: weeklySum, date: `${entry.date} to ${endDate}` };
            }
        });

        for (const [month, total] of Object.entries(monthlyTotals)) {
            if (total > records.monthlyXp.val) {
                records.monthlyXp = { val: total, date: month };
            }
        }

        const activityRecordCards = group.activities.map(act => {
            const rec = records[act.key] || { val: 0, date: 'N/A' };
            const suffix = act.unit === 'Minutes' ? ' min' : act.unit === 'Glasses' ? ' glasses' : '';
            return `<div class="record-card"><div class="record-title">Most ${act.label}&nbsp;(1&nbsp;Day)</div><div class="record-value">${rec.val}${suffix}</div><div class="record-date">${rec.date}</div></div>`;
        }).join('');

        container.innerHTML = `
            <div class="record-card"><div class="record-title">Most XP&nbsp;(1&nbsp;Day)</div><div class="record-value">${records.dailyXp.val}</div><div class="record-date">${records.dailyXp.date}</div></div>
            <div class="record-card"><div class="record-title">Most XP&nbsp;(1&nbsp;Week)</div><div class="record-value">${records.weeklyXp.val}</div><div class="record-date">${records.weeklyXp.date}</div></div>
            <div class="record-card"><div class="record-title">Most XP&nbsp;(1&nbsp;Month)</div><div class="record-value">${records.monthlyXp.val}</div><div class="record-date">${records.monthlyXp.date}</div></div>
            ${activityRecordCards}
        `;
    }

    function renderCalendarUI() {
        const data = getSaveData();
        const container = document.getElementById('calendar-container');
        const yearDisplay = document.getElementById('cal-year-display');
        const prevBtn = document.getElementById('cal-prev-btn');

        if (!container || !yearDisplay || !prevBtn) return;

        yearDisplay.textContent = currentCalendarYear;
        prevBtn.style.visibility = (currentCalendarYear <= 2026) ? 'hidden' : 'visible';

        let firstLogDate = null;
        if (data.eternal_chronicles && data.eternal_chronicles.length > 0) {
            const sorted = [...data.eternal_chronicles].sort((a, b) => new Date(a.date) - new Date(b.date));
            firstLogDate = new Date(sorted[0].date);
            firstLogDate.setHours(0, 0, 0, 0);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let xpMap = {};
        let maxXP = 1;

        if (data.eternal_chronicles) {
            data.eternal_chronicles.forEach(entry => {
                const dateObj = new Date(entry.date);
                if (dateObj.getFullYear() === currentCalendarYear) {
                    const s = entry.stats || {};
                    let dayXp = calculateXpFromStats(s, entry.date);

                    xpMap[entry.date] = dayXp;
                    if (dayXp > maxXP) maxXP = dayXp;
                }
            });
        }

        let html = '';
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        for (let month = 0; month < 12; month++) {
            html += `<div class="cal-month">
                    <div class="cal-month-name">${monthNames[month]}</div>
                    <div class="cal-weekdays">
                        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                    </div>
                    <div class="cal-days-grid">`;

            let firstDayIndex = new Date(currentCalendarYear, month, 1).getDay();
            let daysInMonth = new Date(currentCalendarYear, month + 1, 0).getDate();

            for (let i = 0; i < firstDayIndex; i++) {
                html += `<div class="cal-day empty"></div>`;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const currentLoopDate = new Date(currentCalendarYear, month, day);
                currentLoopDate.setHours(0, 0, 0, 0);

                let checkDateStr = currentLoopDate.toLocaleDateString();
                let xp = xpMap[checkDateStr] || 0;

                let bgColor = '';
                let tooltip = `${checkDateStr}: Uncharted`;

                if (xp > 0) {
                    let hue = (xp / maxXP) * 120;
                    bgColor = `background: hsl(${hue}, 80%, 50%);`;
                    tooltip = `${checkDateStr}: ${xp} XP`;
                }
                else if (firstLogDate && currentLoopDate >= firstLogDate && currentLoopDate <= today) {
                    bgColor = `background: #ef4444;`;
                    tooltip = `${checkDateStr}: 0 XP`;
                }

                html += `<div class="cal-day" style="${bgColor}" data-tooltip="${tooltip}"></div>`;
            }
            html += `</div></div>`;
        }

        container.innerHTML = html;
    }

    function renderActivityFormUI() {
        const dateDisplay = document.getElementById('act-date-display');
        const nextBtn = document.getElementById('act-next-btn');
        if (!dateDisplay) return;

        let targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + currentActivityDateOffset);
        const dateString = targetDate.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });

        if (currentActivityDateOffset === 0) {
            dateDisplay.textContent = `Today (${dateString})`;
            nextBtn.style.visibility = 'hidden';
        } else {
            dateDisplay.textContent = dateString;
            nextBtn.style.visibility = 'visible';
        }

        const data = getSaveData();
        const existingEntry = data.eternal_chronicles.find(entry => entry.date === dateString);
        const s = existingEntry ? existingEntry.stats : {};
        const existingGratitude = existingEntry ? (existingEntry.gratitude || '') : '';

        // Dynamically render the correct activity inputs for the player's chosen group
        const group = ACTIVITY_GROUPS[data.activity_group] || ACTIVITY_GROUPS['original'];
        const grid = document.getElementById('activity-grid-container');
        if (grid) {
            grid.innerHTML = group.activities.map(act => `
                <div class="input-group">
                    <label><i class="${act.icon}"></i> ${act.label} (${act.unit})</label>
                    <input type="number" id="${act.id}" min="0" placeholder="0" value="${s[act.key] || ''}">
                </div>
            `).join('') + `
                <div class="input-group" style="grid-column: 1 / -1;">
                    <label><i class="fas fa-heart" style="color: var(--accent-color);"></i> Daily Gratitude (5 xp)</label>
                    <textarea id="act-gratitude-input" placeholder="What are you grateful for today?" rows="3"
                        style="width: 100%; background: var(--bg-input, var(--bg-primary)); color: var(--text-main);
                               border: 1px solid var(--border-color); border-radius: 6px; padding: 10px;
                               font-family: inherit; font-size: 0.9rem; resize: vertical; box-sizing: border-box;"
                    >${existingGratitude}</textarea>
                </div>
            `;
        }
    }

    let currentCharIndex = 0;

    function updateCarousel() {
        const char = characters[currentCharIndex];
        // Now just adjust how you read the stats/images based on the new structure
        updatePortraitUI('carousel-img', char.name, 1);
        document.getElementById('carousel-name').textContent = char.name;
        document.getElementById('stat-str').textContent = char.stats.str;
        document.getElementById('stat-def').textContent = char.stats.def;
        document.getElementById('stat-vit').textContent = char.stats.vit;
        document.getElementById('stat-int').textContent = char.stats.int;
        document.getElementById('stat-end').textContent = char.stats.end;

        document.getElementById('cc-class-selected').value = char.name;
    }

    const prevBtn = document.getElementById('prev-char');
    const nextBtn = document.getElementById('next-char');

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', function () {
            currentCharIndex = (currentCharIndex - 1 + characters.length) % characters.length;
            updateCarousel();
        });

        nextBtn.addEventListener('click', function () {
            currentCharIndex = (currentCharIndex + 1) % characters.length;
            updateCarousel();
        });

        updateCarousel();
    }

    // --- PATH CARD SELECTION INTERACTION ---
    const pathCards = document.querySelectorAll('.path-card');
    const pathRadios = document.querySelectorAll('input[name="activity-group"]');

    function syncPathCardUI() {
        pathCards.forEach(card => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio && radio.checked) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    pathCards.forEach(card => {
        card.addEventListener('click', function () {
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                syncPathCardUI();
            }
        });
    });

    // Initialize the selected state on load
    syncPathCardUI();

    // Form Submission
    if (creatorForm) {
        creatorForm.addEventListener('submit', function (e) {
            e.preventDefault();
            let data = getSaveData();

            const nameInput = document.getElementById('cc-name');
            const classInput = document.getElementById('cc-class-selected');
            const themeInput = document.getElementById('cc-theme');
            const groupInput = document.querySelector('input[name="activity-group"]:checked');

            if (nameInput) data.hero_name = nameInput.value;
            if (themeInput) data.user_theme = themeInput.value;
            if (groupInput) data.activity_group = groupInput.value;

            if (classInput) {
                data.hero_class = classInput.value;
                const selectedChar = characters.find(c => c.name === data.hero_class);
                if (selectedChar) {
                    // FIX: Add '.stats' to correctly target the nested values
                    const startingMaxHp = 50 + (selectedChar.stats.vit * 10);
                    const startingMaxEnergy = 20 + (selectedChar.stats.end * 5);

                    data.stats = {
                        str: selectedChar.stats.str,
                        def: selectedChar.stats.def,
                        vit: selectedChar.stats.vit,
                        int: selectedChar.stats.int,
                        end: selectedChar.stats.end,
                        current_hp: startingMaxHp,
                        current_energy: startingMaxEnergy,
                        level: 1,
                        xp: 0,
                        unspent_points: 0 // Initialized this here too to be safe!
                    };
                }
            }

            updateSaveData(data);

            // --- CINEMATIC INTRO SEQUENCE ---
            const fadeTime = 2000;
            const readTime = 3000;
            const gapTime = 800;

            const welcome = document.getElementById('welcome-screen');
            if (welcome) welcome.style.display = 'none';

            const introDiv = document.createElement('div');
            introDiv.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #050505; z-index: 1000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; opacity: 0; transition: opacity 1.5s ease-in-out;";

            const lines = getIntroCinematicText(data.hero_name);

            lines.forEach((text, i) => {
                const p = document.createElement('div');
                p.innerHTML = text;
                p.style.cssText = `color: #fff; font-size: 1.5rem; line-height: 2; max-width: 800px; opacity: 0; transform: translateY(20px); transition: opacity ${fadeTime}ms ease, transform ${fadeTime}ms ease; position: absolute;`;
                if (i === lines.length - 1) p.style.fontSize = "2.2rem";
                introDiv.appendChild(p);
            });

            const skipBtn = document.createElement('button');
            skipBtn.textContent = "Click to Begin";
            skipBtn.style.cssText = "position: absolute; bottom: 40px; background: transparent; color: var(--text-dim); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: 4px; cursor: pointer; opacity: 0; transition: opacity 1s, color 0.2s, border-color 0.2s; letter-spacing: 1px;";
            skipBtn.onmouseover = () => { skipBtn.style.color = '#fff'; skipBtn.style.borderColor = '#fff'; };
            skipBtn.onmouseout = () => { skipBtn.style.color = 'var(--text-dim)'; skipBtn.style.borderColor = 'var(--border-color)'; };

            introDiv.appendChild(skipBtn);
            document.body.appendChild(introDiv);

            setTimeout(() => { introDiv.style.opacity = '1'; }, 100);
            setTimeout(() => skipBtn.style.opacity = '1', 2000);

            const paragraphs = introDiv.querySelectorAll('div');
            let isSkipping = false;

            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            function finishIntro() {
                isSkipping = true;
                introDiv.style.opacity = '0';
                setTimeout(() => {
                    introDiv.remove();
                    if (welcome) welcome.style.display = '';
                    initializeApp();
                }, 1500);
            }

            skipBtn.onclick = finishIntro;

            async function playCinematic() {
                await sleep(1500);

                for (let i = 0; i < lines.length; i++) {
                    if (isSkipping) return;

                    paragraphs[i].style.opacity = '1';
                    paragraphs[i].style.transform = 'translateY(0)';

                    await sleep(fadeTime + readTime);
                    if (isSkipping) return;

                    paragraphs[i].style.opacity = '0';
                    paragraphs[i].style.transform = 'translateY(-20px)';

                    await sleep(fadeTime + gapTime);
                }

                if (!isSkipping) finishIntro();
            }

            playCinematic();
        });
    }

    // --- Allies & Friends Engine ---
    async function fetchHeroFromFirebase(heroName) {
        try {
            const snapshot = await db.ref('heroes/' + heroName.toLowerCase()).once('value');

            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                return null;
            }
        } catch (error) {
            console.error("Realm connection error:", error);
            return null;
        }
    }

    function renderFriendSlot(itemObj, defaultText, iconHtml) {
        if (itemObj) {
            const itemColor = itemObj.color || "var(--accent-color)";
            const itemGlow = itemObj.glow || "none";
            return `
                <div class="equip-slot" style="border-color: ${itemColor}; box-shadow: ${itemGlow}; cursor: default;">
                    <div style="font-size:1.8rem; margin-bottom:5px; text-shadow: ${itemGlow !== 'none' ? itemGlow : 'none'};">${itemObj.icon}</div>
                    <div style="font-size:0.7rem; line-height:1; color: ${itemColor}; font-weight: bold;">${itemObj.name}<br><span style="color:#10b981; font-weight: normal;">+${itemObj.statBonus} ${itemObj.targetStat.toUpperCase()}</span></div>
                </div>`;
        } else {
            return `
                <div class="equip-slot" style="border-color: var(--border-color); box-shadow: none; cursor: default;">
                    ${iconHtml} ${defaultText}
                </div>`;
        }
    }

    async function renderFriendsList() {
        const grid = document.getElementById('friends-grid');
        if (!grid) return;

        const data = getSaveData();

        if (data.friends_list.length === 0) {
            grid.innerHTML = '<div class="no-data-msg" style="grid-column: 1 / -1;">No allies added yet. Search for a hero above!</div>';
            return;
        }

        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim);">Syncing with realm...</div>';

        let cardsHTML = '';

        for (const friendName of data.friends_list) {
            const allyData = await fetchHeroFromFirebase(friendName);

            if (allyData) {
                // Cache chronicles so generators can access them
                window.cachedFriendChronicles = window.cachedFriendChronicles || {};
                window.cachedFriendChronicles[allyData.hero_name] = allyData.eternal_chronicles || [];

                const fn = allyData.hero_name;
                const lvl = allyData.stats?.level || 1;
                const xp = allyData.stats?.xp || 0;
                const xpReq = lvl * 100;
                const xpPct = Math.min(100, Math.round((xp / xpReq) * 100));
                const maxHp = 50 + ((allyData.stats?.vit || 0) * 10);
                const maxEn = 20 + ((allyData.stats?.end || 0) * 5);

                cardsHTML += `
<div class="placeholder-card" style="padding: 24px; border-color: var(--accent-color); position: relative;">

    <!-- Header row -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:18px;">
        <h2 style="margin:0; color: var(--accent-color); font-size: 1.5rem; letter-spacing: 2px;">${fn}</h2>
        <button onclick="removeFriend('${fn}')" title="Part ways with ${fn}"
            style="background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 4px;
                   padding: 4px 10px; cursor: pointer; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px;">
            ✖ Remove
        </button>
    </div>

    <!-- Underline sub-tabs -->
    <div class="friend-subtab-nav">
        <button class="friend-subtab-btn active" id="fbtn-prof-${fn}" onclick="toggleFriendTab('${fn}','prof')">
            <i class="fas fa-user"></i> Profile
        </button>
        <button class="friend-subtab-btn" id="fbtn-rec-${fn}"   onclick="toggleFriendTab('${fn}','rec')">
            <i class="fas fa-trophy"></i> Records
        </button>
        <button class="friend-subtab-btn" id="fbtn-chart-${fn}" onclick="toggleFriendTab('${fn}','chart')">
            <i class="fas fa-chart-line"></i> Charts
        </button>
        <button class="friend-subtab-btn" id="fbtn-cal-${fn}"   onclick="toggleFriendTab('${fn}','cal')">
            <i class="fas fa-calendar-alt"></i> Calendar
        </button>
    </div>

    <!-- Profile sub-view -->
    <div class="friend-subtab-view active" id="fview-prof-${fn}">
        <div class="character-container">
            <div class="character-left-column">
                <div class="equipment-layout">
                    ${renderFriendSlot(allyData.equipped?.weapon, 'Weapon', '⚔️')}
                    <div class="character-portrait" id="friend-portrait-${fn}"></div>
                    ${renderFriendSlot(allyData.equipped?.armor, 'Armor', '🛡️')}
                    ${renderFriendSlot(allyData.equipped?.accessory, 'Accessory', '💍')}
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:12px;">
                <!-- Level FIRST -->
                <div class="xp-wrapper">
                    <div class="level-title">Level ${lvl}</div>
                    <div class="xp-container">
                        <div class="xp-fill" style="width:${xpPct}%"></div>
                        <span class="xp-text">${xp} / ${xpReq} XP</span>
                    </div>
                </div>

                <!-- Vitals SECOND -->
                <div class="vitals-layout">
                    <div class="vital-card vital-hp">
                        <span class="vital-label">HP</span>
                        <span class="vital-value">${allyData.stats?.current_hp || 0} / ${maxHp}</span>
                    </div>
                    <div class="vital-card vital-energy">
                        <span class="vital-label">Energy</span>
                        <span class="vital-value">${allyData.stats?.current_energy || 0} / ${maxEn}</span>
                    </div>
                </div>

                <div class="stat-grid" style="padding:12px;">
                    ${[
                        { label: 'Strength (STR)', val: allyData.stats?.str || 0 },
                        { label: 'Defense (DEF)', val: allyData.stats?.def || 0 },
                        { label: 'Endurance (END)', val: allyData.stats?.end || 0 },
                        { label: 'Vitality (VIT)', val: allyData.stats?.vit || 0 },
                        { label: 'Intelligence (INT)', val: allyData.stats?.int || 0 }
                    ].map(s => `
                        <div class="stat-row">
                            <span>${s.label}</span>
                            <span class="stat-val">${s.val}</span>
                        </div>`).join('')}
                </div>
            </div>
        </div>
    </div>

    <!-- Records sub-view -->
    <div class="friend-subtab-view" id="fview-rec-${fn}">
        ${window.generateFriendRecordsHTML(fn, allyData.eternal_chronicles)}
    </div>

    <!-- Charts sub-view -->
    <div class="friend-subtab-view" id="fview-chart-${fn}">
        ${window.generateFriendChartsHTML(fn)}
    </div>

    <!-- Calendar sub-view -->
    <div class="friend-subtab-view" id="fview-cal-${fn}">
        ${window.generateFriendCalendarHTML(fn, allyData.eternal_chronicles)}
    </div>

</div>`;
            }
        }

        grid.innerHTML = cardsHTML;

        // Render sprite sheet portraits once DOM exists
        for (const friendName of data.friends_list) {
            const allyData = await fetchHeroFromFirebase(friendName);
            if (allyData) {
                updatePortraitUI(`friend-portrait-${allyData.hero_name}`, allyData.hero_class, allyData.stats?.level || 1);
            }
        }
    }

    // --- Initialization Flow ---
    function initializeApp() {
        let data = getSaveData();

        cachedSimpleFog = !!data.simple_fog;
        cachedSoftFog = data.soft_fog !== false;

        if (simpleFogToggle) simpleFogToggle.checked = cachedSimpleFog;
        if (softFogToggle) softFogToggle.checked = cachedSoftFog;

        if (!data.hero_name) {
            if (welcomeScreen) welcomeScreen.classList.add('active');
            if (appContainer) appContainer.classList.remove('active');
            setTheme('theme-modern');
        } else {
            if (welcomeScreen) welcomeScreen.classList.remove('active');
            if (appContainer) appContainer.classList.add('active');
            applyGlobalFogDecay(data.hero_name);
            setTheme(data.user_theme);
            syncThemeDropdowns();
            updateProfileUI();
            updateCharacterTabUI();
            checkDateAndLoadData();
            renderActivityLog();
            initAdventure();
            renderFriendsList();
            checkFriendRequests();
            initRealmChat();
            updateMinigamesSidebarPanel();

            // Check for pending rewards that have unlocked (after 2 AM CST next day)
            setTimeout(() => checkAndApplyPendingRewards(), 1200);

            // --- BOSS FIGHT: register alert listener and resume any active battle ---
            if (typeof window.setupBossFightListeners === 'function') {
                window.setupBossFightListeners();
            }
        }
    }

    // --- PENDING REWARDS SYSTEM ---

    function checkAndApplyPendingRewards() {
        let data = getSaveData();
        if (!data.pending_rewards || data.pending_rewards.length === 0) return;

        const now = Date.now();
        const dueRewards = data.pending_rewards.filter(r => r.unlockTimestamp <= now);
        if (dueRewards.length === 0) return;

        // Apply all due rewards
        let totalXP = 0;
        let totalEnergy = 0;
        const rewardDates = [];

        dueRewards.forEach(r => {
            totalXP += r.xp;
            totalEnergy += r.energyGain;
            rewardDates.push(r.date);
        });

        // Remove applied rewards from pending list
        data.pending_rewards = data.pending_rewards.filter(r => r.unlockTimestamp > now);

        // Apply XP and check for level up
        data.stats.xp += totalXP;
        let leveledUp = false;
        let levelsGained = 0;
        let requiredXP = data.stats.level * 100;

        while (data.stats.xp >= requiredXP) {
            data.stats.xp -= requiredXP;
            data.stats.level++;
            data.stats.unspent_points += 3;
            leveledUp = true;
            levelsGained++;
            requiredXP = data.stats.level * 100;
            data.stats.current_hp = 50 + (data.stats.vit * 10);
        }

        // Apply energy (cap at max)
        const maxEnergy = 20 + (getTotalStat(data, 'end') * 5);
        data.stats.current_energy = Math.min(
            (data.stats.current_energy || 0) + totalEnergy,
            maxEnergy
        );

        // Sync live engine energy
        if (window.gameEngine) {
            window.gameEngine.currentEnergy = data.stats.current_energy;
            window.gameEngine.maxEnergy = maxEnergy;
            window.gameEngine.isExhausted = false;
        }

        updateSaveData(data);
        updateCharacterTabUI();
        updateProfileUI();
        updateAdventureHUD();

        // Pachinko tokens are also earned from the daily-banked XP, but only
        // once the Warden's Key has been gifted.  This path bypasses awardXP()
        // (it edits data.stats.xp directly), so we grant tokens here too.
        const pachinkoTokensEarned = grantPachinkoTokensFromXP(totalXP);

        // Show the reward modal
        showDailyRewardModal(rewardDates, totalXP, totalEnergy, leveledUp, levelsGained, data.stats.level, pachinkoTokensEarned);
    }

    // --- WARDEN'S KEY: First-unlock modal ---
    // Triggered the first time the Mysterious Wizard gifts the player the Key.
    // Uses the .key-unlock-* classes already defined in lostpegs.css.
    function showWardensKeyUnlockModal() {
        // Prevent stacking if somehow called twice in quick succession
        if (document.getElementById('wardens-key-unlock-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'wardens-key-unlock-overlay';
        overlay.className = 'key-unlock-overlay';
        overlay.innerHTML = `
            <div class="key-unlock-box">
                <span class="key-unlock-icon">🗝️</span>
                <h2 class="key-unlock-title">A Gift From The Wizard</h2>
                <div class="key-unlock-subtitle">The Warden's Key</div>
                <p class="key-unlock-body">
                    The wizard's voice is calm but certain.<br><br>
                    <em>"You have shown discipline, traveler. The road of habit is long, and even the steady-footed need a place to rest their hands.<br><br>
                    Take this Key. It opens the <strong>Hall of Lost Pegs</strong> — a chamber outside the trials, where chance is welcomed instead of feared.<br><br>
                    Each honest day you spend will earn you a token to spend within. One token for every ten experiences of the world. Drop them, and let fortune answer."</em>
                </p>
                <button class="key-unlock-confirm" id="wardens-key-confirm-btn">I Accept The Key</button>
            </div>
        `;
        document.body.appendChild(overlay);

        const closeOverlay = () => {
            overlay.style.transition = 'opacity 0.35s ease';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 380);
        };

        document.getElementById('wardens-key-confirm-btn').addEventListener('click', closeOverlay);
        // Click outside the box to dismiss as well
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });
    }

    // --- WARDEN'S KEY: Show/hide the Mini-Games nav tab ---
    // The tab is revealed once the player owns the key.  The pachinko_tokens
    // count is what gets displayed inside the tab and the nav badge.
    function updateMinigamesSidebarPanel() {
        const data = getSaveData();
        const navItem = document.getElementById('minigames-nav-item');
        if (!navItem) return;

        const hasKey = !!data.wardens_key;
        const tokens = Math.floor(data.pachinko_tokens || 0);

        if (hasKey) {
            // Reveal the nav tab
            navItem.style.display = '';

            // Sync any on-screen token counters (tab page header + sidebar HUD).
            // Both legacy #fate-coin-count and new #pachinko-token-count are
            // updated so older partially-styled markup keeps working.
            document.querySelectorAll('#fate-coin-count, #pachinko-token-count, #lost-pegs-tokens')
                .forEach(el => { el.textContent = tokens; });

            // Nav badge shows the token balance so it's visible from any tab
            const badge = document.getElementById('minigames-nav-badge');
            if (badge) badge.textContent = tokens > 0 ? tokens : '';

            // Sync the Lost Pegs drop-button disabled state directly — do NOT
            // call into LostPegs.refreshTokenDisplay() here, because that
            // function calls back into updateMinigamesSidebarPanel() and would
            // create infinite mutual recursion (stack overflow during awardXP).
            const dropBtn = document.getElementById('lost-pegs-drop-btn');
            if (dropBtn) {
                const costPerDrop = (window.LostPegs && window.LostPegs.getConfig)
                    ? (window.LostPegs.getConfig().costPerDrop || 1)
                    : 1;
                dropBtn.disabled = tokens < costPerDrop;
                dropBtn.title = tokens < costPerDrop
                    ? 'No tokens — earn one for every 10 XP you gain.'
                    : `Drop (costs 1 token — you have ${tokens})`;
            }
        } else {
            navItem.style.display = 'none';
        }
    }

    function showActivityBankedToast(xp, energy, unlockLabel) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(15,23,42,0.97); border: 1px solid #38bdf8; border-radius: 12px;
            padding: 18px 28px; z-index: 9999; text-align: center; max-width: 380px;
            box-shadow: 0 0 30px rgba(56,189,248,0.25); animation: toast-in 0.4s ease-out forwards;
        `;
        toast.innerHTML = `
            <div style="font-size:1.8rem; margin-bottom:8px;">📥</div>
            <div style="color:#38bdf8; font-weight:700; font-size:1rem; letter-spacing:1px; margin-bottom:6px;">Activities Banked!</div>
            <div style="color:#f1f5f9; font-size:0.85rem; line-height:1.5;">
                <strong style="color:#fcd34d;">+${xp} XP</strong> &amp;
                <strong style="color:#38bdf8;">+${energy} Energy</strong><br>
                <span style="color:#94a3b8;">Rewards unlock at ${unlockLabel}</span>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 600);
        }, 4000);
    }

    function showDailyRewardModal(dates, xp, energy, leveledUp, levelsGained, newLevel, pachinkoTokens) {
        // Remove any existing modal
        const existing = document.getElementById('daily-reward-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'daily-reward-modal';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            animation: modal-backdrop-in 0.3s ease;
        `;

        const dateLabel = dates.length === 1
            ? dates[0]
            : `${dates[dates.length - 1]} – ${dates[0]}`;

        const levelUpBlock = leveledUp ? `
            <div class="reward-levelup-banner">
                <div class="reward-levelup-stars">★ ★ ★</div>
                <div class="reward-levelup-title">LEVEL UP!</div>
                <div class="reward-levelup-sub">You reached <strong>Level ${newLevel}</strong>!</div>
                <div class="reward-levelup-note">+${levelsGained * 3} Stat Point${levelsGained * 3 !== 1 ? 's' : ''} earned — visit the Character tab to spend them.</div>
            </div>
        ` : '';

        // Show the pachinko-token card only if the player has the Warden's Key
        // and actually earned a whole token from this batch.
        const tokenCard = (pachinkoTokens && pachinkoTokens > 0) ? `
            <div class="reward-gain-card" style="border-color: rgba(167,139,250,0.4);">
                <div class="reward-gain-icon">🎟️</div>
                <div class="reward-gain-amount" style="color:#a78bfa;">+${pachinkoTokens}</div>
                <div class="reward-gain-label">Pachinko Tokens</div>
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="daily-reward-card ${leveledUp ? 'leveled-up' : ''}">
                <div class="reward-dawn-icon">${leveledUp ? '🌟' : '🌅'}</div>
                <h2 class="reward-title">A New Day Dawns</h2>
                <p class="reward-subtitle">Your efforts from <strong>${dateLabel}</strong> have been rewarded.</p>
                ${levelUpBlock}
                <div class="reward-gains-row">
                    <div class="reward-gain-card xp-card">
                        <div class="reward-gain-icon">✨</div>
                        <div class="reward-gain-amount">+${xp}</div>
                        <div class="reward-gain-label">XP Earned</div>
                    </div>
                    <div class="reward-gain-card energy-card">
                        <div class="reward-gain-icon">⚡</div>
                        <div class="reward-gain-amount">+${energy}</div>
                        <div class="reward-gain-label">Energy Restored</div>
                    </div>
                    ${tokenCard}
                </div>
                <button class="reward-dismiss-btn" onclick="document.getElementById('daily-reward-modal').remove()">
                    ${leveledUp ? '🎉 Begin the New Chapter!' : 'Set Forth, Adventurer!'}
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Trigger the confetti-like particles if leveled up
        if (leveledUp) {
            triggerLevelUpCelebration(modal);
        }
    }

    function triggerLevelUpCelebration(container) {
        const colors = ['#38bdf8', '#fcd34d', '#10b981', '#a855f7', '#f97316', '#ef4444'];
        for (let i = 0; i < 60; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                const color = colors[Math.floor(Math.random() * colors.length)];
                const size = 6 + Math.random() * 8;
                const startX = 20 + Math.random() * 60; // % from left
                particle.style.cssText = `
                    position: fixed;
                    left: ${startX}%;
                    top: -10px;
                    width: ${size}px; height: ${size}px;
                    background: ${color};
                    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                    pointer-events: none;
                    z-index: 10001;
                    animation: confetti-fall ${1.5 + Math.random() * 2}s ease-in forwards;
                    animation-delay: ${Math.random() * 0.8}s;
                    transform: rotate(${Math.random() * 360}deg);
                `;
                container.appendChild(particle);
                setTimeout(() => particle.remove(), 3500);
            }, i * 30);
        }
    }

    // --- Adventure Engine & Dynamic Camera ---
    const MAP_CENTER = 75;
    const MAP_RADIUS = 73;
    let cellSize = 40;
    let playerPos = { x: MAP_CENTER, y: MAP_CENTER };
    let gridEntities = {};
    let mapTerrain = {};
    let otherPlayers = {};
    let currentMapId = 'overworld';
    let overworldPos = { x: 75, y: 75 };
    let activeRealmRef = null;
    let playersRef = null;
    let activeBattle = null;
    let exploredPoints = [];
    let isMapLoaded = false;

    // --- CANVAS ENGINE VARIABLES ---
    let exactEnergy = null;
    let heroClass = 'Black Cat';

    // Physics & Movement
    let lastFogSyncTime = 0;
    let sharedFogCache = {};


    window.syncPlayerPosition = function syncPlayerPosition() {
        const data = getSaveData();
        // Wait until the engine is fully booted before syncing
        if (!data.hero_name || !window.gameEngine) return;

        // Pull LIVE data directly from the engine!
        let enginePlayer = window.gameEngine.player;

        let currentGridX = Math.floor(enginePlayer.x / ENGINE.TILE_SIZE);
        let currentGridY = Math.floor(enginePlayer.y / ENGINE.TILE_SIZE);

        let payload = {
            pos: { x: currentGridX, y: currentGridY },
            normPos: { x: enginePlayer.x / ENGINE.TILE_SIZE, y: enginePlayer.y / ENGINE.TILE_SIZE },
            direction: enginePlayer.direction,
            frame: enginePlayer.frame,
            class: data.hero_class,
            mapId: currentMapId
        };

        // PERFORMANCE FIX: Only attach the massive fog array once every 2 seconds
        let now = Date.now();
        if (now - lastFogSyncTime > 2000) {
            let engineExplored = Array.from(window.gameEngine.exploredTiles);
            payload.fog = JSON.stringify(engineExplored);
            lastFogSyncTime = now;
        }

        db.ref(`realm/shared_map/players/${data.hero_name}`).update(payload);
    }

    function initRealmChat() {
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send');
        const data = getSaveData();

        // Failsafe if the UI isn't currently loaded
        if (!chatMessages || !chatInput || !chatSendBtn || !data.hero_name) return;

        // Ensure we don't attach duplicate listeners if this runs twice
        const chatRef = db.ref('realm/chat');
        chatRef.off();
        chatMessages.innerHTML = ''; // Clear previous messages on load

        // 1. Listen for new incoming messages
        chatRef.limitToLast(50).on('child_added', (snapshot) => {
            const msg = snapshot.val();

            const msgEl = document.createElement('div');
            msgEl.style.fontSize = '0.85rem';
            msgEl.style.lineHeight = '1.4';

            // Color code your own name vs other players
            const isMe = msg.sender === data.hero_name;
            const nameColor = isMe ? 'var(--accent-color)' : '#10b981'; // Mint green for allies

            msgEl.innerHTML = `<strong style="color: ${nameColor};">${msg.sender}:</strong> <span style="color: var(--text-main);">${msg.text}</span>`;

            chatMessages.appendChild(msgEl);

            // Auto-scroll to the newest message
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        // 2. Logic to push a message to Firebase
        function sendMessage() {
            const text = chatInput.value.trim();
            if (text.length > 0) {
                chatRef.push({
                    sender: data.hero_name,
                    text: text,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                chatInput.value = ''; // Clear the box after sending
            }
        }

        // 3. Attach Event Listeners for sending
        chatSendBtn.addEventListener('click', sendMessage);

        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    function setupMultiplayerListeners(myName) {
        if (activeRealmRef) {
            activeRealmRef.child('gridEntities').off();
        }
        if (playersRef) playersRef.off();

        const path = currentMapId === 'overworld' ? 'realm/shared_map' : `realm/shared_map/caves/${currentMapId}`;
        activeRealmRef = db.ref(path);
        playersRef = db.ref('realm/shared_map/players');

        playersRef.on('value', (snap) => {
            let allPlayers = snap.val() || {};
            otherPlayers = {};
            for (let p in allPlayers) {
                if (p !== myName && allPlayers[p].mapId === currentMapId) {
                    otherPlayers[p] = allPlayers[p];
                    // PERFORMANCE FIX: Only run JSON.parse if the fog has actually updated!
                    if (otherPlayers[p].fog) {
                        if (sharedFogCache[p] && sharedFogCache[p].raw === otherPlayers[p].fog) {
                            // The text hasn't changed, load our already-translated array!
                            otherPlayers[p].parsedFog = sharedFogCache[p].parsed;
                        } else {
                            // New data! Translate it, save it to the array, and update the cache.
                            try {
                                let parsed = JSON.parse(otherPlayers[p].fog);
                                sharedFogCache[p] = { raw: otherPlayers[p].fog, parsed: parsed };
                                otherPlayers[p].parsedFog = parsed;
                            } catch (e) {
                                otherPlayers[p].parsedFog = [];
                            }
                        }
                    } else {
                        otherPlayers[p].parsedFog = [];
                    }
                }
            }
            // Build a fast-lookup Set of every tile any other player has explored.
            // This is checked in the engine's new-tile handler (not the render loop)
            // so the fog-path exposition popup only fires when the player physically
            // walks onto another player's track — never on initial load.
            window.otherFogTileSet = new Set();
            for (let p in otherPlayers) {
                if (otherPlayers[p].parsedFog) {
                    otherPlayers[p].parsedFog.forEach(coord => window.otherFogTileSet.add(coord));
                }
            }

            window.otherPlayers = otherPlayers;

        });

        activeRealmRef.child('gridEntities').on('value', (snap) => {
            gridEntities = snap.val() || {};
            window.gridEntities = gridEntities; // Keep engine synced
        });
    }

    function getHeroEmoji(heroClass) {
        return heroClasses[heroClass]?.emoji || "🦸";
    }

    function getHeroImage(heroClass) {
        return heroClasses[heroClass]?.portraitSheet || heroClasses["Black Cat"].portraitSheet;
    }

    function isWithinMap(x, y) {
        if (currentMapId === 'overworld') {
            const dx = x - MAP_CENTER;
            const dy = y - MAP_CENTER;
            return (dx * dx + dy * dy) <= (MAP_RADIUS * MAP_RADIUS);
        } else {
            return !!mapTerrain[`${x},${y}`];
        }
    }

    function generateCave(caveId) {
        let caveTerrain = {};
        let caveEntities = {};

        // FIX 1: Set start coordinates to the center of the 50x50 map!
        let startX = 25, startY = 25;

        const width = 50;
        const height = 50;
        let map = [];

        const fillProbability = 0.46;

        // 1. Initial random noise
        for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < width; x++) {
                // Force map edges to be solid walls
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    row.push(1); // 1 = Wall, 0 = Floor
                } else {
                    row.push(Math.random() < fillProbability ? 1 : 0);
                }
            }
            map.push(row);
        }

        // --- NEW: FORCED SPAWN ROOM ---
        for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
                map[startY + dy][startX + dx] = 0;
            }
        }

        const countWalls = (cx, cy, grid) => {
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    let nx = cx + dx;
                    let ny = cy + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        count++;
                    } else if (grid[ny][nx] === 1) {
                        count++;
                    }
                }
            }
            return count;
        };

        // 2. Cellular Automata Smoothing
        for (let i = 0; i < 5; i++) {
            let newMap = map.map(arr => [...arr]);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    let walls = countWalls(x, y, map);
                    if (walls > 4) newMap[y][x] = 1;
                    else if (walls < 4) newMap[y][x] = 0;
                }
            }
            map = newMap;
        }

        // 3. The "Anti-Invagination" Pass
        for (let pass = 0; pass < 2; pass++) {
            let newMap = map.map(arr => [...arr]);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    if (map[y][x] === 0) {
                        let cardinalWalls = 0;
                        if (map[y - 1][x] === 1) cardinalWalls++;
                        if (map[y + 1][x] === 1) cardinalWalls++;
                        if (map[y][x - 1] === 1) cardinalWalls++;
                        if (map[y][x + 1] === 1) cardinalWalls++;

                        let isNarrowHallway = (map[y - 1][x] === 1 && map[y + 1][x] === 1) ||
                            (map[y][x - 1] === 1 && map[y][x + 1] === 1);

                        if (cardinalWalls >= 3 || isNarrowHallway) {
                            newMap[y][x] = 1;
                        }
                    }
                }
            }
            map = newMap;
        }

        // --- FIX 2: FLOOD FILL ALGORITHM FOR 100% ACCESSIBILITY ---
        let visited = Array(height).fill().map(() => Array(width).fill(false));
        let queue = [{ x: startX, y: startY }];
        visited[startY][startX] = true;

        // Traverse all connected floor tiles starting from the drop-in point
        while (queue.length > 0) {
            let curr = queue.shift();

            let dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (let d of dirs) {
                let nx = curr.x + d[0];
                let ny = curr.y + d[1];

                // If it's a floor tile and we haven't visited it yet
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    if (map[ny][nx] === 0 && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }

        // Seal off any floor tiles that weren't reached by the flood fill
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (map[y][x] === 0 && !visited[y][x]) {
                    map[y][x] = 1; // Turn inaccessible islands into walls
                }
            }
        }
        // ------------------------------------------------------------

        // 4. Force the exit ladder to exist at the exact drop-in coordinate
        caveEntities[`${startX},${startY}`] = 'exit';

        // 4b. Place a Quest Crystal chest deep in the cave (furthest accessible tile from the entrance).
        // Always awards Crystal of Perseverance — the reward for going deeper than is comfortable.
        let deepestKey = null;
        let maxDist = 0;
        let secondDeepestKey = null;
        let secondMaxDist = 0;

        for (let ck in caveTerrain) {
            let ckParts = ck.split(',');
            let cx = parseInt(ckParts[0]);
            let cy = parseInt(ckParts[1]);
            let dist = Math.abs(cx - startX) + Math.abs(cy - startY);
            if (dist > maxDist && ck !== `${startX},${startY}` && !caveEntities[ck]) {
                secondDeepestKey = deepestKey;
                secondMaxDist = maxDist;
                maxDist = dist;
                deepestKey = ck;
            } else if (dist > secondMaxDist && dist < maxDist && ck !== `${startX},${startY}` && !caveEntities[ck]) {
                secondMaxDist = dist;
                secondDeepestKey = ck;
            }
        }

        // Deepest point: Crystal of Perseverance chest
        if (deepestKey) {
            caveEntities[deepestKey] = 'quest_chest_crystal_perseverance';
        }

        // Second-deepest point (at least 12 tiles from entrance): The Doom Scroller boss
        // Players must explore deeply to encounter it
        if (secondDeepestKey && secondMaxDist >= 12) {
            caveEntities[secondDeepestKey] = 'boss_doom_scroller';
        }

        // 5. Apply the 2D Array back to your coordinate dictionary & spawn entities
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (map[y][x] === 0) {
                    let key = `${x},${y}`;
                    caveTerrain[key] = { type: 'dirt' };

                    // Because this generates thousands of floor tiles instead of just a few paths,
                    // we must drastically lower the spawn chance so the cave isn't flooded!
                    // Skip tiles that are too close to the spawn/exit point.
                    // The exit ladder sits at (startX, startY) and the player
                    // actually drops in one tile south at (startX, startY+1), so we
                    // clear a 3-tile safe radius around both to prevent instant encounters.
                    let distToSpawn = Math.max(Math.abs(x - startX), Math.abs(y - startY));
                    if (distToSpawn > 3) {
                        if (Math.random() < 0.02) caveEntities[key] = getRandomMonsterType('cave');
                        else if (Math.random() < 0.005) caveEntities[key] = getRandomChestType();
                        else if (Math.random() < 0.1) caveTerrain[key].decor = '🪨';
                    }
                }
            }
        }

        return { mapTerrain: caveTerrain, gridEntities: caveEntities, fog: {} };
    }


    async function switchMap(newMapId) {
        isMapLoaded = false; // Pause physics
        saveFogData(); // Persist fog before leaving

        const previousMapId = currentMapId; // Capture the OLD ID here
        const data = getSaveData();

        // FIX 1: Capture overworld position BEFORE we change the ID
        if (previousMapId === 'overworld' && newMapId !== 'overworld') {
            overworldPos = {
                x: Math.floor(window.gameEngine.player.x / ENGINE.TILE_SIZE),
                y: Math.floor(window.gameEngine.player.y / ENGINE.TILE_SIZE)
            };
        }

        // Now update the global ID
        currentMapId = newMapId;

        if (newMapId === 'overworld') {
            updateStatusLog("You climb back up to the surface.");

            // FIX 2: Check the OLD map ID to find your way back
            if (previousMapId.startsWith('cave_')) {
                let parts = previousMapId.split('_');
                playerPos = {
                    x: parseInt(parts[1]),
                    y: parseInt(parts[2]) + 1
                };
            } else {
                // Fallback to the last saved overworld coordinates
                playerPos = { ...overworldPos };
            }

            const snap = await db.ref('realm/shared_map').once('value');
            let realmData = snap.val() || {};
            mapTerrain = realmData.mapTerrain || {};
            gridEntities = realmData.gridEntities || {};
        } else {
            updateStatusLog("You delve into the dark depths...");
            const caveRef = db.ref(`realm/shared_map/caves/${newMapId}`);
            let snap = await caveRef.once('value');

            if (!snap.exists()) {
                let newCave = generateCave(newMapId);
                await caveRef.set(newCave);
                mapTerrain = newCave.mapTerrain;
                gridEntities = newCave.gridEntities;
            } else {
                let caveData = snap.val();
                mapTerrain = caveData.mapTerrain || {};
                gridEntities = caveData.gridEntities || {};
            }
            // Start in the center of the generated cave
            playerPos = { x: 25, y: 26 };
        }

        // Sync everything to the engine
        cacheMapDecorations();
        window.mapTerrain = mapTerrain;
        window.gridEntities = gridEntities;

        let masterFog = data.fog_master || {};
        exploredPoints = masterFog[currentMapId] || [];

        if (window.gameEngine) {
            window.gameEngine.resetFog(exploredPoints);
            window.gameEngine.player.x = playerPos.x * ENGINE.TILE_SIZE;
            window.gameEngine.player.y = playerPos.y * ENGINE.TILE_SIZE;
            window.gameEngine.loadMapData(mapTerrain, currentMapId);
            window.gameEngine.spawnImmunityTimer = 2.5; // Grant immunity at the new spawn point
        }

        setupMultiplayerListeners(data.hero_name);
        syncPlayerPosition();
        isMapLoaded = true; // Resume physics
    }
    window.resolveEncounter = async function (x, y, action, oldPixelX, oldPixelY) { // Added async
        const panel = document.getElementById('encounter-panel');
        let data = getSaveData();

        const key = `${x},${y}`;
        const encounterType = gridEntities[key] || 'monster';
        const entityPath = currentMapId === 'overworld'
            ? `realm/shared_map/gridEntities/${key}`
            : `realm/shared_map/caves/${currentMapId}/gridEntities/${key}`;

        // --- SHRINE PORTAL: Gateway to the next land (placeholder until coded) ---
        if (action === 'enter_shrine_portal') {
            inEncounter = true;
            panel.innerHTML = `
                <style>
                    @keyframes portal-pulse {
                        0%   { box-shadow: 0 0 40px rgba(252,211,77,0.4), inset 0 0 20px rgba(252,211,77,0.1); }
                        50%  { box-shadow: 0 0 80px rgba(252,211,77,0.7), inset 0 0 40px rgba(252,211,77,0.2); }
                        100% { box-shadow: 0 0 40px rgba(252,211,77,0.4), inset 0 0 20px rgba(252,211,77,0.1); }
                    }
                    @keyframes portal-glow {
                        0%   { opacity: 0; transform: scale(0.8); }
                        40%  { opacity: 1; transform: scale(1.05); }
                        100% { opacity: 1; transform: scale(1); }
                    }
                </style>
                <div class="encounter-card"
                    style="border-color: #fcd34d; animation: portal-pulse 3s ease-in-out infinite; background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,20,5,0.98));">
                    <div style="font-size: 5rem; animation: portal-glow 1.2s ease-out forwards; filter: drop-shadow(0 0 30px rgba(252,211,77,0.9));">🌅</div>
                    <h2 style="color: #fcd34d; margin-top: 20px; text-transform: uppercase; letter-spacing: 3px; font-size: 1.4rem;">Beyond the Threshold</h2>
                    <p style="color: var(--text-dim); margin: 18px auto; max-width: 480px; line-height: 1.8; font-style: italic;">
                        The light swallows you whole.<br><br>
                        For a moment there is nothing — no sound, no shadow, no fog. Only warmth.<br><br>
                        Then: something new. A world not yet known.
                    </p>
                    <p style="color: #fcd34d; font-size: 0.85rem; letter-spacing: 1px; font-style: normal; opacity: 0.7; margin-bottom: 20px;">
                        [ This realm is not yet awakened. Return when the time is right. ]
                    </p>
                    <button class="submit-btn" style="background: #fcd34d; border-color: #fcd34d; color: #000;"
                        onclick="(() => { inEncounter = false; document.getElementById('encounter-panel').classList.remove('active'); document.getElementById('encounter-panel').innerHTML = ''; updateAdventureHUD(); })()">
                        Step Back
                    </button>
                </div>
            `;
            panel.classList.add('active');
            updateAdventureHUD();

            // --- FUTURE HOOK: Replace this block to load the next land ---
            // switchMap('luminary_land'); // Uncomment and implement when the next land is ready
            return;
        }

        if (action.startsWith('fight_player_')) {
            const playerName = action.replace('fight_player_', '');
            panel.innerHTML = `
                <div class="encounter-card">
                    <div class="encounter-emoji">🤨</div>
                    <h2>Really?</h2>
                    <p style="color: var(--text-dim); margin-top: 10px; max-width: 500px;">This journey is about self-improvement and lifting each other up. Why would you ever choose to beat up ${playerName}? Put the sword away, take a deep breath, and let's try this again.</p>
                    <div class="encounter-btn-group">
                        <button class="submit-btn" onclick="startEncounter(${x}, ${y}, 'player:${playerName}', ${oldPixelX}, ${oldPixelY})">My Bad</button>
                    </div>
                </div>
            `;
            return;

        } else if (action.startsWith('ask_friend_')) {
            const playerName = action.replace('ask_friend_', '');

            if (data.friends_list.includes(playerName)) {
                panel.innerHTML = `
                    <div class="encounter-card">
                        <div class="encounter-emoji">🤝</div>
                        <h2>Already Allies!</h2>
                        <p style="color: var(--text-dim); margin-top: 10px; max-width: 500px;">You and ${playerName} are already friends. Keep up the good work!</p>
                        <button class="submit-btn" style="margin-top: 20px;" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Continue</button>
                    </div>
                `;
            } else {
                db.ref(`heroes/${playerName.toLowerCase()}/friend_requests/${data.hero_name.toLowerCase()}`).set({
                    from: data.hero_name,
                    class: data.hero_class
                });

                data.friends_list.push(playerName);
                updateSaveData(data);
                renderFriendsList();

                panel.innerHTML = `
                    <div class="encounter-card">
                        <div class="encounter-emoji">💌</div>
                        <h2>Request Submitted</h2>
                        <p style="color: var(--text-dim); margin-top: 10px; max-width: 500px;">You offered a hand in friendship to ${playerName}. The cosmos will deliver your message.</p>
                        <button class="submit-btn" style="margin-top: 20px;" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Continue</button>
                    </div>
                `;
            }
            return;

        } else if (action.startsWith('open_chest_')) {
            let chestType = action.replace('open_', '');
            let config = chestTypes[chestType];

            // Add 3 to the base row to target the fully open frame at the bottom of the animation
            let openRow = config.row + 3;

            // Calculate the exact percentage position for a 12x8 grid
            let bgPosX = (config.col / 11) * 100;
            let bgPosY = (openRow / 7) * 100;

            panel.innerHTML = `
                <style>
                    @keyframes chest-shake {
                        0%, 100% { transform: translateX(0) rotate(0deg); }
                        10%  { transform: translateX(-9px) rotate(-4deg); }
                        25%  { transform: translateX(9px)  rotate(4deg);  }
                        40%  { transform: translateX(-7px) rotate(-3deg); }
                        55%  { transform: translateX(7px)  rotate(3deg);  }
                        70%  { transform: translateX(-4px) rotate(-1.5deg); }
                        85%  { transform: translateX(4px)  rotate(1.5deg);  }
                    }
                    @keyframes chest-pop {
                        0%   { transform: scale(1); }
                        50%  { transform: scale(1.15); filter: drop-shadow(0 0 40px ${config.glow}); }
                        100% { transform: scale(1);    filter: drop-shadow(0 0 20px ${config.glow}); }
                    }
                </style>
                <div class="encounter-card">
                    <div style="
                        width: 100px; height: 100px; margin: 0 auto;
                        background-image: url('${gameAssets.chestSprite}');
                        background-size: 1200% 800%;
                        background-position: ${bgPosX}% ${bgPosY}%;
                        filter: drop-shadow(0 0 20px ${config.glow});
                        animation: chest-shake 1.2s ease-in-out, chest-pop 0.4s 1.2s ease-out forwards;
                    "></div>
                    <h2 style="margin-top: 20px; color: var(--text-dim);">Looting the ${config.name.toLowerCase()}...</h2>
                </div>
            `;

            setTimeout(() => {
                let loot = generateLoot(chestType);
                let logMsg;

                if (loot) {
                    if (!data.inventory) data.inventory = [];
                    data.inventory.push(loot);
                    updateSaveData(data);
                    logMsg = `✨ You opened the ${config.name} and found treasure! Found: ${loot.icon} ${loot.name}!`;

                    const rarityName = loot.name.split(' ')[0];
                    let customCSS = '';
                    let cardAnim = 'transform: scale(1.05); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
                    let overlayHTML = '';

                    if (rarityName === 'Mythic') {
                        customCSS = `
                            @keyframes mythic-slam {
                                0% { transform: scale(3) translateY(-100px); opacity: 0; filter: brightness(2) blur(5px); }
                                60% { transform: scale(0.9) translateY(10px); opacity: 1; filter: brightness(1) blur(0px); }
                                80% { transform: scale(1.1) translateY(-5px); }
                                100% { transform: scale(1.05) translateY(0); }
                            }
                            @keyframes mythic-flash {
                                0% { background-color: rgba(239, 68, 68, 0.8); }
                                100% { background-color: transparent; }
                            }
                        `;
                        cardAnim = 'animation: mythic-slam 0.8s ease-out forwards;';
                        overlayHTML = `<div style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; animation: mythic-flash 1.5s ease-out forwards; z-index: -1;"></div>`;

                    } else if (rarityName === 'Legendary') {
                        customCSS = `
                            @keyframes leg-float {
                                0% { transform: scale(0.5) translateY(50px); opacity: 0; }
                                60% { transform: scale(1.1) translateY(-10px); }
                                100% { transform: scale(1.05) translateY(0); }
                            }
                            @keyframes leg-flash {
                                0% { background-color: rgba(249, 115, 22, 0.5); }
                                100% { background-color: transparent; }
                            }
                        `;
                        cardAnim = 'animation: leg-float 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;';
                        overlayHTML = `<div style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; animation: leg-flash 1.2s ease-out forwards; z-index: -1;"></div>`;

                    } else if (rarityName === 'Epic') {
                        customCSS = `
                            @keyframes epic-pop {
                                0% { transform: scale(0.8); opacity: 0; }
                                50% { transform: scale(1.15); opacity: 1; }
                                75% { transform: scale(0.95); }
                                100% { transform: scale(1.05); }
                            }
                        `;
                        cardAnim = 'animation: epic-pop 0.6s ease-out forwards;';
                    }

                    panel.innerHTML = `
                        <style>${customCSS}</style>
                        ${overlayHTML}
                        <div class="encounter-card" style="border-color: ${loot.color}; box-shadow: ${loot.glow}; ${cardAnim}">
                            <div style="font-size: 5rem; text-shadow: ${loot.glow !== 'none' ? loot.glow : 'none'};">${loot.icon}</div>
                            <h2 style="color: ${loot.color}; margin-top: 15px; text-transform: uppercase; letter-spacing: 1px;">${loot.name}</h2>
                            <p style="color: #10b981; font-size: 1.2rem; font-weight: bold; margin: 10px 0;">+${loot.statBonus} ${loot.targetStat.toUpperCase()}</p>
                            <div class="encounter-btn-group">
                                <button class="submit-btn" style="background: ${loot.color}; border-color: ${loot.color}; color: #000;" onclick="resolveEncounter(${x}, ${y}, 'close_chest', ${oldPixelX}, ${oldPixelY})">Take Item</button>
                            </div>
                        </div>
                    `;
                } else {
                    logMsg = `🕸️ You opened the ${config.name}... it was empty.`;
                    panel.innerHTML = `
                        <div class="encounter-card">
                            <div style="font-size: 5rem;">🕸️</div>
                            <h2 style="margin-top: 15px; color: var(--text-dim);">It was empty!</h2>
                            <div class="encounter-btn-group">
                                <button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'close_chest', ${oldPixelX}, ${oldPixelY})">Leave</button>
                            </div>
                        </div>
                    `;
                }

                updateStatusLog(logMsg);

                if (!data.opened_chests) data.opened_chests = {};
                data.opened_chests[`${currentMapId}:${key}`] = true;
                window.myOpenedChests = data.opened_chests;
                updateSaveData(data);

                updateCharacterTabUI();
            }, 1800);

            return;

        } else if (action.startsWith('collect_quest_item_')) {
            let itemId = action.replace('collect_quest_item_', '');
            let qItem = typeof questItems !== 'undefined' ? questItems[itemId] : null;

            if (!data.quest_items) data.quest_items = [];

            if (qItem && !data.quest_items.includes(itemId)) {
                data.quest_items.push(itemId);
                updateSaveData(data);
                updateAdventureHUD();

                let isScroll = itemId === 'scroll';
                let logMsg = isScroll
                    ? `📜 You found the Ancient Scroll. Something stirs — read it carefully.`
                    : `✨ You found the ${qItem.name}! ${5 - data.quest_items.filter(id => typeof SHRINE_CRYSTALS !== 'undefined' && SHRINE_CRYSTALS.includes(id)).length} remain.`;
                updateStatusLog(logMsg);

                if (isScroll) {
                    // Show the scroll's content in the panel
                    let hintsHTML = qItem.hints.map(h => `<li style="margin-bottom: 8px; color: var(--text-dim); text-align: left;">${h}</li>`).join('');
                    panel.innerHTML = `
                        <div class="encounter-card" style="border-color: #fcd34d; box-shadow: 0 0 20px rgba(252,211,77,0.3);">
                            <div style="font-size: 4rem;">📜</div>
                            <h2 style="color: #fcd34d; margin-top: 15px;">The Ancient Scroll</h2>
                            <p style="color: var(--text-dim); margin: 10px 0 5px; font-style: italic;">"Five fragments, scattered when the dark came. Five pieces of something that should never have been broken. Find them. What comes next... you will have to discover yourselves."</p>
                            <ul style="list-style: none; padding: 10px; margin-top: 10px; background: rgba(252,211,77,0.05); border-radius: 8px; border: 1px solid rgba(252,211,77,0.2);">
                                ${hintsHTML}
                            </ul>
                            <div class="encounter-btn-group">
                                <button class="submit-btn" style="background: #fcd34d; border-color: #fcd34d; color: #000;" onclick="resolveEncounter(${x}, ${y}, 'close_chest', ${oldPixelX}, ${oldPixelY})">Roll Up the Scroll</button>
                            </div>
                        </div>
                    `;
                    return;
                } else {
                    panel.innerHTML = `
                        <style>
                            @keyframes crystal-reveal {
                                0% { transform: scale(0.3) rotate(-15deg); opacity: 0; filter: brightness(3) blur(6px); }
                                60% { transform: scale(1.2) rotate(5deg); opacity: 1; filter: brightness(1.5) blur(0); }
                                100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
                            }
                        </style>
                        <div class="encounter-card" style="border-color: ${qItem.color}; box-shadow: ${qItem.glow};">
                            <div style="font-size: 5rem; animation: crystal-reveal 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; filter: drop-shadow(0 0 15px ${qItem.color});">${qItem.icon}</div>
                            <h2 style="color: ${qItem.color}; margin-top: 20px; text-transform: uppercase; letter-spacing: 2px;">${qItem.name}</h2>
                            <p style="color: var(--text-dim); margin: 12px 0; max-width: 400px; font-style: italic;">"${qItem.description}"</p>
                            <div id="crystal-progress-display" style="display: flex; gap: 8px; justify-content: center; margin: 15px 0; font-size: 1.6rem;"></div>
                            <div class="encounter-btn-group">
                                <button class="submit-btn" style="background: ${qItem.color}; border-color: ${qItem.color}; color: #000;" onclick="resolveEncounter(${x}, ${y}, 'close_chest', ${oldPixelX}, ${oldPixelY})">Add to Collection</button>
                            </div>
                        </div>
                    `;
                    // Render the crystal progress dots
                    setTimeout(() => {
                        let progressEl = document.getElementById('crystal-progress-display');
                        if (progressEl && typeof SHRINE_CRYSTALS !== 'undefined') {
                            let fresh = getSaveData();
                            progressEl.innerHTML = SHRINE_CRYSTALS.map(cid => {
                                let has = fresh.quest_items && fresh.quest_items.includes(cid);
                                let ci = typeof questItems !== 'undefined' ? questItems[cid] : null;
                                return `<span title="${ci ? ci.name : cid}" style="opacity: ${has ? 1 : 0.25}; filter: ${has ? 'drop-shadow(0 0 6px ' + (ci ? ci.color : '#fff') + ')' : 'none'};">${ci ? ci.icon : '❓'}</span>`;
                            }).join('');
                        }
                        // Check for shrine formation
                        checkQuestCompletion(getSaveData());
                    }, 100);
                    return;
                }
            } else {
                // Already have it
                panel.innerHTML = `
                    <div class="encounter-card">
                        <div style="font-size: 3rem; opacity: 0.4;">${qItem ? qItem.icon : '📦'}</div>
                        <h2 style="margin-top: 15px; color: var(--text-dim);">Already Claimed</h2>
                        <p style="color: var(--text-dim);">You've already collected this. Its power resonates within you.</p>
                        <div class="encounter-btn-group">
                            <button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'close_chest', ${oldPixelX}, ${oldPixelY})">Continue</button>
                        </div>
                    </div>
                `;
                return;
            }

        } else if (action === 'receive_wizard_gift') {
            if (!data.quest_items) data.quest_items = [];
            let qItem = typeof questItems !== 'undefined' ? questItems['crystal_wisdom'] : null;

            if (qItem && !data.quest_items.includes('crystal_wisdom')) {
                data.quest_items.push('crystal_wisdom');

                // --- WARDEN'S KEY: gifted alongside the Crystal of Wisdom ---
                // The wizard's gift unlocks the Mini-Games tab one time only.
                // After this, every XP gain also yields pachinko tokens at 1/10.
                const isFirstKey = !data.wardens_key;
                if (isFirstKey) {
                    data.wardens_key = true;
                }

                updateSaveData(data);
                updateAdventureHUD();
                updateStatusLog(`🟣 The Mysterious Wizard bestowed the Crystal of Wisdom upon you!`);
                if (isFirstKey) {
                    updateStatusLog(`🗝️ The Wizard also pressed a strange iron Key into your palm — "for the trials between trials."`);
                }

                panel.innerHTML = `
                    <style>
                        @keyframes wizard-gift {
                            0% { transform: translateY(30px) scale(0.5); opacity: 0; filter: brightness(3); }
                            60% { transform: translateY(-10px) scale(1.15); opacity: 1; filter: brightness(1.3); }
                            100% { transform: translateY(0) scale(1); filter: brightness(1); }
                        }
                    </style>
                    <div class="encounter-card" style="border-color: #a855f7; box-shadow: 0 0 30px rgba(168,85,247,0.5);">
                        <div style="font-size: 5rem; animation: wizard-gift 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; filter: drop-shadow(0 0 15px #a855f7);">${qItem.icon}</div>
                        <h2 style="color: #a855f7; margin-top: 20px; text-transform: uppercase; letter-spacing: 2px;">${qItem.name}</h2>
                        <p style="color: var(--text-dim); margin: 12px 0; max-width: 400px; font-style: italic;">"${qItem.description}"</p>
                        <div id="crystal-progress-wiz" style="display: flex; gap: 8px; justify-content: center; margin: 15px 0; font-size: 1.6rem;"></div>
                        <button class="submit-btn" style="margin-top: 10px; background: #a855f7; border-color: #a855f7; color: #fff;" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Thank the Wizard</button>
                    </div>
                `;
                setTimeout(() => {
                    let progressEl = document.getElementById('crystal-progress-wiz');
                    if (progressEl && typeof SHRINE_CRYSTALS !== 'undefined') {
                        let fresh = getSaveData();
                        progressEl.innerHTML = SHRINE_CRYSTALS.map(cid => {
                            let has = fresh.quest_items && fresh.quest_items.includes(cid);
                            let ci = typeof questItems !== 'undefined' ? questItems[cid] : null;
                            return `<span title="${ci ? ci.name : cid}" style="opacity: ${has ? 1 : 0.25}; filter: ${has ? 'drop-shadow(0 0 6px ' + (ci ? ci.color : '#fff') + ')' : 'none'};">${ci ? ci.icon : '❓'}</span>`;
                        }).join('');
                    }
                    checkQuestCompletion(getSaveData());
                }, 100);

                // After the wizard's encounter card, surface the themed Key
                // Unlock modal so the new mechanic is properly introduced.
                if (isFirstKey) {
                    setTimeout(() => showWardensKeyUnlockModal(), 1200);
                }
                updateMinigamesSidebarPanel();
                return;
            } else {
                panel.innerHTML = `
                    <div class="encounter-card" style="border-color: #a855f7;">
                        <div style="font-size: 3rem; opacity: 0.5;">🧙</div>
                        <h2 style="margin-top: 15px; color: #a855f7;">Gift Already Given</h2>
                        <p style="color: var(--text-dim);">The wizard nods at you knowingly. "You already carry it, young one. Go, and awaken the shrine."</p>
                        <button class="submit-btn" style="margin-top: 20px;" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Continue</button>
                    </div>
                `;
                return;
            }

        } else if (action === 'close_chest') {
            // Push the player back slightly so they don't immediately re-collide
            if (window.gameEngine) {
                window.gameEngine.player.x = oldPixelX;
                window.gameEngine.player.y = oldPixelY;
            }

            // ... inside resolveEncounter ...
        } else if (action === 'enter_cave') {
            const caveId = `cave_${key.replace(',', '_')}`;
            await switchMap(caveId); // Added await
        } else if (action === 'leave_cave') {
            await switchMap('overworld'); // Added await

        } else if (action === 'fight') {
            activeBattle = {
                x: x, y: y, oldX: oldPixelX, oldY: oldPixelY,
                enemy: spawnEnemyStats(encounterType, data.stats.level || 1)
            };

            if (!data.adventure_state) data.adventure_state = {};
            data.adventure_state.active_encounter = { phase: 'battle', battleState: activeBattle };
            updateSaveData(data);

            renderBattleUI("The creature prepares to strike. Defend yourself!");
            return;

        } else if (action === 'win_fight') {
            let isBossMonster = gameMonsters[encounterType] && gameMonsters[encounterType].isBoss;
            let xpGained = isBossMonster ? 150 : 25;
            let loot = generateLoot(encounterType);
            let logMsg = `⚔️ You defeated the ${gameMonsters[encounterType] ? gameMonsters[encounterType].name : encounterType} and gained ${xpGained} XP!`;

            if (loot) {
                if (!data.inventory) data.inventory = [];
                data.inventory.push(loot);
                logMsg += ` Found: ${loot.icon} ${loot.name}!`;
            }

            updateStatusLog(logMsg);
            updateSaveData(data); // persist loot before awardXP loads a fresh data snapshot
            let leveled = awardXP(xpGained);
            data = getSaveData(); // re-sync so the end-of-function updateSaveData doesn't overwrite XP/unspent_points
            if (leveled) updateStatusLog("⬆️ LEVEL UP!");

            // Note: The Mini-Games tab is no longer unlocked by random monster
            // drops — it's gifted by the Mysterious Wizard as the "Warden's Key".
            // See the receive_wizard_gift handler below.

            db.ref(entityPath).remove();
            if (window.gridEntities) delete window.gridEntities[key];

            // Push the player back so they don't accidentally fight a ghost before Firebase syncs!
            if (window.gameEngine) {
                window.gameEngine.player.x = oldPixelX;
                window.gameEngine.player.y = oldPixelY;
            }

            // --- BOSS SQUIRREL: Award Crystal of Courage ---
            if (encounterType === 'boss_squirrel') {
                data = getSaveData(); // refresh after awardXP
                if (!data.quest_items) data.quest_items = [];
                let qItem = typeof questItems !== 'undefined' ? questItems['crystal_courage'] : null;

                if (qItem && !data.quest_items.includes('crystal_courage')) {
                    data.quest_items.push('crystal_courage');
                    updateSaveData(data);
                    updateAdventureHUD();

                    inEncounter = false;
                    panel.classList.remove('active');
                    panel.innerHTML = '';

                    setTimeout(() => {
                        inEncounter = true;
                        panel.classList.add('active');
                        let crystalCount = data.quest_items.filter(id => typeof SHRINE_CRYSTALS !== 'undefined' && SHRINE_CRYSTALS.includes(id)).length;
                        panel.innerHTML = `
                            <style>
                                @keyframes squirrel-drop {
                                    0% { transform: scale(3) translateY(-80px); opacity: 0; filter: brightness(3); }
                                    50% { transform: scale(0.8) translateY(10px); filter: brightness(1.5); }
                                    100% { transform: scale(1) translateY(0); filter: brightness(1); }
                                }
                            </style>
                            <div class="encounter-card" style="border-color: #fcd34d; box-shadow: 0 0 30px rgba(252,211,77,0.5);">
                                <div style="font-size: 5rem; animation: squirrel-drop 0.9s ease-out forwards; filter: drop-shadow(0 0 15px #fcd34d);">🟡</div>
                                <h2 style="color: #fcd34d; margin-top: 20px; text-transform: uppercase; letter-spacing: 2px;">Crystal of Courage</h2>
                                <p style="color: var(--text-dim); margin: 12px 0; max-width: 400px;">The creature has fallen. From its scattered hoard, something ancient and warm tumbles free...</p>
                                <p style="color: var(--text-dim); font-style: italic;">"${qItem.description}"</p>
                                <div style="display: flex; gap: 8px; justify-content: center; margin: 15px 0; font-size: 1.6rem;">
                                    ${typeof SHRINE_CRYSTALS !== 'undefined' ? SHRINE_CRYSTALS.map(cid => {
                            let has = data.quest_items.includes(cid);
                            let ci = typeof questItems !== 'undefined' ? questItems[cid] : null;
                            return `<span style="opacity: ${has ? 1 : 0.25};">${ci ? ci.icon : '❓'}</span>`;
                        }).join('') : ''}
                                </div>
                                <p style="color: #fcd34d; font-size: 0.9rem;">${crystalCount} / 5 Crystals found</p>
                                <button class="submit-btn" style="margin-top: 10px; background: #fcd34d; border-color: #fcd34d; color: #000;" onclick="window._closeQuestPanel()">Claim Victory</button>
                            </div>
                        `;
                        window._closeQuestPanel = () => {
                            inEncounter = false;
                            panel.classList.remove('active');
                            panel.innerHTML = '';
                            updateAdventureHUD();
                            updateCharacterTabUI();
                            checkQuestCompletion(getSaveData());
                        };
                    }, 600);
                    return; // Skip normal close flow
                }
            }

            // --- BOSS DOOM SCROLLER: Award Crystal of Vitality ---
            if (encounterType === 'boss_doom_scroller') {
                data = getSaveData();
                if (!data.quest_items) data.quest_items = [];
                let qItem = typeof questItems !== 'undefined' ? questItems['crystal_vitality'] : null;

                if (qItem && !data.quest_items.includes('crystal_vitality')) {
                    data.quest_items.push('crystal_vitality');
                    updateSaveData(data);
                    updateAdventureHUD();

                    inEncounter = false;
                    panel.classList.remove('active');
                    panel.innerHTML = '';

                    setTimeout(() => {
                        inEncounter = true;
                        panel.classList.add('active');
                        let crystalCount = data.quest_items.filter(id => typeof SHRINE_CRYSTALS !== 'undefined' && SHRINE_CRYSTALS.includes(id)).length;
                        panel.innerHTML = `
                            <style>
                                @keyframes doom-drop {
                                    0% { transform: scale(3) translateY(-80px); opacity: 0; filter: brightness(3); }
                                    50% { transform: scale(0.8) translateY(10px); filter: brightness(1.5); }
                                    100% { transform: scale(1) translateY(0); filter: brightness(1); }
                                }
                            </style>
                            <div class="encounter-card" style="border-color: #ef4444; box-shadow: 0 0 30px rgba(239,68,68,0.5);">
                                <div style="font-size: 5rem; animation: doom-drop 0.9s ease-out forwards; filter: drop-shadow(0 0 15px #ef4444);">🔴</div>
                                <h2 style="color: #ef4444; margin-top: 20px; text-transform: uppercase; letter-spacing: 2px;">Crystal of Vitality</h2>
                                <p style="color: var(--text-dim); margin: 12px 0; max-width: 400px;">The endless scroll has stopped. In the sudden silence, something pulses with life — red and warm and real.</p>
                                <p style="color: var(--text-dim); font-style: italic;">"${qItem.description}"</p>
                                <div style="display: flex; gap: 8px; justify-content: center; margin: 15px 0; font-size: 1.6rem;">
                                    ${typeof SHRINE_CRYSTALS !== 'undefined' ? SHRINE_CRYSTALS.map(cid => {
                            let has = data.quest_items.includes(cid);
                            let ci = typeof questItems !== 'undefined' ? questItems[cid] : null;
                            return `<span style="opacity: ${has ? 1 : 0.25};">${ci ? ci.icon : '❓'}</span>`;
                        }).join('') : ''}
                                </div>
                                <p style="color: #ef4444; font-size: 0.9rem;">${crystalCount} / 5 Crystals found</p>
                                <button class="submit-btn" style="margin-top: 10px; background: #ef4444; border-color: #ef4444; color: #fff;" onclick="window._closeQuestPanel()">Take It</button>
                            </div>
                        `;
                        window._closeQuestPanel = () => {
                            inEncounter = false;
                            panel.classList.remove('active');
                            panel.innerHTML = '';
                            updateAdventureHUD();
                            updateCharacterTabUI();
                            checkQuestCompletion(getSaveData());
                        };
                    }, 600);
                    return;
                }
            }

        } else if (action === 'flee') {
            // --- FLEE: costs 10 energy, 50% chance of a parting blow ---
            const FLEE_ENERGY_COST = 10;
            if (window.gameEngine && window.gameEngine.currentEnergy !== null) {
                window.gameEngine.currentEnergy = Math.max(0, window.gameEngine.currentEnergy - FLEE_ENERGY_COST);
                if (window.gameEngine.currentEnergy <= 0) window.gameEngine.isExhausted = true;
            }
            if (data.stats) {
                data.stats.current_energy = Math.max(0, (data.stats.current_energy || 0) - FLEE_ENERGY_COST);
            }

            const fleeEncounterType = gridEntities[`${x},${y}`] || 'slime';
            if (Math.random() < 0.5 && gameMonsters[fleeEncounterType]) {
                const fleeEnemy = spawnEnemyStats(fleeEncounterType, data.stats.level || 1);
                const pDef = getTotalStat(data, 'def');
                let eDmg = Math.max(1, Math.floor((fleeEnemy.str - pDef) * (0.8 + Math.random() * 0.4)));
                data.stats.current_hp = Math.max(0, data.stats.current_hp - eDmg);
                updateSaveData(data);
                updateStatusLog(`🏃 You fled but took ${eDmg} damage escaping! (−${FLEE_ENERGY_COST} energy)`);
                if (data.stats.current_hp <= 0) { handlePlayerDeath(); return; }
            } else {
                updateSaveData(data);
                updateStatusLog(`🏃 You got away safely — but it cost ${FLEE_ENERGY_COST} energy!`);
            }

            if (window.gameEngine) {
                window.gameEngine.player.x = oldPixelX;
                window.gameEngine.player.y = oldPixelY;
            }
            syncPlayerPosition();

        } else if (action === 'collect_personal_scroll') {
            // --- PICK UP THE PERSONAL SCROLL ---
            // Gives the 'scroll' quest item (same as the shared scroll), then erases
            // both the sparkle path and the local scroll entity so they vanish for good.
            let qItem = typeof questItems !== 'undefined' ? questItems['scroll'] : null;
            if (!data.quest_items) data.quest_items = [];

            if (qItem && !data.quest_items.includes('scroll')) {
                data.quest_items.push('scroll');
                updateSaveData(data);
                updateAdventureHUD();
                updateStatusLog(`📜 You found the Ancient Scroll. Something stirs — read it carefully.`);
            }

            // Show the scroll's content — same panel as the shared scroll
            let hintsHTML = qItem && qItem.hints
                ? qItem.hints.map(h => `<li style="margin-bottom: 8px; color: var(--text-dim); text-align: left;">${h}</li>`).join('')
                : '';

            panel.innerHTML = `
                <div class="encounter-card" style="border-color: #fcd34d; box-shadow: 0 0 20px rgba(252,211,77,0.3);">
                    <div style="font-size: 4rem;">📜</div>
                    <h2 style="color: #fcd34d; margin-top: 15px;">The Ancient Scroll</h2>
                    <p style="color: var(--text-dim); margin: 10px 0 5px; font-style: italic;">"Five fragments, scattered when the dark came. Five pieces of something that should never have been broken. Find them. What comes next... you will have to discover yourselves."</p>
                    <ul style="list-style: none; padding: 10px; margin-top: 10px; background: rgba(252,211,77,0.05); border-radius: 8px; border: 1px solid rgba(252,211,77,0.2);">
                        ${hintsHTML}
                    </ul>
                    <div class="encounter-btn-group">
                        <button class="submit-btn" style="background: #fcd34d; border-color: #fcd34d; color: #000;"
                            onclick="resolveEncounter(${x}, ${y}, 'close_personal_scroll', ${oldPixelX}, ${oldPixelY})">
                            Roll Up the Scroll
                        </button>
                    </div>
                </div>
            `;
            return; // Stay in the panel; close_personal_scroll will handle cleanup

        } else if (action === 'close_personal_scroll') {
            // --- ERASE THE PERSONAL SCROLL & ITS TRAIL ---
            // Called when the player finishes reading the personal scroll.
            // Wipe the sparkle path and the local scroll marker so they permanently vanish.
            window.sparklePathTiles = null;
            window.personalScrollKey = null;

            // Remove the stored tile from the main save so it never comes back
            const _lSave = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
            _lSave.personal_scroll = null;
            localStorage.setItem('motivation_RPG', JSON.stringify(_lSave));

            // Allow the proximity trigger to fire again if this player ever re-approaches
            // (shouldn't happen since personalScrollKey is now null, but defensive reset)
            if (window.gameEngine) window.gameEngine.personalScrollEncounterSeen = false;

            // Fall through to the generic close logic below

        } else if (action === 'leave' || action === 'leave_cave') {
            updateStatusLog("You walked away.");

            // If the player walked away from their personal scroll, reset the flag so
            // they can trigger the encounter again when they come back.
            if (window.gameEngine) window.gameEngine.personalScrollEncounterSeen = false;

            // Apply the bounce back in the new engine!
            if (window.gameEngine) {
                window.gameEngine.player.x = oldPixelX;
                window.gameEngine.player.y = oldPixelY;
            }

            syncPlayerPosition();
        }
        if (data.adventure_state) data.adventure_state.active_encounter = null;
        updateSaveData(data);

        inEncounter = false;
        panel.classList.remove('active');
        panel.innerHTML = '';
        updateAdventureHUD();
        updateCharacterTabUI();
    };

    function applyZoom(newSize) {
        newSize = Math.max(30, Math.min(140, newSize));

        // Update the slider UI
        if (zoomSlider) zoomSlider.value = newSize;

        // Feed it to the new engine! (40 remains the mathematical divisor to scale correctly)
        if (window.gameEngine) {
            window.gameEngine.setZoom(newSize / 40);
        }
    }

    // --- STEP 1: FOG PATH EXPOSITION ---
    // Fires the first time a player sees another player's explored fog trail.
    window.triggerFogPathExposition = function triggerFogPathExposition() {
        let data = getSaveData();
        // Already triggered — do nothing
        if (data.adventure_state && data.adventure_state.saw_other_fog) return;
        // Wait if already in an encounter
        if (inEncounter) {
            setTimeout(triggerFogPathExposition, 1500);
            return;
        }

        // Persist the flag so it never fires again
        if (!data.adventure_state) data.adventure_state = {};
        data.adventure_state.saw_other_fog = true;
        updateSaveData(data);

        // Freeze the player
        if (window.gameEngine) {
            window.gameEngine.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
        }
        inEncounter = true;

        const panel = document.getElementById('encounter-panel');
        if (!panel) return;
        panel.classList.add('active');
        panel.innerHTML = `
            <style>
                @keyframes fog-fade-in {
                    0%   { opacity: 0; transform: scale(0.96) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
            </style>
            <div class="encounter-card" style="border-color: rgba(148, 163, 184, 0.4); box-shadow: 0 0 40px rgba(100, 116, 139, 0.25); animation: fog-fade-in 0.7s ease-out forwards;">
                <div style="font-size: 3.5rem; margin-bottom: 10px; filter: drop-shadow(0 0 12px rgba(255,255,255,0.3));">🌫️</div>
                <h2 style="color: var(--text-dim); letter-spacing: 2px; text-transform: uppercase; font-size: 1.1rem;">A Path in the Dark</h2>
                <p style="color: var(--text-dim); margin: 18px auto; max-width: 480px; line-height: 1.8; font-style: italic;">
                    You stop.<br><br>
                    There, in the fog — a trail of light. Not your own. Someone else has walked here.
                    The darkness peels back along a path that was not made by your feet.<br><br>
                    That is <em>strange</em>. You are not alone in this realm.<br><br>
                    <span style="color: var(--text-main); font-style: normal; font-size: 0.9rem;">Perhaps you should follow it...</span>
                </p>
                <button class="submit-btn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-dim);"
                    onclick="(() => { inEncounter = false; document.getElementById('encounter-panel').classList.remove('active'); document.getElementById('encounter-panel').innerHTML = ''; updateAdventureHUD(); })()">
                    Press On
                </button>
            </div>
        `;
        updateAdventureHUD();
    };

    // --- SPARKLE PATH EXPOSITION ---
    window.triggerSparklePathExposition = function triggerSparklePathExposition() {
        let data = getSaveData();
        // Already triggered — do nothing
        if (data.adventure_state && data.adventure_state.saw_sparkle_path) return;
        // Wait if already in an encounter
        if (inEncounter) {
            setTimeout(triggerSparklePathExposition, 1500);
            return;
        }

        // Persist the flag so it never fires again
        if (!data.adventure_state) data.adventure_state = {};
        data.adventure_state.saw_sparkle_path = true;
        updateSaveData(data);

        // Freeze the player
        if (window.gameEngine) {
            window.gameEngine.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
        }
        inEncounter = true;

        const panel = document.getElementById('encounter-panel');
        if (!panel) return;
        panel.classList.add('active');
        panel.innerHTML = `
            <style>
                @keyframes sparkle-fade-in {
                    0%   { opacity: 0; transform: scale(0.95) translateY(12px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes sparkle-float {
                    0%, 100% { transform: translateY(0px) scale(1);   opacity: 0.7; }
                    50%       { transform: translateY(-5px) scale(1.1); opacity: 1; }
                }
            </style>
            <div class="encounter-card" style="border-color: rgba(251, 211, 80, 0.35); box-shadow: 0 0 40px rgba(251, 200, 60, 0.15); animation: sparkle-fade-in 0.7s ease-out forwards;">
                <div style="font-size: 3.2rem; margin-bottom: 10px; animation: sparkle-float 2.4s ease-in-out infinite; display:inline-block;">✨</div>
                <h2 style="color: rgba(253, 224, 110, 0.9); letter-spacing: 2px; text-transform: uppercase; font-size: 1.1rem;">Something Glimmers</h2>
                <p style="color: var(--text-dim); margin: 18px auto; max-width: 480px; line-height: 1.8; font-style: italic;">
                    You pause.<br><br>
                    There — barely visible in the dark — a faint trail of light drifts across the ground.
                    Golden. Warm. It did not come from your lantern.<br><br>
                    The sparks drift forward, as if beckoning. Whoever — or <em>whatever</em> — left this path
                    wants you to follow it.<br><br>
                    <span style="color: var(--text-main); font-style: normal; font-size: 0.9rem;">Perhaps something waits at the end of the trail...</span>
                </p>
                <button class="submit-btn" style="background: transparent; border: 1px solid rgba(251, 211, 80, 0.3); color: rgba(253, 224, 110, 0.7);"
                    onclick="(() => { inEncounter = false; document.getElementById('encounter-panel').classList.remove('active'); document.getElementById('encounter-panel').innerHTML = ''; updateAdventureHUD(); })()">
                    Follow the Light
                </button>
            </div>
        `;
        updateAdventureHUD();
    };

    // --- QUEST COMPLETION ENGINE ---
    function checkQuestCompletion(data) {
        if (typeof SHRINE_CRYSTALS === 'undefined' || typeof questItems === 'undefined') return;
        if (!data.quest_items) return;

        const hasAllCrystals = SHRINE_CRYSTALS.every(id => data.quest_items.includes(id));
        if (!hasAllCrystals) return;
        if (data.quest_items.includes('shrine_formed')) return; // Already triggered

        // Mark shrine as formed
        data.quest_items.push('shrine_formed');
        updateSaveData(data);

        // Place the shrine entity in the overworld world at a fixed position
        const shrineKey = '50,40';
        db.ref(`realm/shared_map/gridEntities/${shrineKey}`).set('shrine');
        if (window.gridEntities) window.gridEntities[shrineKey] = 'shrine';

        // Show the celebration after a short delay
        setTimeout(() => showShrineFormation(), 400);
    }

    function showShrineFormation() {
        inEncounter = true;
        const panel = document.getElementById('encounter-panel');
        if (!panel) return;
        panel.classList.add('active');

        panel.innerHTML = `
            <style>
                @keyframes shrine-rise {
                    0%   { transform: scale(0) rotate(-20deg); opacity: 0; filter: brightness(4) blur(10px); }
                    50%  { transform: scale(1.3) rotate(5deg); opacity: 1; filter: brightness(2) blur(0); }
                    75%  { transform: scale(0.95) rotate(-2deg); filter: brightness(1.3); }
                    100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
                }
                @keyframes shrine-flash {
                    0%   { background: rgba(252, 211, 77, 0.7); }
                    100% { background: transparent; }
                }
                @keyframes crystal-orbit {
                    0%   { transform: rotate(0deg) translateX(60px) rotate(0deg); }
                    100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
                }
            </style>
            <div style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;
                        animation: shrine-flash 2s ease-out forwards; z-index: -1;"></div>
            <div class="encounter-card" style="border-color: #fcd34d; box-shadow: 0 0 60px rgba(252,211,77,0.6), inset 0 0 30px rgba(252,211,77,0.1); position: relative; overflow: visible;">

                <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 20px;">
                    <div style="font-size: 5rem; animation: shrine-rise 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                                filter: drop-shadow(0 0 25px rgba(252,211,77,0.9)); position: absolute; top: 50%; left: 50%;
                                transform: translate(-50%, -50%);">🏛️</div>
                </div>

                <h2 style="color: #fcd34d; font-size: 1.8rem; text-transform: uppercase; letter-spacing: 3px; margin-top: 10px;">
                    Shrine Awakened!
                </h2>

                <p style="color: var(--text-dim); margin: 15px 0; max-width: 500px; line-height: 1.7;">
                    The five Resonating Crystals pulse in unison. A blinding light erupts from the earth.
                    Where once there was only fog and doubt, a <strong style="color: #fcd34d;">Shrine of Discipline</strong> now stands —
                    a monument forged from your own perseverance.
                </p>

                <div style="display: flex; gap: 12px; justify-content: center; margin: 20px 0; font-size: 2rem;">
                    ${typeof SHRINE_CRYSTALS !== 'undefined' && typeof questItems !== 'undefined'
                ? SHRINE_CRYSTALS.map(cid => {
                    let ci = questItems[cid];
                    return `<span style="filter: drop-shadow(0 0 8px ${ci ? ci.color : '#fff'}); animation: shrine-rise ${0.4 + SHRINE_CRYSTALS.indexOf(cid) * 0.15}s ease-out both;">${ci ? ci.icon : '❓'}</span>`;
                }).join('')
                : ''}
                </div>

                <p style="color: #fcd34d; font-size: 0.9rem; letter-spacing: 1px; margin-bottom: 20px; font-style: italic;">
                    Something has changed in the realm. You can feel it. Seek what has awakened.
                </p>

                <button class="submit-btn" style="background: #fcd34d; border-color: #fcd34d; color: #000; font-size: 1.1rem; padding: 12px 40px;"
                    onclick="(() => { inEncounter = false; document.getElementById('encounter-panel').classList.remove('active'); document.getElementById('encounter-panel').innerHTML = ''; updateAdventureHUD(); updateCharacterTabUI(); })()">
                    ✨ Claim Your Legacy
                </button>
            </div>
        `;

        updateStatusLog("🏛️ Something ancient stirs in the realm. A light has appeared where there was only fog.");
    }

    // --- Combat & Progression Helpers ---
    // --- WARDEN'S KEY: Pachinko token earning ----------------------------
    // After the player has been gifted the Warden's Key by the Mysterious
    // Wizard, every XP gain also yields pachinko tokens at a rate of 1 token
    // per 10 XP.  Fractional remainders are carried forward via the
    // pachinko_xp_remainder field so no XP is wasted between gains.
    //
    // Returns the number of WHOLE tokens granted by this call (0 if none).
    function grantPachinkoTokensFromXP(xpAmount) {
        if (!xpAmount || xpAmount <= 0) return 0;

        let data = getSaveData();
        if (!data.wardens_key) return 0;   // Locked until the wizard's gift

        const carry = Math.floor(data.pachinko_xp_remainder || 0);
        const totalXP = carry + Math.floor(xpAmount);

        const tokensEarned = Math.floor(totalXP / 10);
        const newRemainder = totalXP - tokensEarned * 10;

        data.pachinko_xp_remainder = newRemainder;
        if (tokensEarned > 0) {
            data.pachinko_tokens = (data.pachinko_tokens || 0) + tokensEarned;
        }
        updateSaveData(data);

        if (tokensEarned > 0) {
            // Surface the gain in the live status log
            updateStatusLog(`🎟️ Earned ${tokensEarned} Pachinko Token${tokensEarned === 1 ? '' : 's'} from your efforts! (${data.pachinko_tokens} total)`);
            updateMinigamesSidebarPanel();
        }
        return tokensEarned;
    }

    function awardXP(amount) {
        let data = getSaveData();
        data.stats.xp += amount;

        let leveledUp = false;
        let requiredXP = data.stats.level * 100;

        while (data.stats.xp >= requiredXP) {
            data.stats.xp -= requiredXP;
            data.stats.level++;
            data.stats.unspent_points += 3;
            leveledUp = true;
            requiredXP = data.stats.level * 100;

            data.stats.current_hp = 50 + (data.stats.vit * 10);
            data.stats.current_energy = 20 + (data.stats.end * 5);
        }

        updateSaveData(data);
        updateCharacterTabUI();
        updateProfileUI();

        // Pachinko tokens accrue alongside XP once the wizard's key is owned.
        grantPachinkoTokensFromXP(amount);

        return leveledUp;
    }

    function generateLoot(enemyType) {
        let dropChance = 0.35; // Default drop rate for regular monsters

        if (enemyType === 'boss') {
            dropChance = 1.0;
        } else if (enemyType.startsWith('chest_')) {
            // Dynamic drop rates based on chest rarity
            if (enemyType === 'chest_tier1') dropChance = 0.50;      // 50% chance of loot (50% empty)
            else if (enemyType === 'chest_tier2') dropChance = 0.65; // 65% chance of loot (35% empty)
            else if (enemyType === 'chest_tier3') dropChance = 0.80; // 80% chance of loot (20% empty)
            else if (enemyType === 'chest_tier4') dropChance = 0.90; // 90% chance of loot (10% empty)
            else if (enemyType === 'chest_tier5') dropChance = 0.95; // 95% chance of loot (5% empty)
            else dropChance = 1.0;                                   // Tiers 6, 7, and 8 always have loot
        }

        if (Math.random() > dropChance) return null;

        const types = ['weapon', 'armor', 'accessory'];

        let roll = Math.random() * 100;

        if (enemyType === 'boss') roll = 65 + Math.random() * 35;

        // Massive scaling based on the 8 chest tiers
        else if (enemyType === 'chest_tier1') roll = Math.random() * 25;           // Strictly Common
        else if (enemyType === 'chest_tier2') roll = 10 + Math.random() * 35;      // Common / Uncommon
        else if (enemyType === 'chest_tier3') roll = 25 + Math.random() * 35;      // Uncommon / Rare
        else if (enemyType === 'chest_tier4') roll = 40 + Math.random() * 35;      // Rare focused
        else if (enemyType === 'chest_tier5') roll = 50 + Math.random() * 40;      // Rare / Epic
        else if (enemyType === 'chest_tier6') roll = 65 + Math.random() * 30;      // Epic focused
        else if (enemyType === 'chest_tier7') roll = 80 + Math.random() * 18;      // Epic / Legendary
        else if (enemyType === 'chest_tier8') roll = 95 + Math.random() * 5;       // Legendary / Mythic Guaranteed
        let selectedRarity = lootConfig.rarities[0];
        let cumulativeWeight = 0;
        for (let r of lootConfig.rarities) {
            cumulativeWeight += r.weight;
            if (roll <= cumulativeWeight) {
                selectedRarity = r;
                break;
            }
        }

        const type = types[Math.floor(Math.random() * types.length)];
        const noun = lootConfig.nouns[type][Math.floor(Math.random() * lootConfig.nouns[type].length)];

        let targetStat = '';
        if (type === 'weapon') targetStat = 'str';
        else if (type === 'armor') targetStat = 'def';
        else {
            const stats = ['str', 'def', 'vit', 'int', 'end'];
            targetStat = stats[Math.floor(Math.random() * stats.length)];
        }

        const statBonus = Math.floor(Math.random() * (selectedRarity.statMax - selectedRarity.statMin + 1)) + selectedRarity.statMin;

        return {
            id: Date.now().toString() + Math.floor(Math.random() * 1000),
            name: `${selectedRarity.name} ${noun}`,
            type: type,
            icon: lootConfig.icons[type],
            statBonus: statBonus,
            targetStat: targetStat,
            color: selectedRarity.color,
            glow: selectedRarity.glow
        };
    }

    // --- Combat Mechanics ---
    function getTotalStat(data, statName) {
        let eq = data.equipped || { weapon: null, armor: null, accessory: null };
        let bonus = 0;
        Object.values(eq).forEach(item => {
            if (item && item.targetStat === statName) bonus += item.statBonus;
        });
        return data.stats[statName] + bonus;
    }

    function spawnEnemyStats(type, playerLevel) {
        let template = gameMonsters[type];

        // Safety fallback for old database saves using generic names
        if (!template) {
            template = gameMonsters['slime'];
        }

        let multiplier = 1 + (Math.max(0, playerLevel - 1) * 0.15);

        return {
            name: template.name,
            img: template.battleImg, // Pulls the URL for the encounter panel
            type: type,
            maxHp: Math.floor(template.hp * multiplier),
            hp: Math.floor(template.hp * multiplier),
            str: Math.floor(template.str * multiplier),
            def: Math.floor(template.def * multiplier)
        };
    }

    function handlePlayerDeath() {
        let data = getSaveData();

        data.stats.xp = Math.floor(data.stats.xp / 2);
        data.stats.current_hp = 50 + (getTotalStat(data, 'vit') * 10);

        if (data.adventure_state) data.adventure_state.active_encounter = null;

        updateSaveData(data);
        updateCharacterTabUI();

        updateStatusLog("☠️ You were defeated! You awake at the surface, having lost some XP.");
        inEncounter = false;
        const panel = document.getElementById('encounter-panel');
        panel.classList.remove('active');
        panel.innerHTML = '';

        if (currentMapId !== 'overworld') {
            switchMap('overworld');
        } else {
            // Return to spawn location, falling back to map center if unavailable
            const spawn = window.gameEngine && window.gameEngine.spawnLocation;
            window.gameEngine.player.x = spawn ? spawn.x : 75 * ENGINE.TILE_SIZE;
            window.gameEngine.player.y = spawn ? spawn.y : 75 * ENGINE.TILE_SIZE;
            syncPlayerPosition();
        }
        updateAdventureHUD();
    }

    function renderBattleUI(msg) {
        let data = getSaveData();
        const panel = document.getElementById('encounter-panel');

        let pStr = getTotalStat(data, 'str');
        let pDef = getTotalStat(data, 'def');
        let maxHp = 50 + (getTotalStat(data, 'vit') * 10);
        let playerHpPercent = Math.min(100, Math.max(0, (data.stats.current_hp / maxHp) * 100));

        let enemy = activeBattle.enemy;
        let enemyHpPercent = Math.min(100, Math.max(0, (enemy.hp / enemy.maxHp) * 100));

        // Compute the correct portrait frame for the player's current level
        const { col: pCol, row: pRow } = getPortraitFrameIndex(data.stats?.level || 1);

        panel.innerHTML = `
            <div class="battle-arena">
                <div class="battle-header-msg">${msg}</div>
                
                <div class="battle-combatants">
                    <div class="combatant-card">
                        <div class="combatant-name" style="color: var(--accent-color);">${data.hero_name}</div>
                        <div class="combatant-avatar" style="border-color: var(--accent-color); position: relative;">
                            <img src="${getHeroImage(data.hero_class)}" alt="Hero" style="position: absolute; width: 500%; height: 200%; left: ${-pCol * 100}%; top: ${-pRow * 100}%; max-width: none; max-height: none;">
                        </div>
                        <div class="combatant-stats">
                            <div style="display: flex; justify-content: space-between;">
                                <span>HP</span>
                                <span>${data.stats.current_hp} / ${maxHp}</span>
                            </div>
                            <div class="hp-bar-bg"><div class="hp-bar-fill" style="width: ${playerHpPercent}%; background: #10b981;"></div></div>
                            <div style="display: flex; justify-content: space-between; color: var(--text-dim);">
                                <span>⚔️ STR: ${pStr}</span>
                                <span>🛡️ DEF: ${pDef}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="battle-vs">VS</div>
                    
                    <div class="combatant-card">
                        <div class="combatant-name" style="color: #ef4444;">${enemy.name}</div>
                        <div class="combatant-avatar" style="border-color: #ef4444;">
                            <img src="${enemy.img}" alt="${enemy.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">
                        </div>
                        <div class="combatant-stats">
                            <div style="display: flex; justify-content: space-between;">
                                <span>HP</span>
                                <span>${enemy.hp} / ${enemy.maxHp}</span>
                            </div>
                            <div class="hp-bar-bg"><div class="hp-bar-fill" style="width: ${enemyHpPercent}%; background: #ef4444;"></div></div>
                            <div style="display: flex; justify-content: space-between; color: var(--text-dim);">
                                <span>⚔️ STR: ${enemy.str}</span>
                                <span>🛡️ DEF: ${enemy.def}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 20px; width: 100%; margin-top: auto; padding-top: 20px;">
                    <button class="submit-btn" style="background: #ef4444; border-color: #ef4444; width: 160px; flex: none; margin: 0;" onclick="executeBattleTurn('attack')">Attack</button>
                    <button class="submit-btn" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; width: 160px; flex: none; margin: 0;" onclick="executeBattleTurn('flee')">Flee (−10 energy)</button>
                </div>
            </div>
        `;
    }

    window.executeBattleTurn = function (action) {
        let data = getSaveData();
        let enemy = activeBattle.enemy;
        let pStr = getTotalStat(data, 'str');
        let pDef = getTotalStat(data, 'def');

        if (action === 'flee') {
            const FLEE_ENERGY_COST = 10;
            if (window.gameEngine && window.gameEngine.currentEnergy !== null) {
                window.gameEngine.currentEnergy = Math.max(0, window.gameEngine.currentEnergy - FLEE_ENERGY_COST);
                if (window.gameEngine.currentEnergy <= 0) window.gameEngine.isExhausted = true;
            }
            data.stats.current_energy = Math.max(0, (data.stats.current_energy || 0) - FLEE_ENERGY_COST);

            let eDmg = Math.max(1, enemy.str - pDef);
            data.stats.current_hp -= eDmg;
            updateSaveData(data);
            updateCharacterTabUI();

            if (data.stats.current_hp <= 0) {
                handlePlayerDeath();
            } else {
                updateStatusLog(`You fled, taking ${eDmg} damage and losing ${FLEE_ENERGY_COST} energy!`);
                // Call 'leave' so resolveEncounter doesn't double-charge energy
                resolveEncounter(activeBattle.x, activeBattle.y, 'leave', activeBattle.oldX, activeBattle.oldY);
            }
            return;
        }

        if (action === 'attack') {
            let pDmg = Math.max(1, pStr - enemy.def);
            pDmg = Math.floor(pDmg * (0.8 + Math.random() * 0.4));
            if (pDmg < 1) pDmg = 1;

            enemy.hp -= pDmg;

            if (enemy.hp <= 0) {
                resolveEncounter(activeBattle.x, activeBattle.y, 'win_fight', activeBattle.oldX, activeBattle.oldY);
                return;
            }

            let eDmg = Math.max(1, enemy.str - pDef);
            eDmg = Math.floor(eDmg * (0.8 + Math.random() * 0.4));
            if (eDmg < 1) eDmg = 1;

            data.stats.current_hp -= eDmg;
            if (!data.adventure_state) data.adventure_state = {};
            data.adventure_state.active_encounter = { phase: 'battle', battleState: activeBattle };

            updateSaveData(data);
            updateAdventureHUD();
            updateCharacterTabUI();

            if (data.stats.current_hp <= 0) {
                handlePlayerDeath();
            } else {
                renderBattleUI(`You slashed for ${pDmg} dmg!<br>It struck back for ${eDmg} dmg!`);
            }
        }
    };

    window.allocateStatPoint = function (statKey) {
        let data = getSaveData();
        const availablePoints = data.stats.unspent_points - pendingPointsUsed;

        if (availablePoints > 0) {
            pendingStatAllocations[statKey]++;
            pendingPointsUsed++;
            updateCharacterTabUI();
        }
    };

    window.deallocateStatPoint = function (statKey) {
        if (pendingStatAllocations[statKey] > 0) {
            pendingStatAllocations[statKey]--;
            pendingPointsUsed--;
            updateCharacterTabUI();
        }
    };

    window.saveStatAllocations = function () {
        if (pendingPointsUsed === 0) return;
        let data = getSaveData();

        for (const key of Object.keys(pendingStatAllocations)) {
            const amt = pendingStatAllocations[key];
            if (amt > 0) {
                data.stats[key] += amt;
                if (key === 'vit') data.stats.current_hp = Math.min(data.stats.current_hp + amt * 10, 50 + (data.stats.vit * 10));
                if (key === 'end') data.stats.current_energy = Math.min(data.stats.current_energy + amt * 5, 20 + (data.stats.end * 5));
            }
        }

        data.stats.unspent_points -= pendingPointsUsed;

        // Reset pending state
        pendingStatAllocations = { str: 0, def: 0, vit: 0, int: 0, end: 0 };
        pendingPointsUsed = 0;

        updateSaveData(data);
        updateCharacterTabUI();
        updateProfileUI();
    };

    // --- QUEST LOG RENDERER ---
    function renderQuestLog() {
        const data = getSaveData();
        if (typeof SHRINE_CRYSTALS === 'undefined' || typeof questItems === 'undefined') return '';

        const qi = data.quest_items || [];
        const hasScroll = qi.includes('scroll');
        const shrineFormed = qi.includes('shrine_formed');
        const crystalCount = SHRINE_CRYSTALS.filter(id => qi.includes(id)).length;

        // ── PRE-SCROLL STATE ─────────────────────────────────────────────────────
        // The player hasn't found the scroll yet — don't reveal anything about crystals.
        if (!hasScroll) {
            return `
                <div style="max-width: 780px; margin: 0 auto; padding: 4px 0 30px;">

                    <!-- Vague quest header -->
                    <div style="background: var(--bg-secondary); border: 1px solid var(--border-color);
                                border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; text-align: center;">
                        <span style="font-size: 2.5rem; opacity: 0.35;">❓</span>
                        <h2 style="margin: 12px 0 6px; font-size: 1.1rem; color: var(--text-dim); letter-spacing: 1px;">
                            Something Stirs in the Realm
                        </h2>
                        <p style="margin: 0; font-size: 0.85rem; color: var(--text-dim); line-height: 1.7; font-style: italic;">
                            You sense a purpose here, but it hasn't taken shape yet.<br>
                            Explore. Look for anything that doesn't belong.
                        </p>
                    </div>

                    <!-- Scroll prompt card -->
                    <div style="background: var(--bg-secondary); border: 1px solid var(--border-color);
                                border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.6rem; opacity: 0.25;">📜</span>
                            <div style="flex: 1;">
                                <div style="font-size: 0.9rem; font-weight: bold; color: var(--text-dim);">The Ancient Scroll</div>
                                <div style="font-size: 0.78rem; color: var(--text-dim); font-style: italic; margin-top: 3px;">
                                    Not yet found. It's closer than you think.
                                </div>
                            </div>
                            <span style="font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; color: var(--text-dim);">◌ MISSING</span>
                        </div>
                    </div>

                </div>`;
        }

        // ── POST-SCROLL STATE ────────────────────────────────────────────────────
        // Scroll found — now show the full quest tracker.
        const progressPct = Math.round((crystalCount / 5) * 100);

        const crystalRows = SHRINE_CRYSTALS.map(cid => {
            let has = qi.includes(cid);
            let ci = questItems[cid];
            return `
                <div style="display:flex; align-items:center; gap:14px; padding:14px 16px;
                            background: ${has ? 'rgba(255,255,255,0.03)' : 'transparent'};
                            border-radius: 10px; border: 1px solid ${has ? ci.color + '44' : 'var(--border-color)'};
                            transition: all 0.3s; margin-bottom: 8px;">
                    <span style="font-size:1.8rem; flex-shrink:0;
                                 opacity:${has ? 1 : 0.18};
                                 filter:${has ? 'drop-shadow(0 0 8px ' + ci.color + ')' : 'none'};
                                 transition: all 0.4s;">${ci.icon}</span>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.9rem; font-weight:bold; color:${has ? ci.color : 'var(--text-dim)'}; margin-bottom:3px;">
                            ${has ? ci.name : '??? — Hidden'}
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-dim); line-height:1.45; ${has ? '' : 'font-style:italic;'}">
                            ${has ? ci.description : 'Find this fragment to reveal its nature.'}
                        </div>
                    </div>
                    <div style="flex-shrink:0; text-align:right;">
                        ${has
                    ? `<span style="font-size:0.75rem; font-weight:bold; color:#10b981; letter-spacing:1px;">✓ FOUND</span>`
                    : `<span style="font-size:0.75rem; color:var(--text-dim); letter-spacing:1px;">◌ HIDDEN</span>`}
                    </div>
                </div>`;
        }).join('');

        return `
            <div style="max-width: 780px; margin: 0 auto; padding: 4px 0 30px;">

                <!-- Quest Header (visible after scroll found) -->
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px 24px; margin-bottom: 20px;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
                        <span style="font-size:2rem;">🏛️</span>
                        <div>
                            <h2 style="margin:0; font-size:1.2rem; color:var(--text-main); letter-spacing:1px;">Five Fragments of Light</h2>
                            <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-dim);">
                                Collect all five to awaken the Shrine.
                            </p>
                        </div>
                        <div style="margin-left:auto; text-align:right;">
                            <div style="font-size:1.4rem; font-weight:bold; color:${shrineFormed ? '#fcd34d' : 'var(--accent-color)'};">
                                ${crystalCount} <span style="font-size:0.9rem; color:var(--text-dim);">/ 5</span>
                            </div>
                            <div style="font-size:0.72rem; color:var(--text-dim); letter-spacing:1px; text-transform:uppercase;">
                                ${shrineFormed ? '🏛️ Shrine Formed' : 'Fragments Found'}
                            </div>
                        </div>
                    </div>

                    <!-- Progress bar -->
                    <div style="height:8px; background:rgba(0,0,0,0.4); border-radius:4px; overflow:hidden; border:1px solid rgba(0,0,0,0.3);">
                        <div style="height:100%; width:${progressPct}%;
                                    background: linear-gradient(90deg, #38bdf8, #a855f7, #fcd34d);
                                    border-radius:4px; transition: width 0.6s ease;"></div>
                    </div>

                    <!-- Crystal pip row -->
                    <div style="display:flex; gap:10px; justify-content:center; margin-top:14px; font-size:1.5rem;">
                        ${SHRINE_CRYSTALS.map(cid => {
            let has = qi.includes(cid);
            let ci = questItems[cid];
            return `<span title="${has ? ci.name : '???'}"
                                style="opacity:${has ? 1 : 0.18};
                                       filter:${has ? 'drop-shadow(0 0 6px ' + ci.color + ')' : 'none'};
                                       transition: all 0.4s;">${ci.icon}</span>`;
        }).join('')}
                    </div>
                </div>

                <!-- Ancient Scroll card (found state) -->
                <div style="background: linear-gradient(135deg, var(--bg-secondary), rgba(252,211,77,0.04));
                            border: 1px solid rgba(252,211,77,0.35); border-radius:12px; padding:18px 20px; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        <span style="font-size:1.6rem; filter:drop-shadow(0 0 6px #fcd34d);">📜</span>
                        <div style="flex:1;">
                            <div style="font-size:0.9rem; font-weight:bold; color:#fcd34d;">The Ancient Scroll</div>
                            <div style="font-size:0.78rem; color:var(--text-dim);">Read — reveals the nature of the quest.</div>
                        </div>
                        <span style="font-size:0.75rem; font-weight:bold; letter-spacing:1px; color:#10b981;">✓ READ</span>
                    </div>
                    <ul style="list-style:none; margin:0; padding:12px 14px; background:rgba(252,211,77,0.05); border-radius:8px; border:1px solid rgba(252,211,77,0.15);">
                        ${questItems.scroll.hints.map(h => `<li style="padding:5px 0; font-size:0.8rem; color:var(--text-dim); border-bottom:1px solid rgba(255,255,255,0.04);">${h}</li>`).join('')}
                    </ul>
                </div>

                <!-- Crystal rows -->
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius:12px; padding:16px 16px 8px;">
                    <h3 style="margin:0 0 14px; font-size:0.85rem; text-transform:uppercase; letter-spacing:2px; color:var(--text-dim); padding-bottom:10px; border-bottom:1px solid var(--border-color);">
                        Fragment Collection
                    </h3>
                    ${crystalRows}
                </div>

                <!-- Shrine formed card (only shows after completion) -->
                ${shrineFormed ? `
                    <div style="margin-top:20px; padding:24px; background:linear-gradient(135deg, rgba(252,211,77,0.08), rgba(168,85,247,0.06));
                                border:1px solid rgba(252,211,77,0.35); border-radius:12px; text-align:center;">
                        <div style="font-size:3rem; filter:drop-shadow(0 0 12px rgba(252,211,77,0.8)); margin-bottom:10px;">🏛️</div>
                        <h3 style="color:#fcd34d; margin:0 0 8px; font-size:1.1rem; letter-spacing:2px; text-transform:uppercase;">The Shrine — Awakened</h3>
                        <p style="color:var(--text-dim); margin:0; font-size:0.85rem; line-height:1.6;">
                            The five fragments pulse as one. The Shrine has awakened somewhere in the realm. Find it — you will know it when you are near.
                        </p>
                    </div>` : ''}
            </div>`;
    }
    window.renderQuestLog = renderQuestLog;
    let _inventorySort = 'default';
    let _inventoryDeleteMode = false;

    window.setInventorySort = function (criteria) {
        _inventorySort = criteria;
        // Update button active states
        ['default', 'type', 'stat-desc', 'stat-asc'].forEach(id => {
            const btn = document.getElementById('sort-btn-' + id);
            if (btn) btn.classList.toggle('active', id === criteria);
        });
        updateCharacterTabUI();
    };

    window.toggleDeleteMode = function () {
        _inventoryDeleteMode = !_inventoryDeleteMode;
        const btn = document.getElementById('delete-mode-btn');
        if (btn) btn.classList.toggle('active', _inventoryDeleteMode);
        updateCharacterTabUI();
    };

    window.deleteInventoryItem = function (itemId) {
        if (!_inventoryDeleteMode) return;
        let data = getSaveData();
        const idx = data.inventory.findIndex(i => i.id === itemId);
        if (idx === -1) return;
        data.inventory.splice(idx, 1);
        updateSaveData(data);
        updateCharacterTabUI();
    };

    // --- Equipment Engine ---
    window.equipItem = function (itemId) {
        let data = getSaveData();
        let itemIndex = data.inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        let item = data.inventory[itemIndex];
        let slot = item.type;

        if (data.equipped[slot]) {
            data.inventory.push(data.equipped[slot]);
        }

        data.equipped[slot] = item;
        data.inventory.splice(itemIndex, 1);

        updateSaveData(data);
        updateCharacterTabUI();
    };

    window.unequipItem = function (slot) {
        let data = getSaveData();
        if (data.equipped && data.equipped[slot]) {
            data.inventory.push(data.equipped[slot]);
            data.equipped[slot] = null;

            updateSaveData(data);
            updateCharacterTabUI();
        }
    };

    // Keep track of our engine globally so UI buttons can talk to it later
    window.gameEngine = null;

    async function initAdventure() {
        let data = getSaveData();
        if (!data.hero_name) return;

        // Initialize fog-path exposition flag from persisted state
        window._seenOtherFog = !!(data.adventure_state && data.adventure_state.saw_other_fog);
        // Initialize sparkle-path exposition flag from persisted state
        window._seenSparklePath = !!(data.adventure_state && data.adventure_state.saw_sparkle_path);

        // Pause physics if it was running
        isMapLoaded = false;

        updateStatusLog("Connecting to the multiplayer realm...");

        // --- NEW: FETCH SAVED ENGINE DATA ---
        const engineSnap = await db.ref('heroes/' + data.hero_name.toLowerCase() + '/engineData').once('value');
        const savedEngineData = engineSnap.val();

        // --- SPAWN SEPARATION ---
        // For a brand-new player (no saved position anywhere), pick a spawn point
        // that is as far as possible from every other online player so they have to
        // actually explore before stumbling onto someone else's fog trail.
        const _localCheck = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
        const _hasLocalPos = _localCheck.adventure_state && _localCheck.adventure_state.last_x;
        const _hasCloudPos = savedEngineData && savedEngineData.x && savedEngineData.y;

        if (!_hasLocalPos && !_hasCloudPos) {
            try {
                const _playersSnap = await db.ref('realm/shared_map/players').once('value');
                const _allNow = _playersSnap.val() || {};
                const _otherPos = [];

                for (let _p in _allNow) {
                    if (_p !== data.hero_name && _allNow[_p].normPos) {
                        _otherPos.push(_allNow[_p].normPos); // {x, y} already in tile coords
                    }
                }

                if (_otherPos.length > 0) {
                    let _bestSpawn = null, _bestDist = 0;

                    for (let _attempt = 0; _attempt < 300; _attempt++) {
                        const _angle = Math.random() * Math.PI * 2;
                        const _r = 5 + Math.random() * 30; // 5–35 tiles from centre
                        const _tileX = Math.round(50 + Math.cos(_angle) * _r);
                        const _tileY = Math.round(50 + Math.sin(_angle) * _r);

                        let _minDist = Infinity;
                        for (let _op of _otherPos) {
                            const _d = Math.sqrt((_tileX - _op.x) ** 2 + (_tileY - _op.y) ** 2);
                            if (_d < _minDist) _minDist = _d;
                        }

                        if (_minDist > _bestDist) {
                            _bestDist = _minDist;
                            _bestSpawn = { x: _tileX * ENGINE.TILE_SIZE, y: _tileY * ENGINE.TILE_SIZE };
                            if (_minDist >= 20) break; // Good enough — at least 20 tiles away
                        }
                    }

                    if (_bestSpawn) {
                        if (!savedEngineData) savedEngineData = {};
                        savedEngineData.x = _bestSpawn.x;
                        savedEngineData.y = _bestSpawn.y;
                        console.log(`🗺️ Spawn separated: placed new player ${Math.round(_bestDist)} tiles from nearest ally.`);
                    }
                }
            } catch (_e) {
                console.warn('Could not fetch player positions for spawn separation:', _e);
            }
        }

        // Instantiate the new engine if it doesn't exist, passing the saved data!
        if (!window.gameEngine) {
            window.gameEngine = new AdventureEngine('game-canvas', data.hero_class || 'Black Cat', savedEngineData);
        } else {
            window.gameEngine.setHero(data.hero_class || 'Black Cat');
        }

        // --- EXPLORED-TILE ENERGY DISCOUNT ---
        // Movement through areas the player has already uncovered costs 50% less energy.
        // This works by intercepting small (movement-sized) drains on currentEnergy and
        // refunding half whenever the player's tile is already in exploredTiles.
        // Combat/flee drains (10+ energy) are intentionally left untouched.
        (function installExploredEnergyDiscount(engine) {
            if (engine._exploredDiscountInstalled) return; // Don't double-install on map reloads
            engine._exploredDiscountInstalled = true;

            const MOVEMENT_DRAIN_THRESHOLD = 3; // Drains below this are treated as movement ticks
            const EXPLORED_COST_MULTIPLIER = 0.5; // 50% discount in explored territory

            let _energy = engine.currentEnergy;

            Object.defineProperty(engine, 'currentEnergy', {
                configurable: true,
                get() { return _energy; },
                set(newVal) {
                    const drain = _energy - newVal;

                    if (drain > 0 && drain < MOVEMENT_DRAIN_THRESHOLD) {
                        // Check if the player's current tile has already been explored
                        const tileX = Math.floor(engine.player.x / ENGINE.TILE_SIZE);
                        const tileY = Math.floor(engine.player.y / ENGINE.TILE_SIZE);
                        const tileKey = `${tileX},${tileY}`;

                        if (engine.exploredTiles && engine.exploredTiles.has(tileKey)) {
                            // Explored tile: apply the discount (restore the saved half)
                            newVal = _energy - (drain * EXPLORED_COST_MULTIPLIER);
                        }
                    }

                    _energy = Math.max(0, newVal);
                }
            });
        })(window.gameEngine);

        // --- NEW: CHECK WHICH MAP TO BOOT INTO ---
        currentMapId = (data.adventure_state && data.adventure_state.last_map) ? data.adventure_state.last_map : 'overworld';

        if (currentMapId === 'overworld') {
            const realmRef = db.ref('realm/shared_map');
            const snapshot = await realmRef.once('value');
            const realmData = snapshot.val();

            if (realmData) {
                mapTerrain = realmData.mapTerrain || {};
                gridEntities = realmData.gridEntities || {};
                updateStatusLog("You have entered the shared realm!");
            } else {
                // --- YOUR ORIGINAL MAP GENERATION LOGIC ---
                gridEntities = {};
                mapTerrain = {};

                // Create 100 random winding paths
                for (let i = 0; i < 100; i++) {
                    let currentX = Math.floor(Math.random() * 101);
                    let currentY = Math.floor(Math.random() * 101);

                    for (let step = 0; step < 30; step++) {
                        if (isWithinMap(currentX, currentY)) {
                            mapTerrain[`${currentX},${currentY}`] = { type: 'dirt' };
                        }
                        let dir = Math.floor(Math.random() * 4);
                        if (dir === 0) currentY--;
                        else if (dir === 1) currentY++;
                        else if (dir === 2) currentX--;
                        else currentX++;
                    }
                }

                // Cellular Automata Smoothing Pass
                for (let pass = 0; pass < 3; pass++) {
                    let tempTerrain = JSON.parse(JSON.stringify(mapTerrain));
                    for (let x = 0; x <= 100; x++) {
                        for (let y = 0; y <= 100; y++) {
                            if (!isWithinMap(x, y)) continue;

                            let isDirt = mapTerrain[`${x},${y}`] ? true : false;
                            let dirtNeighbors = 0;

                            if (mapTerrain[`${x},${y - 1}`]) dirtNeighbors++;
                            if (mapTerrain[`${x + 1},${y}`]) dirtNeighbors++;
                            if (mapTerrain[`${x},${y + 1}`]) dirtNeighbors++;
                            if (mapTerrain[`${x - 1},${y}`]) dirtNeighbors++;

                            if (!isDirt && dirtNeighbors >= 3) {
                                tempTerrain[`${x},${y}`] = { type: 'dirt' };
                            } else if (isDirt && dirtNeighbors <= 1) {
                                delete tempTerrain[`${x},${y}`];
                            }
                        }
                    }
                    mapTerrain = tempTerrain;
                }

                // Populate Overworld Entities
                for (let c = 0; c <= 150; c++) {
                    for (let r = 0; r <= 150; r++) {
                        if (!isWithinMap(c, r)) continue;
                        let key = `${c},${r}`;

                        // Don't spawn entities in the immediate safe zone (75, 75)
                        if (c >= 71 && c <= 79 && r >= 71 && r <= 79) continue;

                        if (Math.random() < 0.015) {
                            gridEntities[key] = getRandomMonsterType('overworld');
                        }
                        else if (Math.random() < 0.007) {
                            gridEntities[key] = getRandomChestType();
                        }
                        else if (Math.random() < 0.001) {
                            gridEntities[key] = 'cave';
                        }
                    }
                }

                // --- QUEST ENTITIES: Randomized world positions ---
                // All five quest entities are placed at random each time a new realm is generated.
                // Positions are saved to Firebase so every player in the shared realm sees them
                // in the same spot — but they change whenever the realm is reset.
                //
                // Placement rules (radius bands from center 75,75 — map radius = 73):
                //   Scroll              : radius  5–14   → easy to stumble upon while exploring
                //   Crystal of Focus    : radius 62–72   → near the edge of the world
                //   Squirrel of Distraction: radius 25–50 → mid-range open land
                //   Doom Scroller       : radius 25–50   → different quadrant from squirrel
                //   Mysterious Wizard   : radius 50–70   → far and hard to find

                // Helper: pick a random valid tile within [minR, maxR] tiles from center.
                // Avoids previously used keys and existing entities.
                const pickQuestSpot = (minR, maxR, usedKeys) => {
                    for (let attempt = 0; attempt < 4000; attempt++) {
                        const angle = Math.random() * Math.PI * 2;
                        const r = minR + Math.random() * (maxR - minR);
                        const tx = Math.round(MAP_CENTER + Math.cos(angle) * r);
                        const ty = Math.round(MAP_CENTER + Math.sin(angle) * r);
                        const key = `${tx},${ty}`;
                        if (isWithinMap(tx, ty) && !gridEntities[key] && !usedKeys.has(key)) {
                            if (!mapTerrain[key]) mapTerrain[key] = { type: 'grass' };
                            usedKeys.add(key);
                            return key;
                        }
                    }
                    return null; // Should never happen on a large map
                };

                // Seed the exclusion set with the safe player-spawn zone (inner 10 tiles)
                const usedQuestKeys = new Set();
                for (let cx = 65; cx <= 85; cx++) {
                    for (let cy = 65; cy <= 85; cy++) {
                        usedQuestKeys.add(`${cx},${cy}`);
                    }
                }

                const scrollKey = pickQuestSpot(5, 14, usedQuestKeys);
                const focusKey = pickQuestSpot(62, 72, usedQuestKeys);
                const squirrelKey = pickQuestSpot(25, 50, usedQuestKeys);
                const doomKey = pickQuestSpot(25, 50, usedQuestKeys);
                const wizardKey = pickQuestSpot(50, 70, usedQuestKeys);

                if (scrollKey) gridEntities[scrollKey] = 'quest_chest_scroll';
                if (focusKey) gridEntities[focusKey] = 'quest_chest_crystal_focus';
                if (squirrelKey) gridEntities[squirrelKey] = 'boss_squirrel';
                if (doomKey) gridEntities[doomKey] = 'boss_doom_scroller';
                if (wizardKey) gridEntities[wizardKey] = 'mysterious_wizard';

                await realmRef.set({
                    mapTerrain: mapTerrain,
                    gridEntities: gridEntities
                });
                updateStatusLog("You have forged a new realm!");
            }
            cacheMapDecorations(); // Generate the trees!
        } else {
            // Booting directly into a cave
            updateStatusLog("You awaken in the dark depths...");
            const caveRef = db.ref(`realm/shared_map/caves/${currentMapId}`);
            let snap = await caveRef.once('value');

            if (!snap.exists()) {
                let newCave = generateCave(newMapId);
                await caveRef.set(newCave);
                mapTerrain = newCave.mapTerrain;
                gridEntities = newCave.gridEntities;

                // --- NEW: WIPE GHOST FOG ---
                // Clear any leftover fog memory for this coordinate from previous realms
                if (data.fog_master && data.fog_master[newMapId]) {
                    delete data.fog_master[newMapId];
                    localStorage.setItem('motivation_RPG', JSON.stringify(data));
                }
            } else {
                let caveData = snap.val();
                mapTerrain = caveData.mapTerrain || {};
                gridEntities = caveData.gridEntities || {};
            }
        }

        // Expose the dictionaries to the global window so the engine can read them
        window.mapTerrain = mapTerrain;
        window.gridEntities = gridEntities;

        // --- PERSONAL SPARKLE PATH & PERSONAL SCROLL ---
        // Each player gets their own private scroll placed near the map centre.
        // The scroll position lives on the main save (data.personal_scroll) and
        // is never written to Firebase, so no other player can see it. The
        // sparkle trail points from (75,75) to that private scroll. Once the
        // player picks it up the trail and scroll are cleared.
        (function () {
            if (currentMapId !== 'overworld') return;

            const _localSave = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');

            // Player already read their scroll — nothing to show.
            if (_localSave.quest_items && _localSave.quest_items.includes('scroll')) {
                window.personalScrollKey = null;
                window.sparklePathTiles = null;
                return;
            }

            // Load an existing personal scroll tile, or generate one for a brand-new player.
            let personalScrollKey = _localSave.personal_scroll || null;

            if (!personalScrollKey) {
                // Build an exclusion set: tiles already occupied + the immediate safe zone.
                const _used = new Set(Object.keys(gridEntities));
                for (let _cx = 65; _cx <= 85; _cx++) {
                    for (let _cy = 65; _cy <= 85; _cy++) {
                        _used.add(`${_cx},${_cy}`);
                    }
                }
                // Randomise a spot 5–14 tiles from centre (same band as the shared scroll).
                for (let _att = 0; _att < 4000; _att++) {
                    const _ang = Math.random() * Math.PI * 2;
                    const _r = 5 + Math.random() * 9;
                    const _tx = Math.round(75 + Math.cos(_ang) * _r);
                    const _ty = Math.round(75 + Math.sin(_ang) * _r);
                    const _k = `${_tx},${_ty}`;
                    if (_tx >= 0 && _tx < ENGINE.MAP_WIDTH &&
                        _ty >= 0 && _ty < ENGINE.MAP_HEIGHT &&
                        !_used.has(_k)) {
                        personalScrollKey = _k;
                        _localSave.personal_scroll = _k;
                        localStorage.setItem('motivation_RPG', JSON.stringify(_localSave));
                        break;
                    }
                }
            }

            if (!personalScrollKey) return; // Should never happen on a 151×151 map

            window.personalScrollKey = personalScrollKey;

            // Bresenham's line from map centre (75,75) → personal scroll tile.
            const _pp = personalScrollKey.split(',');
            const _sx = parseInt(_pp[0]);
            const _sy = parseInt(_pp[1]);
            const _path = new Set();
            let _x0 = 75, _y0 = 75;
            let _dx = Math.abs(_sx - _x0), _dy = Math.abs(_sy - _y0);
            let _sX = _x0 < _sx ? 1 : -1, _sY = _y0 < _sy ? 1 : -1;
            let _err = _dx - _dy;
            let _px = _x0, _py = _y0;
            for (let _g = 0; _g < 300; _g++) {
                _path.add(`${_px},${_py}`);
                if (_px === _sx && _py === _sy) break;
                let _e2 = 2 * _err;
                if (_e2 > -_dy) { _err -= _dy; _px += _sX; }
                if (_e2 < _dx) { _err += _dx; _py += _sY; }
            }
            window.sparklePathTiles = _path;
        })();

        // --- THE BRIDGE ---
        // Feed the loaded/generated map into our high-speed engine
        window.gameEngine.loadMapData(mapTerrain, currentMapId);

        // Sync the engine's zoom to match the slider's initial value (default 100)
        // so the visual zoom level matches what the zoom bar shows on load.
        applyZoom(parseInt(zoomSlider.value, 10));

        let masterFog = data.fog_master || {};
        let bootFog = masterFog[currentMapId] || [];
        if (bootFog.length > 0) {
            window.gameEngine.resetFog(bootFog);
        }

        // --- NEW: INITIALIZE MULTIPLAYER ON BOOT ---
        setupMultiplayerListeners(data.hero_name);
        window.syncPlayerPosition();

        isMapLoaded = true;
        updateAdventureHUD();

        // Restore mid-encounter state if necessary
        if (data.adventure_state && data.adventure_state.active_encounter) {
            let enc = data.adventure_state.active_encounter;
            if (enc.phase === 'battle') {
                activeBattle = enc.battleState;
                inEncounter = true;
                const panel = document.getElementById('encounter-panel');
                if (panel) panel.classList.add('active');
                renderBattleUI("You find yourself back in the heat of battle!");
            }
        }
    }

    // --- ZOOM CONTROLS ---
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const gameCanvas = document.getElementById('game-canvas');

    if (zoomSlider) {
        zoomSlider.addEventListener('input', function (e) {
            applyZoom(parseInt(e.target.value));
        });
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', function () {
            let currentZoom = parseInt(zoomSlider.value, 10);
            applyZoom(currentZoom + 5);
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', function () {
            let currentZoom = parseInt(zoomSlider.value, 10);
            applyZoom(currentZoom - 5);
        });
    }

    // --- MOUSE WHEEL ZOOM ---
    if (gameCanvas) {
        gameCanvas.addEventListener('wheel', function (e) {
            // Stop the page itself from scrolling up and down
            e.preventDefault();

            let currentZoom = parseInt(zoomSlider.value, 10);

            if (e.deltaY > 0) {
                // Scrolling down = Zoom Out
                applyZoom(currentZoom - 5);
            } else {
                // Scrolling up = Zoom In
                applyZoom(currentZoom + 5);
            }
        }, { passive: false }); // Required to allow e.preventDefault() on scroll events
    }

    // --- NEW: VISUAL TILE HELPER ---
    function getVisualTileType(nx, ny) {
        if (currentMapId === 'overworld') {
            // 1. FAST-PASS: Calculate distance squared once
            const dx = nx - MAP_CENTER;
            const dy = ny - MAP_CENTER;
            const distSq = dx * dx + dy * dy;
            const radiusSq = MAP_RADIUS * MAP_RADIUS;

            // Completely outside the map
            if (distSq > radiusSq) return 'grass';

            let type = mapTerrain[`${nx},${ny}`] ? mapTerrain[`${nx},${ny}`].type : 'grass';

            // 2. INNER CORE FAST-PASS
            // If the tile is safely inside the circle (e.g. radius 48 out of 50),
            // it is mathematically impossible for it to be an edge. 
            // 48 * 48 = 2304. We skip the 8 expensive neighbor checks entirely!
            if (distSq < 2304) {
                return type;
            }

            // 3. OUTER RING ONLY
            // We only do this heavy calculation if we are physically right on the boundary ring
            let isEdge = !isWithinMap(nx - 1, ny - 1) || !isWithinMap(nx, ny - 1) || !isWithinMap(nx + 1, ny - 1) ||
                !isWithinMap(nx - 1, ny) || !isWithinMap(nx + 1, ny) ||
                !isWithinMap(nx - 1, ny + 1) || !isWithinMap(nx, ny + 1) || !isWithinMap(nx + 1, ny + 1);

            if (isEdge) return 'grass';
            return type;

        } else {
            // CAVE LOGIC
            if (!isWithinMap(nx, ny)) return 'void';
            return mapTerrain[`${nx},${ny}`] ? mapTerrain[`${nx},${ny}`].type : 'void';
        }
    }

    // Calculates the 4-bit mask for a given grid coordinate using the visual helper
    function calculateBitmask(x, y, matchType) {
        let mask = 0;
        if (getVisualTileType(x, y - 1) === matchType) mask += 1; // North
        if (getVisualTileType(x + 1, y) === matchType) mask += 2; // East
        if (getVisualTileType(x, y + 1) === matchType) mask += 4; // South
        if (getVisualTileType(x - 1, y) === matchType) mask += 8; // West
        return mask;
    }

    // --- DECORATION CACHING ---
    function cacheMapDecorations() {
        // We only need to run this for the overworld, as generateCave() 
        // already hardcodes decorations during cave creation.
        if (currentMapId !== 'overworld') return;

        // Loop through the entire 150x150 bounds of the overworld
        for (let c = 0; c <= 150; c++) {
            for (let r = 0; r <= 150; r++) {

                // Skip corners outside the circular map radius
                if (!isWithinMap(c, r)) continue;

                let key = `${c},${r}`;
                let tileData = mapTerrain[key];

                // Only assign a decoration if the tile doesn't already have one
                if (!tileData || !tileData.decor) {
                    let decor = getRawDecor(c, r);

                    if (decor) {
                        if (!tileData) {
                            // If it's an implied grass tile, create it in the dictionary to hold the tree
                            mapTerrain[key] = { type: 'grass', decor: decor };
                        } else {
                            // If it's an existing dirt tile, just append the decoration
                            mapTerrain[key].decor = decor;
                        }
                    }
                }
            }
        }
    }

    // --- RAW DECORATION EVALUATOR ---
    // Evaluates what decoration a tile naturally wants to spawn based on terrain and weight (ignores adjacency)
    function getRawDecor(c, r) {
        if (!isWithinMap(c, r) || gridEntities[`${c},${r}`]) return null;

        // 1. Global Density Roll (25% of all valid tiles get a decoration)
        let seed1 = c * 53.123 + r * 89.456;
        if (Math.floor(Math.abs((Math.sin(seed1) * 21098.7) % 1) * 100) >= 25) return null;

        // Determine the current zone type based on currentMapId
        let currentZone = currentMapId === 'overworld' ? 'overworld' : 'cave';

        // 2. Filter valid decorations for this specific tile's terrain AND allowed zone
        let tileType = getVisualTileType(c, r);
        let allowedKeys = Object.keys(gameDecorations).filter(key => {
            let decor = gameDecorations[key];
            let matchesTerrain = decor.terrain.includes(tileType);

            // SAFEGUARD: default to true if allowedZones is missing so old decorations still spawn
            let matchesZone = !decor.allowedZones || decor.allowedZones.includes(currentZone);

            return matchesTerrain && matchesZone;
        });

        if (allowedKeys.length === 0) return null;

        // 3. Calculate total weight of allowed decorations
        let totalWeight = allowedKeys.reduce((sum, key) => sum + gameDecorations[key].weight, 0);

        // 4. Weighted Random Roll
        let seed2 = c * 12.345 + r * 67.89;
        let roll = Math.floor(Math.abs((Math.sin(seed2) * 34567.8) % 1) * totalWeight);

        let cumulative = 0;
        for (let key of allowedKeys) {
            cumulative += gameDecorations[key].weight;
            if (roll < cumulative) return key; // Return the winning decoration ID
        }
        return null;
    }


    window.startEncounter = function (x, y, type, oldPixelX, oldPixelY) {
        inEncounter = true;
        let data = getSaveData();
        if (!data.adventure_state) data.adventure_state = {};
        data.adventure_state.active_encounter = { phase: 'prompt', x: x, y: y, type: type, oldX: oldPixelX, oldY: oldPixelY };
        updateSaveData(data);
        const panel = document.getElementById('encounter-panel');
        if (!panel) return;

        let title = "", desc = "", emoji = "", btn1 = "", btn2 = "";

        if (type.startsWith('chest_')) {
            let config = chestTypes[type];
            title = config.name;

            // Calculate the exact percentage position for a 12x8 grid
            let bgPosX = (config.col / 11) * 100;
            let bgPosY = (config.row / 7) * 100;

            emoji = `<div style="
                width: 80px; height: 80px; margin: 0 auto 20px auto;
                background-image: url(${gameAssets.chestSprite});
                background-size: 1200% 800%;
                background-position: ${bgPosX}% ${bgPosY}%;
                filter: drop-shadow(0 0 20px ${config.glow});
            "></div>`;

            desc = `You stumble upon a locked ${config.name.toLowerCase()}.`;
            btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'open_${type}', ${oldPixelX}, ${oldPixelY})">Pry it Open</button>`;
            btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Leave it alone</button>`;
        } else if (gameMonsters[type]) { // Changed
            let mConfig = gameMonsters[type]; // Changed

            // --- BOSS HOOK: bosses go through the co-op boss-fight system ---
            if (mConfig.isBoss && typeof window.startBossEncounter === 'function') {
                window.startBossEncounter(x, y, type, oldPixelX, oldPixelY);
                return;
            }

            title = mConfig.name;

            emoji = `
                <style>
                    @keyframes monster-slam {
                        0%   { transform: scale(0.3) translateY(-60px); opacity: 0; filter: brightness(3) blur(4px); }
                        25%  { transform: scale(1.6) translateY(20px);  opacity: 1; filter: brightness(1.8); }
                        55%  { transform: scale(0.9) translateY(-8px);  filter: brightness(1.2); }
                        75%  { transform: scale(1.15) translateY(4px);  }
                        100% { transform: scale(1)   translateY(0); }
                    }
                    @keyframes panel-flash-red {
                        0%   { box-shadow: inset 0 0 0px  rgba(239,68,68,0);    }
                        20%  { box-shadow: inset 0 0 80px rgba(239,68,68,0.55); }
                        100% { box-shadow: inset 0 0 0px  rgba(239,68,68,0);    }
                    }
                    @keyframes panel-shake {
                        0%,100% { transform: translateX(0); }
                        15%     { transform: translateX(-7px); }
                        30%     { transform: translateX(7px); }
                        45%     { transform: translateX(-5px); }
                        60%     { transform: translateX(5px); }
                        75%     { transform: translateX(-2px); }
                    }
                    .monster-encounter-card {
                        animation: panel-flash-red 0.7s ease-out forwards, panel-shake 0.5s 0.1s ease-out forwards !important;
                    }
                </style>
                <img src="${mConfig.overworldUrl}" style="width:80px; height:80px; filter:drop-shadow(0 0 15px ${mConfig.glow}); animation:monster-slam 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards;" />`; // Changed

            // Replaced the generic string check with the boolean property
            if (mConfig.isBoss) {
                desc = `The fearsome ${mConfig.name} towers before you. Its gaze alone shatters your focus. Are you ready?`;
            } else {
                desc = `A wild ${mConfig.name} lunges out of the fog! You have been spotted.`;
            }

            btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'fight', ${oldPixelX}, ${oldPixelY})">Engage in Battle</button>`;
            btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid #ef4444; color:#ef4444;" onclick="resolveEncounter(${x}, ${y}, 'flee', ${oldPixelX}, ${oldPixelY})">⚡ Flee (costs 10 energy, may take damage)</button>`;
        } else if (type === 'cave') {
            title = "Mysterious Cave";
            emoji = `<img src=${gameAssets.caveEntrance} style="width: 80px; height: 80px; filter: drop-shadow(0 0 15px rgba(0,0,0,0.6));" />`;
            desc = "A dark, gaping hole in the earth. A cold wind howls from deep within, smelling of ancient stone. Do you wish to enter?";
            btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'enter_cave', ${oldPixelX}, ${oldPixelY})">Enter the Darkness</button>`;
            btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Walk Away</button>`;
        } else if (type === 'exit') {
            title = "Cave Exit";
            emoji = `<img src=${gameAssets.caveEntrance} style="width: 80px; height: 80px; filter: drop-shadow(0 0 15px rgba(0,0,0,0.6));" />`;
            desc = "A shaft of light shines down from the surface. Do you wish to return to the overworld?";
            btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'leave_cave', ${oldPixelX}, ${oldPixelY})">Climb Out</button>`;
            btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Stay in the Dark</button>`;

        } else if (type.startsWith('quest_chest_')) {
            let itemId = type.replace('quest_chest_', '');
            let qItem = typeof questItems !== 'undefined' ? questItems[itemId] : null;
            let localData = getSaveData();
            let alreadyHave = localData.quest_items && localData.quest_items.includes(itemId);

            if (qItem && !alreadyHave) {
                // Special styling for the scroll vs crystals
                let isScroll = itemId === 'scroll';
                title = qItem.name;
                emoji = `
                    <div style="font-size: 4.5rem; margin-bottom: 10px; filter: drop-shadow(0 0 12px ${qItem.color}); animation: chest-pop 0.5s ease-out;">
                        ${qItem.icon}
                    </div>`;
                desc = `<em style="color: ${qItem.color};">"${qItem.description}"</em>`;
                btn1 = `<button class="submit-btn" style="background: ${qItem.color}; border-color: ${qItem.color}; color: #000;" onclick="resolveEncounter(${x}, ${y}, 'collect_quest_item_${itemId}', ${oldPixelX}, ${oldPixelY})">
                    ${isScroll ? 'Read the Scroll' : 'Take the Crystal'}
                </button>`;
                btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Leave it</button>`;
            } else if (alreadyHave) {
                title = qItem ? qItem.name : "Quest Chest";
                emoji = `<div style="font-size: 4rem; opacity: 0.4;">${qItem ? qItem.icon : '📦'}</div>`;
                desc = `You have already claimed what lay within. Its power now flows through you.`;
                btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Continue</button>`;
                btn2 = '';
            } else {
                title = "Ancient Chest";
                emoji = `<div style="font-size: 4rem;">📦</div>`;
                desc = "A peculiar chest. Something powerful rests within.";
                btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Walk Away</button>`;
                btn2 = '';
            }

        } else if (type === 'mysterious_wizard') {
            let localData = getSaveData();
            let alreadyGifted = localData.quest_items && localData.quest_items.includes('crystal_wisdom');

            title = "Mysterious Wizard of Motivation";
            const wizardSpriteUrl = (typeof gameAssets !== 'undefined' && gameAssets.wizardSprite && gameAssets.wizardSprite !== 'YOUR_WIZARD_SPRITE_URL_HERE')
                ? gameAssets.wizardSprite : null;
            emoji = wizardSpriteUrl
                ? `<div style="width:120px; height:120px; margin: 0 auto 10px; animation: chest-pop 0.5s ease-out; filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.9));"><img src="${wizardSpriteUrl}" style="width:100%; height:100%; object-fit:contain; image-rendering:pixelated;" crossorigin="anonymous" onerror="this.parentElement.innerHTML='<span style=\\'font-size:4.5rem;\\'>🧙</span>'"></div>`
                : `<div style="font-size: 4.5rem; margin-bottom: 10px; filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.9)); animation: chest-pop 0.5s ease-out;">🧙</div>`;

            if (alreadyGifted) {
                desc = `The old wizard smiles warmly. <em style="color: var(--text-dim);">"You already carry my gift, traveler. Use it wisely. The shrine awaits."</em>`;
                btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Thank the Wizard</button>`;
                btn2 = '';
            } else {
                desc = `A robed figure turns to face you, eyes gleaming with ancient light. <em style="color: #a855f7;">"Ah — a seeker. I have watched your journey. Discipline. Perseverance. You've earned this."</em>`;
                btn1 = `<button class="submit-btn" style="background: #a855f7; border-color: #a855f7; color: #fff;" onclick="resolveEncounter(${x}, ${y}, 'receive_wizard_gift', ${oldPixelX}, ${oldPixelY})">Accept the Crystal of Wisdom</button>`;
                btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Not yet...</button>`;
            }

        } else if (type === 'shrine') {
            let localData = getSaveData();
            let crystalCount = (localData.quest_items || []).filter(id => typeof SHRINE_CRYSTALS !== 'undefined' && SHRINE_CRYSTALS.includes(id)).length;
            let hasAllCrystals = crystalCount >= 5;

            title = "The Shrine of Discipline";
            emoji = `<div style="font-size: 4.5rem; filter: drop-shadow(0 0 20px rgba(252, 211, 77, 0.9)); animation: chest-pop 0.5s ease-out;">🏛️</div>`;

            if (hasAllCrystals) {
                desc = `The five crystals hum in resonance. The shrine's stone surface is warm to the touch — it radiates something that feels almost like recognition.<br><br>
                    <em style="color: #fcd34d;">Between its pillars, the air shimmers. A threshold. A gate to somewhere the fog has never reached.</em><br><br>
                    <span style="color: var(--text-dim); font-size: 0.9rem;">Crystals gathered: ${crystalCount} / 5 ✓</span>`;
                btn1 = `<button class="submit-btn" style="background: #fcd34d; border-color: #fcd34d; color: #000;" onclick="resolveEncounter(${x}, ${y}, 'enter_shrine_portal', ${oldPixelX}, ${oldPixelY})">Step Through the Light</button>`;
                btn2 = `<button class="submit-btn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Not yet</button>`;
            } else {
                desc = `The shrine stands silent, waiting. Its stone is cool — dormant. Five hollow alcoves ring its base, shaped to hold something that isn't here yet.<br><br>
                    <em style="color: var(--text-dim);">It is not ready. Neither are you.</em><br><br>
                    <span style="color: var(--text-dim); font-size: 0.9rem;">Crystals gathered: ${crystalCount} / 5</span>`;
                btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Turn Away</button>`;
                btn2 = '';
            }
        } else if (type === 'personal_scroll') {
            // Private scroll — same quest item as the shared scroll, but this copy is
            // only visible to this player and is never stored in Firebase.
            let qItem = typeof questItems !== 'undefined' ? questItems['scroll'] : null;
            title = qItem ? qItem.name : "The Ancient Scroll";
            emoji = `
                <style>
                    @keyframes scroll-appear {
                        0%   { transform: scale(0.4) translateY(20px); opacity: 0; filter: brightness(3) blur(4px); }
                        60%  { transform: scale(1.15) translateY(-6px); opacity: 1; filter: brightness(1.4); }
                        100% { transform: scale(1) translateY(0); filter: brightness(1); }
                    }
                </style>
                <div style="font-size: 4.5rem; margin-bottom: 10px;
                            filter: drop-shadow(0 0 14px #fcd34d);
                            animation: scroll-appear 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;">📜</div>`;
            desc = qItem
                ? `<em style="color: #fcd34d;">"${qItem.description}"</em>`
                : `<em style="color: #fcd34d;">Something ancient and important rests here, waiting to be read.</em>`;
            btn1 = `<button class="submit-btn" style="background: #fcd34d; border-color: #fcd34d; color: #000;"
                        onclick="resolveEncounter(${x}, ${y}, 'collect_personal_scroll', ${oldPixelX}, ${oldPixelY})">
                        Read the Scroll
                    </button>`;
            btn2 = `<button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                        onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">
                        Leave it
                    </button>`;

        } else if (type.startsWith('player:')) {
            const playerName = type.split(':')[1];
            const pClass = otherPlayers[playerName]?.class || 'Adventurer';
            const localData = getSaveData();
            const alreadyFriends = localData.friends_list && localData.friends_list.includes(playerName);
            const sawFog = localData.adventure_state && localData.adventure_state.saw_other_fog;

            title = alreadyFriends ? "A Familiar Ally" : "A Destined Meeting";
            emoji = `<div style="font-size: 3.5rem; margin-bottom: 8px; filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.6));">${getHeroEmoji(pClass)}</div>`;

            if (alreadyFriends) {
                desc = `<strong>${playerName}</strong> meets your gaze. You nod. Two travelers who chose the same difficult path.<br><br><em style="color: var(--text-dim);">"Still here,"</em> they say. You understand exactly what that means.`;
                btn1 = `<button class="submit-btn" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Walk Together</button>`;
                btn2 = '';
            } else {
                desc = `You come face to face with <strong style="color: #10b981;">${playerName}</strong>, a ${pClass}.<br><br>
                    <em style="color: var(--text-dim);">They look as surprised as you are. But their footprints — you recognize them. The lit path in the fog. That was <strong>theirs</strong>.</em><br><br>
                    You are not meeting by accident. Something brought you both here, to this exact point, at this exact moment. The realm clearly intends for you to walk this path together.`;
                btn1 = `<button class="submit-btn" style="background: #10b981; border-color: #10b981; color: #000;" onclick="resolveEncounter(${x}, ${y}, 'ask_friend_${playerName}', ${oldPixelX}, ${oldPixelY})">Request help on this journey</button>`;
                btn2 = `<button class="submit-btn" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-dim);" onclick="resolveEncounter(${x}, ${y}, 'leave', ${oldPixelX}, ${oldPixelY})">Not yet... (walk away)</button>`;
            }
        }

        panel.innerHTML = `
            <div class="encounter-card ${gameMonsters[type] && !gameMonsters[type]?.isBoss ? 'monster-encounter-card' : ''}">
                <div class="encounter-emoji">${emoji}</div>
                <h2>${title}</h2>
                <p style="color: var(--text-dim); margin-top: 10px; max-width: 500px;">${desc}</p>
                <div class="encounter-btn-group">
                    ${btn1}
                    ${btn2}
                </div>
            </div>
        `;

        panel.classList.add('active');
        updateAdventureHUD();
    }

    window.toggleFriendTab = function (friendName, activeTab) {
        const tabs = ['prof', 'rec', 'chart', 'cal'];

        tabs.forEach(tab => {
            const btn = document.getElementById(`fbtn-${tab}-${friendName}`);
            const view = document.getElementById(`fview-${tab}-${friendName}`);
            const isActive = tab === activeTab;
            if (btn) btn.classList.toggle('active', isActive);
            if (view) view.classList.toggle('active', isActive);
        });

        if (activeTab === 'chart') {
            window.renderFriendCharts(friendName);
        }
    };

    window.removeFriend = function (friendName) {
        if (confirm(`Are you sure you want to part ways with ${friendName}?`)) {
            let data = getSaveData();
            data.friends_list = data.friends_list.filter(name => name !== friendName);

            updateSaveData(data);
            renderFriendsList();
        }
    };

    // --- PAGINATION & LOG RENDERING HELPERS ---
    window.myActivityWeekOffset = 0;
    window.friendLogOffsets = {};
    window.cachedFriendChronicles = {};

    window.changeMyLogWeek = function (direction) {
        window.myActivityWeekOffset += direction;
        if (window.myActivityWeekOffset > 0) window.myActivityWeekOffset = 0;
        renderActivityLog();
    };

    window.changeFriendLogWeek = function (friendName, direction) {
        if (!window.friendLogOffsets[friendName]) window.friendLogOffsets[friendName] = 0;
        window.friendLogOffsets[friendName] += direction;

        const container = document.getElementById(`friend-recent-${friendName}`);
        if (container) {
            container.innerHTML = window.generateFriendRecentActivity(friendName);
        }
    };

    window.generateFriendRecentActivity = function (friendName) {
        const chronicles = window.cachedFriendChronicles[friendName] || [];
        const totalLogs = chronicles.length;
        if (totalLogs === 0) return '<div class="no-data-msg">No journey records yet.</div>';

        let offset = window.friendLogOffsets[friendName] || 0;
        if (offset < 0) offset = 0;
        if (offset >= totalLogs) offset = Math.max(0, totalLogs - 1);
        window.friendLogOffsets[friendName] = offset;

        const pageLogs = chronicles.slice(offset, offset + 7);
        const canGoBack = offset + 7 < totalLogs;
        const canGoForward = offset > 0;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <button class="submit-btn" style="margin: 0; width: auto; padding: 5px 15px; visibility: ${canGoBack ? 'visible' : 'hidden'};" onclick="changeFriendLogWeek('${friendName}', 7)">⬅️ Older Weeks</button>
                <span style="color: var(--text-dim); font-size: 0.9rem;">Showing ${offset + 1}-${Math.min(offset + 7, totalLogs)} of ${totalLogs}</span>
                <button class="submit-btn" style="margin: 0; width: auto; padding: 5px 15px; visibility: ${canGoForward ? 'visible' : 'hidden'};" onclick="changeFriendLogWeek('${friendName}', -7)">Recent Weeks ➡️</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
        `;

        html += pageLogs.map(entry => window.renderLogEntryHTML(entry)).join('');
        html += `</div>`;
        return html;
    };

    window.generateFriendRecordsHTML = function (friendName, chronicles) {
        window.cachedFriendChronicles[friendName] = chronicles || [];

        if (!chronicles || chronicles.length === 0) return '<div class="no-data-msg">No journey records yet.</div>';

        const logs = [...chronicles].reverse();

        // Build full records object for all known activity keys
        const activityMeta = [
            { key: 'exercise', label: 'Exercise', unit: 'min' },
            { key: 'chores', label: 'Chores', unit: 'min' },
            { key: 'reading', label: 'Reading', unit: 'min' },
            { key: 'work', label: 'Work', unit: 'min' },
            { key: 'socializing', label: 'Socializing', unit: 'min' },
            { key: 'journaling', label: 'Journaling', unit: 'min' },
            { key: 'water', label: 'Water', unit: 'glasses' },
            { key: 'todo', label: 'To-Do Items', unit: '' },
        ];

        let records = { dailyXp: { val: 0, date: 'N/A' }, weeklyXp: { val: 0, date: 'N/A' } };
        activityMeta.forEach(a => { records[a.key] = { val: 0, date: 'N/A' }; });

        logs.forEach((entry, i) => {
            const s = entry.stats || {};
            let dayXp = calculateXpFromStats(s, entry.date);
            if (dayXp > records.dailyXp.val) records.dailyXp = { val: dayXp, date: entry.date };

            let weeklySum = 0;
            for (let j = i; j < Math.min(i + 7, logs.length); j++) weeklySum += calculateXpFromStats(logs[j].stats || {}, logs[j].date);
            if (weeklySum > records.weeklyXp.val) records.weeklyXp = { val: weeklySum, date: entry.date };

            activityMeta.forEach(a => {
                const val = s[a.key] || 0;
                if (val > records[a.key].val) records[a.key] = { val, date: entry.date };
            });
        });

        // Compact record cards — only show categories that have at least one logged entry
        const activityCards = activityMeta
            .filter(a => records[a.key].val > 0)
            .map(a => {
                const suffix = a.unit ? ` ${a.unit}` : '';
                return `<div class="record-card" style="padding:10px 12px;">
                    <div class="record-title" style="font-size:0.7rem;">${a.label}</div>
                    <div class="record-value" style="font-size:1.1rem;">${records[a.key].val}${suffix}</div>
                    <div class="record-date" style="font-size:0.65rem;">${records[a.key].date}</div>
                </div>`;
            }).join('');

        return `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px,1fr)); gap:10px; margin-bottom:20px;">
                <div class="record-card" style="padding:10px 12px;">
                    <div class="record-title" style="font-size:0.7rem;">Best Day (XP)</div>
                    <div class="record-value" style="font-size:1.1rem;">${records.dailyXp.val}</div>
                    <div class="record-date" style="font-size:0.65rem;">${records.dailyXp.date}</div>
                </div>
                <div class="record-card" style="padding:10px 12px;">
                    <div class="record-title" style="font-size:0.7rem;">Best Week (XP)</div>
                    <div class="record-value" style="font-size:1.1rem;">${records.weeklyXp.val}</div>
                    <div class="record-date" style="font-size:0.65rem;">${records.weeklyXp.date}</div>
                </div>
                ${activityCards}
            </div>
            <h3 style="margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:8px; color:var(--accent-color); font-size:0.95rem;">Activity Log</h3>
            <div id="friend-recent-${friendName}">
                ${window.generateFriendRecentActivity(friendName)}
            </div>`;
    };

    window.generateFriendChartsHTML = function (friendName) {
        const fn = friendName;
        return `
            <div class="friend-chart-grid">
                <div class="chart-card full-width">
                    <h3 class="chart-title">Total XP Over Time</h3>
                    <div class="chart-wrapper"><canvas id="fcanvas-total-${fn}"></canvas></div>
                </div>
                <div class="chart-card full-width">
                    <h3 class="chart-title">Daily XP Gains</h3>
                    <div class="chart-wrapper"><canvas id="fcanvas-daily-${fn}"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title">Activity Distribution (Time)</h3>
                    <div class="chart-wrapper"><canvas id="fcanvas-pie-${fn}"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title">XP Sources</h3>
                    <div class="chart-wrapper"><canvas id="fcanvas-source-${fn}"></canvas></div>
                </div>
            </div>`;
    };

    window.renderFriendCharts = function (friendName) {
        const chronicles = window.cachedFriendChronicles[friendName];
        if (!chronicles || chronicles.length === 0) return;

        const fn = friendName;
        const chronoAsc = [...chronicles].reverse(); // oldest → newest

        // Destroy any pre-existing chart instances for this friend
        ['total', 'daily', 'pie', 'source'].forEach(suffix => {
            const key = `fchartInst_${fn}_${suffix}`;
            if (window[key]) { window[key].destroy(); window[key] = null; }
        });

        const pieColors = ['#ef4444', '#eab308', '#3b82f6', '#f97316', '#10b981', '#a855f7', '#06b6d4'];

        // --- 1. Total XP Line ---
        const ctxTotal = document.getElementById(`fcanvas-total-${fn}`);
        if (ctxTotal) {
            let totalXP = 0;
            const totalLabels = ['0'];
            const totalData = [0];
            chronoAsc.forEach(entry => {
                totalXP += calculateXpFromStats(entry.stats || {}, entry.date);
                totalLabels.push(entry.date.split('/').slice(0, 2).join('/'));
                totalData.push(totalXP);
            });
            window[`fchartInst_${fn}_total`] = new Chart(ctxTotal, {
                type: 'line',
                data: {
                    labels: totalLabels,
                    datasets: [{
                        label: 'Total XP', data: totalData,
                        borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)',
                        borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#0f172a'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { color: '#94a3b8' } } }
                }
            });
        }

        // --- 2. Daily XP Bar ---
        const ctxDaily = document.getElementById(`fcanvas-daily-${fn}`);
        if (ctxDaily) {
            const dailyLabels = chronoAsc.map(e => e.date.split('/').slice(0, 2).join('/'));
            const dailyData = chronoAsc.map(e => calculateXpFromStats(e.stats || {}, e.date));
            window[`fchartInst_${fn}_daily`] = new Chart(ctxDaily, {
                type: 'line',
                data: {
                    labels: dailyLabels,
                    datasets: [{
                        label: 'Daily XP', data: dailyData,
                        borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)',
                        borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#0f172a'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { color: '#94a3b8' } } }
                }
            });
        }

        // --- 3. Activity Time Pie ---
        const ctxPie = document.getElementById(`fcanvas-pie-${fn}`);
        if (ctxPie) {
            const timeKeys = ['exercise', 'chores', 'reading', 'work', 'socializing', 'journaling'];
            const timeLabels = ['Exercise', 'Chores', 'Reading', 'Work', 'Socializing', 'Journaling'];
            const timeData = timeKeys.map(k => chronoAsc.reduce((sum, e) => sum + (e.stats?.[k] || 0), 0));
            window[`fchartInst_${fn}_pie`] = new Chart(ctxPie, {
                type: 'doughnut',
                data: {
                    labels: timeLabels,
                    datasets: [{ data: timeData, backgroundColor: pieColors, borderWidth: 2, borderColor: '#1e293b' }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } }
                }
            });
        }

        // --- 4. XP Sources Pie ---
        const ctxSource = document.getElementById(`fcanvas-source-${fn}`);
        if (ctxSource) {
            const sourceKeys = ['exercise', 'chores', 'reading', 'work', 'socializing', 'journaling', 'water', 'todo'];
            const sourceLabels = ['Exercise', 'Chores', 'Reading', 'Work', 'Socializing', 'Journaling', 'Water', 'To-Dos'];
            const sourceRates = [3, 2, 2, 1, 0.5, 2, 5, 10];
            const sourceData = sourceKeys.map((k, i) =>
                Math.floor(chronoAsc.reduce((sum, e) => sum + (e.stats?.[k] || 0), 0) * sourceRates[i])
            );
            window[`fchartInst_${fn}_source`] = new Chart(ctxSource, {
                type: 'doughnut',
                data: {
                    labels: sourceLabels,
                    datasets: [{ data: sourceData, backgroundColor: pieColors, borderWidth: 2, borderColor: '#1e293b' }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } } }
                }
            });
        }
    };

    window.friendCalendarYears = {};   // tracks current display year per friend

    window.changeFriendCalendarYear = function (friendName, direction) {
        if (!window.friendCalendarYears[friendName]) {
            window.friendCalendarYears[friendName] = new Date().getFullYear();
        }
        window.friendCalendarYears[friendName] += direction;
        const container = document.getElementById(`fcal-body-${friendName}`);
        const yearLabel = document.getElementById(`fcal-year-${friendName}`);
        const prevBtn = document.getElementById(`fcal-prev-${friendName}`);
        if (container) container.innerHTML = window.renderFriendCalendarMonths(friendName);
        if (yearLabel) yearLabel.textContent = window.friendCalendarYears[friendName];
        if (prevBtn) prevBtn.style.visibility = window.friendCalendarYears[friendName] <= 2026 ? 'hidden' : 'visible';
    };

    window.renderFriendCalendarMonths = function (friendName) {
        const chronicles = window.cachedFriendChronicles[friendName] || [];
        const year = window.friendCalendarYears[friendName] || new Date().getFullYear();
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        // Build XP map keyed by toLocaleDateString()
        let xpMap = {};
        let maxXP = 1;
        chronicles.forEach(entry => {
            const d = new Date(entry.date);
            if (d.getFullYear() === year) {
                const xp = calculateXpFromStats(entry.stats || {}, entry.date);
                const key = d.toLocaleDateString();
                xpMap[key] = xp;
                if (xp > maxXP) maxXP = xp;
            }
        });

        // Determine the friend's first log date (for "0 XP" red-day highlighting)
        let firstLogDate = null;
        if (chronicles.length > 0) {
            const sorted = [...chronicles].sort((a, b) => new Date(a.date) - new Date(b.date));
            firstLogDate = new Date(sorted[0].date);
            firstLogDate.setHours(0, 0, 0, 0);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let html = '<div class="calendar-year-grid">';
        for (let month = 0; month < 12; month++) {
            let firstDay = new Date(year, month, 1).getDay();
            let daysInMonth = new Date(year, month + 1, 0).getDate();
            let dayHtml = '';

            for (let i = 0; i < firstDay; i++) {
                dayHtml += '<div class="cal-day empty"></div>';
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const d = new Date(year, month, day);
                d.setHours(0, 0, 0, 0);
                const key = d.toLocaleDateString();
                const xp = xpMap[key] !== undefined ? xpMap[key] : null;

                let bg = '';
                let tooltip = `${key}: Uncharted`;

                if (xp > 0) {
                    bg = `background: hsl(${(xp / maxXP) * 120}, 80%, 50%);`;
                    tooltip = `${key}: ${xp} XP`;
                } else if (firstLogDate && d >= firstLogDate && d <= today) {
                    // Inside the tracked window but nothing logged — same red as stats tab
                    bg = 'background: #ef4444;';
                    tooltip = `${key}: 0 XP`;
                }

                dayHtml += `<div class="cal-day" style="${bg}" data-tooltip="${tooltip}"></div>`;
            }

            html += `
                <div class="cal-month">
                    <div class="cal-month-name">${monthNames[month]}</div>
                    <div class="cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
                    <div class="cal-days-grid">${dayHtml}</div>
                </div>`;
        }
        html += '</div>';
        return html;
    };

    window.generateFriendCalendarHTML = function (friendName, chronicles) {
        window.cachedFriendChronicles[friendName] = chronicles || [];
        window.friendCalendarYears[friendName] = new Date().getFullYear();

        return `
            <div class="calendar-header" style="margin-bottom:14px;">
                <button id="fcal-prev-${friendName}" class="cal-nav-btn" style="visibility:hidden;"
                    onclick="changeFriendCalendarYear('${friendName}', -1)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <h2 id="fcal-year-${friendName}" style="font-size:1.2rem; margin:0;">
                    ${new Date().getFullYear()}
                </h2>
                <button id="fcal-next-${friendName}" class="cal-nav-btn"
                    onclick="changeFriendCalendarYear('${friendName}', 1)">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="calendar-legend" style="margin-bottom:12px;">
                <span style="color:var(--text-dim); font-size:0.8rem;">0 XP</span>
                <div class="legend-gradient"></div>
                <span style="color:var(--text-dim); font-size:0.8rem;">Max XP</span>
            </div>
            <div id="fcal-body-${friendName}">
                ${window.renderFriendCalendarMonths(friendName)}
            </div>`;
    };


    // --- FRIEND REQUEST INBOX ---
    window.checkFriendRequests = function () {
        let data = getSaveData();
        if (!data.hero_name) return;

        // CHANGED: .once('value') becomes .on('value') to listen constantly in the background!
        db.ref(`heroes/${data.hero_name.toLowerCase()}/friend_requests`).on('value', snap => {
            const requests = snap.val();

            // If a request exists and the player isn't already fighting/looting
            if (requests && !inEncounter) {
                const firstReqKey = Object.keys(requests)[0];
                const reqData = requests[firstReqKey];

                // 1. Freeze player movement safely
                if (window.gameEngine) {
                    window.gameEngine.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
                }

                // 2. Lock the engine so they can't walk away
                inEncounter = true;

                // 3. Render the UI
                const panel = document.getElementById('encounter-panel');
                panel.innerHTML = `
                <div class="encounter-card" style="border-color: var(--accent-color); box-shadow: 0 0 20px rgba(56, 189, 248, 0.3);">
                    <div class="encounter-emoji">💌</div>
                    <h2 style="color: var(--accent-color);">Ally Request</h2>
                    <p style="color: var(--text-dim); margin-top: 10px; max-width: 500px;"><strong>${reqData.from}</strong> (a ${reqData.class}) encountered you in the realm and wishes to become friends!</p>
                    <div class="encounter-btn-group">
                        <button class="submit-btn" onclick="acceptFriendRequest('${firstReqKey}', '${reqData.from}')">Accept Friendship</button>
                        <button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);" onclick="declineFriendRequest('${firstReqKey}')">Decline</button>
                    </div>
                </div>
            `;
                panel.classList.add('active');
                updateAdventureHUD();
            }
        });
    };

    window.acceptFriendRequest = function (reqKey, friendName) {
        let data = getSaveData();

        // Add them to the local list
        if (!data.friends_list.includes(friendName)) {
            data.friends_list.push(friendName);
            updateSaveData(data);
            renderFriendsList();
        }

        // Wiping this from Firebase automatically triggers the .on() listener again
        db.ref(`heroes/${data.hero_name.toLowerCase()}/friend_requests/${reqKey}`).remove();

        // Unlock the game
        inEncounter = false;
        document.getElementById('encounter-panel').classList.remove('active');
        updateAdventureHUD();
    };

    window.declineFriendRequest = function (reqKey) {
        let data = getSaveData();
        db.ref(`heroes/${data.hero_name.toLowerCase()}/friend_requests/${reqKey}`).remove();

        // Unlock the game
        inEncounter = false;
        document.getElementById('encounter-panel').classList.remove('active');
        updateAdventureHUD();
    };

    // --- DEVELOPER CHEATS ---
    window.devFillEnergy = function () {
        let data = getSaveData();
        if (data && data.stats) {
            // Calculate the absolute max energy for the current stats
            let eq = data.equipped || { weapon: null, armor: null, accessory: null };
            let bonusEnd = 0;
            Object.values(eq).forEach(item => {
                if (item && item.targetStat === 'end') bonusEnd += item.statBonus;
            });
            let totalEnd = data.stats.end + bonusEnd;

            const maxEnergy = 20 + (totalEnd * 5);

            // Fill it up
            data.stats.current_energy = maxEnergy;

            // We are now inside the right scope, so we can directly update the physics tracker!
            exactEnergy = maxEnergy;

            // Sync the live engine tracker
            if (window.gameEngine) {
                window.gameEngine.currentEnergy = maxEnergy;
                window.gameEngine.maxEnergy = maxEnergy;
                window.gameEngine.isExhausted = false;
            }

            updateSaveData(data);

            // Safely update the UI if the functions are available
            if (typeof updateAdventureHUD === 'function') updateAdventureHUD();
            if (typeof updateCharacterTabUI === 'function') updateCharacterTabUI();

            console.log(`⚡ Developer Cheat: Energy restored to ${maxEnergy}!`);
        }
    };

    // --- DEV CHEAT: Grant the Warden's Key (and a stack of pachinko tokens) ---
    // Replaces the older devGiveFateCoin cheat.  Bound to F11 below.
    window.devGiveWardensKey = function () {
        let data = getSaveData();
        const isFirstKey = !data.wardens_key;
        data.wardens_key = true;
        // Top up tokens so the cheat is useful for testing the Lost Pegs game
        data.pachinko_tokens = (data.pachinko_tokens || 0) + 10;
        updateSaveData(data);
        console.log(`🗝️ Developer Cheat: Warden's Key granted! Tokens: ${data.pachinko_tokens}`);
        updateStatusLog(`🗝️ [DEV] Warden's Key granted! +10 Pachinko Tokens (${data.pachinko_tokens} total)`);
        if (isFirstKey && typeof showWardensKeyUnlockModal === 'function') {
            showWardensKeyUnlockModal();
        }
        updateMinigamesSidebarPanel();
    };
    // Backward-compat alias so any console muscle-memory still works
    window.devGiveFateCoin = window.devGiveWardensKey;

    // Bind the cheat to the F9 key
    window.addEventListener('keydown', function (e) {
        if (e.key === 'F9') {
            e.preventDefault(); // Stop the browser from doing any default F9 actions
            window.devFillEnergy();
        }
        // F10: Dev cheat — unlock all quest items (testing only)
        if (e.key === 'F10') {
            e.preventDefault();
            window.devUnlockQuest();
        }
        // F11: Dev cheat — grant the Warden's Key + 10 Pachinko Tokens (testing only)
        if (e.key === 'F11') {
            e.preventDefault();
            window.devGiveWardensKey();
        }
    });

    // --- Emergency Fog Save on Exit ---
    window.addEventListener('beforeunload', function () {
        saveFogData(); // Always save, regardless of unwritten points
        // Also flush the current energy so a refresh never appears to restore it.
        // _saveEnergy() is synchronous (pure localStorage), so it's safe in beforeunload.
        if (window.gameEngine && typeof window.gameEngine._saveEnergy === 'function') {
            window.gameEngine._saveEnergy();
        }
    });

    // --- BOSS FIGHT BRIDGE ---------------------------------------------------
    // Expose closure-scoped helpers so external modules (e.g. boss-fight.js)
    // can reuse them without copy-pasting save logic, combat math, or UI code.
    // Safe to add or remove at will.
    window.getSaveData = getSaveData;
    window.updateSaveData = updateSaveData;
    window.getTotalStat = getTotalStat;
    window.awardXP = awardXP;
    window.updateAdventureHUD = updateAdventureHUD;
    window.updateCharacterTabUI = updateCharacterTabUI;
    window.updateStatusLog = updateStatusLog;
    window.getHeroImage = getHeroImage;
    window.checkQuestCompletion = checkQuestCompletion;
    // --- Mini-games / Warden's Key bridge --------------------------------
    // Exposed so lostpegs.js can re-sync the nav badge after a token spend,
    // and so any other module that grants XP can also award pachinko tokens.
    window.updateMinigamesSidebarPanel = updateMinigamesSidebarPanel;
    window.grantPachinkoTokensFromXP = grantPachinkoTokensFromXP;
    window.deallocateStatPoint = deallocateStatPoint;
    window.saveStatAllocations = saveStatAllocations;
    // Read-only getters/setters for module-scoped state used by boss-fight.js.
    Object.defineProperty(window, 'inEncounter', {
        get: () => inEncounter,
        set: (v) => { inEncounter = v; },
        configurable: true
    });
    Object.defineProperty(window, 'currentMapId', {
        get: () => currentMapId,
        configurable: true
    });
    // -------------------------------------------------------------------------

    // Boot Up
    initializeApp();
});
