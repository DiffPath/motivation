/* ==========================================================================
   BOSS FIGHT SYSTEM
   ==========================================================================
   Co-op boss battles between a player and ONE friend. The flow:

     Phase 1: ENCOUNTERED
       - One player walks into a boss tile.
       - Their only option is "Call for Aid". Fleeing/single-fighting disabled.

     Phase 2: RALLYING
       - The call goes out to their (auto-enrolled) friend.
       - Both players spend the rest of "today" using up energy on the world
         and equipping items. Energy will NOT carry over.
       - At 2 AM CST, the system advances to phase 3 and gives each player
         a fresh boss-fight energy pool (their max energy).

     Phase 3: ATTACKING (player turn)
       - Each player spends 1 boss-energy per attack (does damage = STR - DEF).
       - When BOTH players are out of boss-energy OR press "End My Turn",
         the system flags them as "ready". When both ready -> phase 4.

     Phase 4: BOSS_TURN (resolves at next 2 AM)
       - Boss strikes both players for total damage = boss.str - playerDef.
       - Total damage is split equally between the LIVING players. If one
         player is dead, the spirit takes 0 damage and the living player
         eats it all.
       - Dead players become "spirits": still attack (-30% damage) but
         take no damage.
       - Then the round resets: each living player gets fresh boss-energy
         and we go back to phase 3.

     Phase 5: VICTORY / DEFEAT
       - Boss HP <= 0  -> both players draw a real-world reward.
       - Both players dead simultaneously -> defeat, boss reset, players
         respawn in overworld with halved XP.

   STORAGE
     - All state lives in Firebase under realm/boss_fights/{battleId}.
       battleId = sorted "playerA__playerB__bossKey" so both clients
       deterministically point to the same node.
     - Each client mirrors a tiny pointer in their local save (active_boss_battle)
       so they can find the room when they reload.

   This file is loaded AFTER game-data.js and game.js, so we can read
   gameMonsters, getSaveData(), updateSaveData(), getTotalStat(),
   handlePlayerDeath(), updateAdventureHUD(), and `db` (Firebase).
   ========================================================================== */

// ---------------------------------------------------------------------------
// 1. REAL-WORLD REWARDS POOL
// ---------------------------------------------------------------------------
// Each entry is one possible prize. When the boss is defeated the system picks
// one at random for each player. To add a reward, push a new object onto the
// array using this shape:
//
//   {
//     id:          'unique_string',                  // any unique slug
//     name:        'Pizza Night',                    // shown in the prize UI
//     icon:        '🍕',                             // emoji or short image tag
//     description: 'You earned one cheat-meal night.', // short flavor copy
//     rarity:      'common' | 'uncommon' | 'rare' | 'epic',
//                                                    // controls draw weight
//                                                    // (see WEIGHTS below)
//     bossTier:    'minor' | 'major' | 'any'         // optional - which bosses
//                                                    // can drop it. 'any' fits both.
//   }
// ---------------------------------------------------------------------------
const realWorldRewards = [
    // Add your real-world rewards here.
    // Example template (uncomment / edit):
    // {
    //     id: 'movie_night',
    //     name: 'Movie Night',
    //     icon: '🎬',
    //     description: 'Pick a movie. Pop the popcorn. No guilt allowed.',
    //     rarity: 'common',
    //     bossTier: 'any'
    // },
];

// Draw weights by rarity. Higher = more likely to be picked.
const REWARD_RARITY_WEIGHTS = {
    common:   60,
    uncommon: 25,
    rare:     12,
    epic:     3
};

// ---------------------------------------------------------------------------
// 2. BOSS BATTLE TUNING
// ---------------------------------------------------------------------------
// All numbers below are intentionally pulled out into one place so the battles
// can be re-balanced without hunting through the file.
// ---------------------------------------------------------------------------
const BOSS_FIGHT_CONFIG = {
    // Damage modifiers
    SPIRIT_DAMAGE_MULTIPLIER: 0.7,   // spirits hit for 70% of normal damage
    PLAYER_ATTACK_VARIANCE:   0.2,   // ±20% on each player attack
    BOSS_ATTACK_VARIANCE:     0.15,  // ±15% on each boss strike
    MIN_DAMAGE:               1,     // every hit lands for at least 1

    // Energy
    // Each attack costs 1 boss-energy. Players start each round with their full
    // out-of-battle energy pool — but it's a *separate* pool so it doesn't
    // refund their adventuring energy.

    // XP awards on victory
    XP_VICTORY_BASE: 200,
    XP_VICTORY_PER_BOSS_HP: 0.5,     // extra XP scaled to the boss HP pool
};

// ---------------------------------------------------------------------------
// 3. UTILITY: the canonical battle ID
// ---------------------------------------------------------------------------
function bossBattleId(playerA, playerB, bossKey) {
    // Sorting the names gives both clients the same key without coordinating.
    const [a, b] = [playerA.toLowerCase(), playerB.toLowerCase()].sort();
    return `${a}__${b}__${bossKey}`;
}

// ---------------------------------------------------------------------------
// 4. UTILITY: 2 AM CST timestamp helper (mirrors checkAndApplyPendingRewards)
// ---------------------------------------------------------------------------
function next2amCstTimestamp(fromMs = Date.now()) {
    const d = new Date(fromMs);
    // Roll forward to "tomorrow" in local time, then shift to 2 AM CST/CDT (UTC-6/-5).
    d.setDate(d.getDate() + 1);
    const month = d.getMonth() + 1;
    const isDST = month >= 3 && month <= 11;   // approximate, matches the rest of the file
    d.setUTCHours(isDST ? 7 : 8, 0, 0, 0);
    return d.getTime();
}

// ---------------------------------------------------------------------------
// 5. PUBLIC ENTRY POINTS (these are called from game.js)
// ---------------------------------------------------------------------------

/**
 * Called from startEncounter when a tile's monster has isBoss === true.
 * Replaces the normal "Engage / Flee" prompt with a "Call for Aid" prompt.
 * Renders into #encounter-panel.
 */
window.startBossEncounter = function (x, y, bossKey, oldPixelX, oldPixelY) {
    const panel = document.getElementById('encounter-panel');
    if (!panel) return;

    inEncounter = true;

    const bossDef = gameMonsters[bossKey];
    if (!bossDef) {
        console.warn('[BossFight] unknown boss key', bossKey);
        return;
    }

    const data = getSaveData();
    const friend = (data.friends_list || [])[0];

    // ---- No friend?  We hard-block the boss for now.
    if (!friend) {
        panel.innerHTML = `
            <div class="encounter-card boss-encounter-card">
                <img src="${bossDef.overworldUrl}"
                     alt="${bossDef.name}"
                     style="width:120px; height:120px; filter: drop-shadow(0 0 20px ${bossDef.glow}); animation: chest-pop 0.6s ease-out;" />
                <h2 style="color:#ef4444; letter-spacing:2px; margin-top:14px; text-transform:uppercase;">${bossDef.name}</h2>
                <p style="color: var(--text-dim); margin: 14px auto; max-width: 480px; line-height:1.7;">
                    The fearsome ${bossDef.name} towers before you. Its gaze alone shatters your focus.
                    <br><br>
                    <em style="color:#fcd34d;">You sense, with dread certainty, that you cannot face this alone.
                    You need an ally who walks the same path — return when you have one.</em>
                </p>
                <button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                        onclick="resolveEncounter(${x}, ${y}, 'flee', ${oldPixelX}, ${oldPixelY})">
                    Retreat
                </button>
            </div>
        `;
        panel.classList.add('active');
        updateAdventureHUD();
        return;
    }

    // ---- Boss already in progress with this friend?
    const existingId = bossBattleId(data.hero_name, friend, bossKey);
    db.ref(`realm/boss_fights/${existingId}`).once('value').then(snap => {
        const battle = snap.val();
        if (battle && battle.phase !== 'defeat' && battle.phase !== 'victory') {
            // Already an open battle - just open the room.
            renderBossBattleRoom(existingId);
            return;
        }
        // Fresh boss prompt.
        renderBossEncounterPrompt(x, y, bossKey, oldPixelX, oldPixelY, friend);
    });
};

function renderBossEncounterPrompt(x, y, bossKey, oldPixelX, oldPixelY, friend) {
    const panel = document.getElementById('encounter-panel');
    const bossDef = gameMonsters[bossKey];

    panel.innerHTML = `
        <div class="encounter-card boss-encounter-card">
            <div class="boss-warning-banner">⚠ BOSS ENCOUNTER ⚠</div>
            <img src="${bossDef.overworldUrl}"
                 alt="${bossDef.name}"
                 class="boss-portrait-large"
                 style="filter: drop-shadow(0 0 25px ${bossDef.glow});" />
            <h2 style="color:#ef4444; letter-spacing:3px; margin-top:14px; text-transform:uppercase; font-size:1.5rem;">
                ${bossDef.name}
            </h2>
            <p style="color: var(--text-dim); margin: 14px auto; max-width: 480px; line-height:1.7;">
                Its presence warps the air. You will not survive this fight alone.
                <br><br>
                <strong style="color:#fcd34d;">Call to ${friend} for aid.</strong>
                Until tomorrow's dawn, both of you may use up your energy out in the world
                and equip what gear you have. <em>Energy will not carry into the fight.</em>
            </p>
            <div class="encounter-btn-group">
                <button class="submit-btn"
                        style="background:#ef4444; border-color:#ef4444; color:#fff;"
                        onclick="bossFight_callForAid('${bossKey}', ${x}, ${y}, ${oldPixelX}, ${oldPixelY})">
                    🗡️ Call for Aid &amp; Prepare
                </button>
                <button class="submit-btn"
                        style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                        onclick="resolveEncounter(${x}, ${y}, 'flee', ${oldPixelX}, ${oldPixelY})">
                    Retreat for now
                </button>
            </div>
        </div>
    `;
    panel.classList.add('active');
    updateAdventureHUD();
}

/**
 * Triggered when the encountering player presses "Call for Aid".
 * Creates the battle room in Firebase and notifies the friend.
 */
window.bossFight_callForAid = async function (bossKey, x, y, oldPixelX, oldPixelY) {
    const data = getSaveData();
    const friend = (data.friends_list || [])[0];
    if (!friend) return;

    const bossDef = gameMonsters[bossKey];
    const battleId = bossBattleId(data.hero_name, friend, bossKey);

    // Scale the boss to the average level of the two players. We'll get the friend's
    // level from Firebase; fall back to our own level if it can't be fetched.
    const myLevel = (data.stats && data.stats.level) || 1;
    let friendLevel = myLevel;
    try {
        const snap = await db.ref('heroes/' + friend.toLowerCase()).once('value');
        friendLevel = (snap.val() && snap.val().stats && snap.val().stats.level) || myLevel;
    } catch (e) { /* ignore — fall back to myLevel */ }

    const avgLevel = Math.max(1, Math.round((myLevel + friendLevel) / 2));
    const scale = 1 + Math.max(0, avgLevel - 1) * 0.18;

    const scaledHp  = Math.floor(bossDef.hp * scale * 1.4);   // bosses get a little extra
    const scaledStr = Math.floor(bossDef.str * scale);
    const scaledDef = Math.floor(bossDef.def * scale);

    // ---- The shared battle document.
    const room = {
        bossKey,
        phase: 'rallying',                 // -> attacking -> boss_turn -> attacking ... -> victory|defeat
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        boss: {
            name: bossDef.name,
            img: bossDef.battleImg,
            hp: scaledHp,
            maxHp: scaledHp,
            str: scaledStr,
            def: scaledDef
        },
        players: {
            [data.hero_name]: makePlayerEntry(data, /*isInitiator*/ true),
            [friend]:         makePlayerEntryStub(friend)   // populated when friend opens the room
        },
        roundNumber: 1,
        // 2 AM CST tomorrow — when "preparation" ends and attacking phase begins
        preparationEndsAt: next2amCstTimestamp(),
        log: [
            { ts: Date.now(), msg: `${data.hero_name} encountered ${bossDef.name} and called for aid!` }
        ]
    };

    await db.ref(`realm/boss_fights/${battleId}`).set(room);

    // ---- Notify the friend.
    await db.ref(`heroes/${friend.toLowerCase()}/boss_alerts/${battleId}`).set({
        from: data.hero_name,
        bossKey,
        bossName: bossDef.name,
        battleId,
        ts: firebase.database.ServerValue.TIMESTAMP
    });

    // ---- Mark our local save so we know we're in a fight.
    data.active_boss_battle = battleId;
    if (data.adventure_state) data.adventure_state.active_encounter = null;
    updateSaveData(data);

    // ---- Remove the boss from the world tile (consumed).
    const key = `${x},${y}`;
    const entityPath = currentMapId === 'overworld'
        ? `realm/shared_map/gridEntities/${key}`
        : `realm/shared_map/caves/${currentMapId}/gridEntities/${key}`;
    db.ref(entityPath).remove();
    if (window.gridEntities) delete window.gridEntities[key];

    // ---- Bounce the player back so they don't immediately re-trigger the empty tile.
    if (window.gameEngine) {
        window.gameEngine.player.x = oldPixelX;
        window.gameEngine.player.y = oldPixelY;
        syncPlayerPosition();
    }

    // ---- Open the battle room.
    renderBossBattleRoom(battleId);
};

// Helper: build a fresh player entry from local save data.
function makePlayerEntry(data, isInitiator) {
    const maxHp = 50 + (getTotalStat(data, 'vit') * 10);
    return {
        heroName:      data.hero_name,
        heroClass:     data.hero_class,
        joined:        true,
        isInitiator:   !!isInitiator,
        // Combat stats are SNAPSHOTS — they only refresh between rounds, after
        // the boss strikes.  This matches the "equip what you need" beat from
        // the spec: gear changes inside a round don't take effect until the
        // round resets.
        currentHp:     (data.stats && data.stats.current_hp) || maxHp,
        maxHp:         maxHp,
        str:           getTotalStat(data, 'str'),
        def:           getTotalStat(data, 'def'),
        // Boss-energy is a separate pool from world energy.
        bossEnergy:    0,                  // populated when phase -> attacking
        maxBossEnergy: 20 + (getTotalStat(data, 'end') * 5),
        spirit:        false,
        endedTurn:     false
    };
}
function makePlayerEntryStub(name) {
    return {
        heroName:  name,
        joined:    false,
        spirit:    false,
        endedTurn: false
    };
}

// ---------------------------------------------------------------------------
// 6. INCOMING ALERT: friend gets pulled into the fight
// ---------------------------------------------------------------------------
// Called from a Firebase listener registered in setupBossAlerts() below.
function handleIncomingBossAlert(alertKey, alert) {
    if (inEncounter) return;   // wait until they're free
    const data = getSaveData();
    const panel = document.getElementById('encounter-panel');
    if (!panel) return;

    inEncounter = true;
    const bossDef = gameMonsters[alert.bossKey] || { name: alert.bossName, overworldUrl: '', glow: 'rgba(239,68,68,0.6)' };

    panel.innerHTML = `
        <div class="encounter-card boss-encounter-card">
            <div class="boss-warning-banner" style="background:#fcd34d; color:#000;">⚔ ALLY IN PERIL ⚔</div>
            <img src="${bossDef.overworldUrl || ''}"
                 alt="${bossDef.name}"
                 class="boss-portrait-large"
                 style="filter: drop-shadow(0 0 25px ${bossDef.glow});"
                 onerror="this.style.display='none'" />
            <h2 style="color:#fcd34d; letter-spacing:2px; margin-top:14px;">${alert.from} needs you!</h2>
            <p style="color: var(--text-dim); margin: 14px auto; max-width: 480px; line-height:1.7;">
                Your ally <strong>${alert.from}</strong> has encountered the
                <strong style="color:#ef4444;">${bossDef.name}</strong> and called for aid.
                <br><br>
                Until tomorrow's dawn, use up your energy out in the world and equip your best gear.
                <em>Energy will not carry into the fight.</em>
            </p>
            <div class="encounter-btn-group">
                <button class="submit-btn"
                        style="background:#fcd34d; border-color:#fcd34d; color:#000;"
                        onclick="bossFight_acceptAlert('${alertKey}','${alert.battleId}')">
                    ⚔ Answer the Call
                </button>
            </div>
        </div>
    `;
    panel.classList.add('active');
    updateAdventureHUD();
}

window.bossFight_acceptAlert = async function (alertKey, battleId) {
    const data = getSaveData();

    // Write our player entry into the battle room.
    const myEntry = makePlayerEntry(data, /*isInitiator*/ false);
    await db.ref(`realm/boss_fights/${battleId}/players/${data.hero_name}`).set(myEntry);
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `${data.hero_name} answered the call!`
    });

    // Save pointer locally + clear alert.
    data.active_boss_battle = battleId;
    updateSaveData(data);
    db.ref(`heroes/${data.hero_name.toLowerCase()}/boss_alerts/${alertKey}`).remove();

    inEncounter = false;
    renderBossBattleRoom(battleId);
};

// ---------------------------------------------------------------------------
// 7. THE BATTLE ROOM
// ---------------------------------------------------------------------------
let _bossRoomListener = null;
let _bossRoomBattleId = null;

function renderBossBattleRoom(battleId) {
    inEncounter = true;
    _bossRoomBattleId = battleId;

    // Tear down any previous listener
    if (_bossRoomListener) _bossRoomListener.off();

    const ref = db.ref(`realm/boss_fights/${battleId}`);
    _bossRoomListener = ref;

    ref.on('value', snap => {
        const battle = snap.val();
        if (!battle) {
            // Battle was deleted; clean up.
            closeBossRoom(/*silent*/ true);
            return;
        }

        // Auto-advance phase based on time.
        maybeAutoAdvancePhase(battleId, battle);

        drawBossRoom(battle);
    });
}

function closeBossRoom(silent = false) {
    if (_bossRoomListener) {
        _bossRoomListener.off();
        _bossRoomListener = null;
    }
    _bossRoomBattleId = null;

    const panel = document.getElementById('encounter-panel');
    if (panel) {
        panel.classList.remove('active');
        panel.innerHTML = '';
    }
    inEncounter = false;
    updateAdventureHUD();
}

// ---------------------------------------------------------------------------
// 8. PHASE TRANSITIONS (driven by client polling — no server)
// ---------------------------------------------------------------------------
async function maybeAutoAdvancePhase(battleId, battle) {
    const now = Date.now();

    // RALLYING -> ATTACKING (when prep window ends at 2 AM CST)
    if (battle.phase === 'rallying' && battle.preparationEndsAt && now >= battle.preparationEndsAt) {
        await beginAttackingPhase(battleId, battle);
        return;
    }

    // BOSS_TURN scheduled at 2 AM CST after both players ended their turns.
    if (battle.phase === 'boss_turn' && battle.bossTurnAt && now >= battle.bossTurnAt) {
        await runBossStrike(battleId, battle);
        return;
    }
}

async function beginAttackingPhase(battleId, battle) {
    // Refill each LIVING player's boss-energy. Snapshot fresh stats from the
    // hero's public Firebase doc so any newly-equipped items count.
    const updates = { phase: 'attacking' };
    for (const name in battle.players) {
        const p = battle.players[name];
        if (!p || !p.joined) continue;

        // Try to fetch latest stats so equipment changes are reflected.
        let fresh = null;
        try {
            const snap = await db.ref('heroes/' + name.toLowerCase()).once('value');
            fresh = snap.val();
        } catch (e) { /* ignore */ }

        const totalsFromFresh = computePublicTotals(fresh);
        const newMax    = totalsFromFresh.maxEnergy ?? p.maxBossEnergy;
        const newStr    = totalsFromFresh.str       ?? p.str;
        const newDef    = totalsFromFresh.def       ?? p.def;
        const newMaxHp  = totalsFromFresh.maxHp     ?? p.maxHp;

        updates[`players/${name}/maxBossEnergy`] = newMax;
        updates[`players/${name}/bossEnergy`]    = p.spirit ? newMax : newMax;   // spirits also act
        updates[`players/${name}/str`]           = newStr;
        updates[`players/${name}/def`]           = newDef;
        updates[`players/${name}/maxHp`]         = newMaxHp;
        updates[`players/${name}/endedTurn`]     = false;

        // First time we enter attacking phase from rallying, set HP to maxHp.
        if (battle.phase === 'rallying') {
            updates[`players/${name}/currentHp`] = newMaxHp;
        }
    }
    updates.bossTurnAt = null;   // clear any stale schedule

    await db.ref(`realm/boss_fights/${battleId}`).update(updates);
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `⚔️ Round ${battle.roundNumber}: the players strike!`
    });
}

async function runBossStrike(battleId, battle) {
    // Re-read fresh state (the snapshot may be slightly stale by the time we get here).
    const snap = await db.ref(`realm/boss_fights/${battleId}`).once('value');
    const fresh = snap.val();
    if (!fresh) return;
    if (fresh.phase !== 'boss_turn') return;   // someone else got here first

    const players = fresh.players || {};
    const livingNames = Object.keys(players).filter(n => players[n].joined && !players[n].spirit);
    const spiritNames = Object.keys(players).filter(n => players[n].joined &&  players[n].spirit);

    if (livingNames.length === 0) {
        // Both players died at the start of this turn somehow.  Defeat.
        return finalizeDefeat(battleId, fresh);
    }

    // Total raw boss damage = boss.str (split equally among LIVING players).
    // Each living player's actual damage = (totalDamage/livingCount) - playerDef,
    // jittered by ±BOSS_ATTACK_VARIANCE.
    const updates = { phase: 'attacking', roundNumber: (fresh.roundNumber || 1) + 1, bossTurnAt: null };
    const logEntries = [];

    const totalRaw = fresh.boss.str * 2;   // designed for 2 players: 2x str split equally
    const perLiving = totalRaw / livingNames.length;

    for (const name of livingNames) {
        const p = players[name];
        let dmg = perLiving - p.def;
        const jitter = 1 + (Math.random() - 0.5) * 2 * BOSS_FIGHT_CONFIG.BOSS_ATTACK_VARIANCE;
        dmg = Math.max(BOSS_FIGHT_CONFIG.MIN_DAMAGE, Math.floor(dmg * jitter));

        const newHp = Math.max(0, p.currentHp - dmg);
        updates[`players/${name}/currentHp`] = newHp;

        if (newHp <= 0) {
            updates[`players/${name}/spirit`] = true;
            logEntries.push({ ts: Date.now(), msg: `💀 ${fresh.boss.name} struck ${name} for ${dmg} — they fell, but rise as a spirit!` });
        } else {
            logEntries.push({ ts: Date.now(), msg: `🩸 ${fresh.boss.name} struck ${name} for ${dmg} damage.` });
        }
    }
    for (const name of spiritNames) {
        logEntries.push({ ts: Date.now(), msg: `👻 ${name}'s spirit is untouched by the blow.` });
    }

    // Refill each surviving (or spirit) player's boss-energy + clear endedTurn.
    for (const name in players) {
        const p = players[name];
        if (!p.joined) continue;
        const stillLiving = !((updates[`players/${name}/currentHp`] ?? p.currentHp) <= 0);
        // Spirits CAN attack so they also get energy
        updates[`players/${name}/bossEnergy`] = p.maxBossEnergy;
        updates[`players/${name}/endedTurn`]  = false;
        if (!stillLiving) updates[`players/${name}/spirit`] = true;
    }

    // Are both players dead?  Then it's defeat.
    const allWipedAfter = livingNames.every(n => (updates[`players/${n}/currentHp`] ?? players[n].currentHp) <= 0);
    if (allWipedAfter && spiritNames.length === 0) {
        return finalizeDefeat(battleId, fresh);
    }

    await db.ref(`realm/boss_fights/${battleId}`).update(updates);
    for (const e of logEntries) {
        await db.ref(`realm/boss_fights/${battleId}/log`).push(e);
    }
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `⚔️ Round ${(fresh.roundNumber || 1) + 1}: strike again!`
    });
}

// Recompute "max" stats from a hero's public Firebase document (if available).
function computePublicTotals(heroDoc) {
    if (!heroDoc || !heroDoc.stats) return {};
    const eq = heroDoc.equipped || {};
    let strBonus = 0, defBonus = 0, vitBonus = 0, endBonus = 0;
    Object.values(eq).forEach(item => {
        if (!item) return;
        if (item.targetStat === 'str') strBonus += item.statBonus;
        if (item.targetStat === 'def') defBonus += item.statBonus;
        if (item.targetStat === 'vit') vitBonus += item.statBonus;
        if (item.targetStat === 'end') endBonus += item.statBonus;
    });
    return {
        str:       heroDoc.stats.str + strBonus,
        def:       heroDoc.stats.def + defBonus,
        maxHp:     50 + ((heroDoc.stats.vit + vitBonus) * 10),
        maxEnergy: 20 + ((heroDoc.stats.end + endBonus) * 5)
    };
}

// ---------------------------------------------------------------------------
// 9. THE PLAYER'S BOSS-ATTACK ACTION
// ---------------------------------------------------------------------------
window.bossFight_attack = async function () {
    if (!_bossRoomBattleId) return;
    const data = getSaveData();
    const battleId = _bossRoomBattleId;

    // Use a transaction so simultaneous attacks from both clients can't desync.
    const battleRef = db.ref(`realm/boss_fights/${battleId}`);
    const txResult = await battleRef.transaction(battle => {
        if (!battle || battle.phase !== 'attacking') return;

        const me = battle.players[data.hero_name];
        if (!me || !me.joined) return;
        if (me.bossEnergy <= 0)  return;
        if (me.endedTurn)        return;

        // Compute damage.
        const baseDmg = Math.max(BOSS_FIGHT_CONFIG.MIN_DAMAGE, me.str - battle.boss.def);
        const jitter  = 1 + (Math.random() - 0.5) * 2 * BOSS_FIGHT_CONFIG.PLAYER_ATTACK_VARIANCE;
        const spiritFactor = me.spirit ? BOSS_FIGHT_CONFIG.SPIRIT_DAMAGE_MULTIPLIER : 1;
        const dmg = Math.max(BOSS_FIGHT_CONFIG.MIN_DAMAGE, Math.floor(baseDmg * jitter * spiritFactor));

        battle.boss.hp = Math.max(0, battle.boss.hp - dmg);
        me.bossEnergy = Math.max(0, me.bossEnergy - 1);

        battle.__lastHitDmg  = dmg;
        battle.__lastHitWho  = data.hero_name;
        battle.__lastHitWhen = Date.now();

        return battle;
    });

    if (!txResult.committed) return;
    const after = txResult.snapshot.val();
    if (!after) return;

    // Push a log entry (do this *outside* the transaction).
    if (after.__lastHitDmg && after.__lastHitWho === data.hero_name) {
        await db.ref(`realm/boss_fights/${battleId}/log`).push({
            ts: Date.now(),
            msg: (after.players[data.hero_name].spirit ? '👻 ' : '⚔ ') +
                 `${data.hero_name} hits the boss for ${after.__lastHitDmg}!`
        });
    }

    // Boss died?
    if (after.boss.hp <= 0 && after.phase !== 'victory') {
        return finalizeVictory(battleId, after);
    }

    // Both players out of energy or both ended turn?  Schedule boss turn.
    await maybeScheduleBossTurn(battleId);
};

window.bossFight_endTurn = async function () {
    if (!_bossRoomBattleId) return;
    const data = getSaveData();
    const battleId = _bossRoomBattleId;
    await db.ref(`realm/boss_fights/${battleId}/players/${data.hero_name}/endedTurn`).set(true);
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `⏳ ${data.hero_name} ends their turn.`
    });
    await maybeScheduleBossTurn(battleId);
};

async function maybeScheduleBossTurn(battleId) {
    const snap = await db.ref(`realm/boss_fights/${battleId}`).once('value');
    const battle = snap.val();
    if (!battle || battle.phase !== 'attacking') return;

    const players = battle.players || {};
    const joined = Object.keys(players).filter(n => players[n].joined);
    if (joined.length === 0) return;

    // "Done" = either ended turn OR out of energy.
    const allDone = joined.every(n => players[n].endedTurn || players[n].bossEnergy <= 0);
    if (!allDone) return;

    await db.ref(`realm/boss_fights/${battleId}`).update({
        phase: 'boss_turn',
        bossTurnAt: next2amCstTimestamp()
    });
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `😴 The party rests. The ${battle.boss.name} stirs at dawn...`
    });
}

// ---------------------------------------------------------------------------
// 10. VICTORY / DEFEAT
// ---------------------------------------------------------------------------
async function finalizeVictory(battleId, battle) {
    // Pick a reward for each joined player.
    const players = battle.players || {};
    const playerNames = Object.keys(players).filter(n => players[n].joined);
    const rewards = {};
    for (const name of playerNames) {
        rewards[name] = pickRealWorldReward(battle.boss.maxHp >= 200 ? 'major' : 'minor');
    }

    const xpReward = Math.floor(BOSS_FIGHT_CONFIG.XP_VICTORY_BASE + battle.boss.maxHp * BOSS_FIGHT_CONFIG.XP_VICTORY_PER_BOSS_HP);

    await db.ref(`realm/boss_fights/${battleId}`).update({
        phase: 'victory',
        xpReward,
        rewards
    });
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `🏆 The ${battle.boss.name} has fallen!`
    });

    // Each client awards its OWN xp once (when it sees phase=victory). See
    // applyVictoryRewards below.
}

async function finalizeDefeat(battleId, battle) {
    await db.ref(`realm/boss_fights/${battleId}`).update({ phase: 'defeat' });
    await db.ref(`realm/boss_fights/${battleId}/log`).push({
        ts: Date.now(),
        msg: `☠️ The party fell to the ${battle.boss.name}.`
    });
    // Each client applies its OWN penalty when it observes phase=defeat.
}

// ---------------------------------------------------------------------------
// 11. REWARD ROLL
// ---------------------------------------------------------------------------
function pickRealWorldReward(bossTier) {
    if (!realWorldRewards.length) {
        return null;
    }

    // Filter by tier.
    const pool = realWorldRewards.filter(r => !r.bossTier || r.bossTier === 'any' || r.bossTier === bossTier);
    if (!pool.length) return null;

    // Weighted by rarity.
    const totalWeight = pool.reduce((sum, r) => sum + (REWARD_RARITY_WEIGHTS[r.rarity] || 1), 0);
    let roll = Math.random() * totalWeight;
    for (const r of pool) {
        roll -= (REWARD_RARITY_WEIGHTS[r.rarity] || 1);
        if (roll <= 0) return r;
    }
    return pool[0];
}

// ---------------------------------------------------------------------------
// 12. THE ACTUAL UI: drawBossRoom
// ---------------------------------------------------------------------------
function drawBossRoom(battle) {
    const panel = document.getElementById('encounter-panel');
    if (!panel) return;
    const data = getSaveData();
    const myName = data.hero_name;

    // Apply victory/defeat side-effects ONCE per client.
    if (battle.phase === 'victory') return drawVictoryScreen(battle);
    if (battle.phase === 'defeat')  return drawDefeatScreen(battle);

    const me     = battle.players[myName];
    const others = Object.keys(battle.players).filter(n => n !== myName);
    const ally   = others.length ? battle.players[others[0]] : null;

    const bossHpPct = Math.max(0, Math.min(100, (battle.boss.hp / battle.boss.maxHp) * 100));

    // Choose body content based on phase.
    let phaseBody = '';
    if (battle.phase === 'rallying') {
        phaseBody = renderRallyingBody(battle, me, ally);
    } else if (battle.phase === 'attacking') {
        phaseBody = renderAttackingBody(battle, me, ally);
    } else if (battle.phase === 'boss_turn') {
        phaseBody = renderBossTurnBody(battle, me, ally);
    }

    panel.innerHTML = `
        <div class="boss-battle-room">
            <div class="boss-battle-header">
                <div class="boss-battle-title">${battle.boss.name}</div>
                <div class="boss-battle-round">Round ${battle.roundNumber}</div>
            </div>

            <div class="boss-stage">
                ${renderPlayerCard(me,    /*self*/ true)}

                <div class="boss-vs-block">
                    <div class="boss-portrait-wrap" style="filter: drop-shadow(0 0 30px rgba(239,68,68,0.6));">
                        <img src="${battle.boss.img}" alt="${battle.boss.name}" />
                    </div>
                    <div class="boss-hp-row">
                        <span>HP ${battle.boss.hp} / ${battle.boss.maxHp}</span>
                    </div>
                    <div class="boss-hp-bg">
                        <div class="boss-hp-fill" style="width:${bossHpPct}%;"></div>
                    </div>
                    <div class="boss-stats-row">
                        <span>⚔ STR ${battle.boss.str}</span>
                        <span>🛡 DEF ${battle.boss.def}</span>
                    </div>
                </div>

                ${ally ? renderPlayerCard(ally, /*self*/ false) : renderPlayerCardPlaceholder()}
            </div>

            <div class="boss-phase-body">
                ${phaseBody}
            </div>

            ${renderBattleLog(battle.log)}
        </div>
    `;
    panel.classList.add('active');
}

function renderPlayerCard(p, isSelf) {
    if (!p || !p.joined) return renderPlayerCardPlaceholder();
    const hpPct = Math.max(0, Math.min(100, (p.currentHp / Math.max(1, p.maxHp)) * 100));
    const enPct = p.maxBossEnergy ? Math.max(0, Math.min(100, (p.bossEnergy / p.maxBossEnergy) * 100)) : 0;
    const portrait = getHeroImage(p.heroClass);
    const spiritOverlay = p.spirit
        ? `<div class="spirit-overlay">👻<br><span style="font-size:0.6rem; letter-spacing:2px;">SPIRIT</span></div>`
        : '';
    return `
        <div class="boss-combatant-card ${p.spirit ? 'is-spirit' : ''} ${isSelf ? 'is-self' : 'is-ally'}">
            <div class="boss-combatant-name">${p.heroName}${isSelf ? ' (you)' : ''}</div>
            <div class="boss-combatant-portrait">
                <img src="${portrait}" alt="${p.heroName}" onerror="this.style.display='none'" />
                ${spiritOverlay}
            </div>
            <div class="boss-combatant-bar-row">
                <span>HP</span><span>${p.currentHp} / ${p.maxHp}</span>
            </div>
            <div class="boss-combatant-bar-bg">
                <div class="boss-combatant-bar-fill hp" style="width:${hpPct}%;"></div>
            </div>
            <div class="boss-combatant-bar-row">
                <span>ENERGY</span><span>${p.bossEnergy ?? 0} / ${p.maxBossEnergy ?? 0}</span>
            </div>
            <div class="boss-combatant-bar-bg">
                <div class="boss-combatant-bar-fill en" style="width:${enPct}%;"></div>
            </div>
            <div class="boss-combatant-stats">
                <span>⚔ ${p.str ?? 0}</span>
                <span>🛡 ${p.def ?? 0}</span>
            </div>
        </div>
    `;
}
function renderPlayerCardPlaceholder() {
    return `
        <div class="boss-combatant-card boss-combatant-empty">
            <div class="boss-combatant-name" style="color:var(--text-dim);">Awaiting ally...</div>
            <div class="boss-combatant-portrait" style="opacity:0.3;">
                <div style="font-size:3rem;">❓</div>
            </div>
            <div style="color:var(--text-dim); font-size:0.8rem; text-align:center; margin-top:10px;">
                The call has been sent. They will join when they answer.
            </div>
        </div>
    `;
}

function renderRallyingBody(battle, me, ally) {
    const remaining = Math.max(0, (battle.preparationEndsAt || 0) - Date.now());
    return `
        <div class="boss-phase-banner" style="background: linear-gradient(90deg, rgba(252,211,77,0.15), transparent);">
            <strong style="color:#fcd34d;">PHASE: PREPARATION</strong>
            <span style="color:var(--text-dim);">— ${formatCountdown(remaining)} until the battle begins.</span>
        </div>
        <p style="color:var(--text-dim); margin: 12px 16px; line-height:1.6;">
            Spend your remaining energy out in the world. Equip your best gear from the
            <a href="#" onclick="(()=>{document.querySelector('.nav-item[data-tab=character]')?.click(); return false;})()" style="color:var(--accent-color);">Character</a> tab.
            <em>Your in-fight energy and stats will be locked in when the battle begins at 2 AM CST.</em>
        </p>
        <div class="boss-action-row">
            <button class="submit-btn" style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                    onclick="bossFight_minimize()">
                Step Out (you can return)
            </button>
        </div>
    `;
}

function renderAttackingBody(battle, me, ally) {
    if (!me || !me.joined) {
        return `<p style="color:var(--text-dim); text-align:center; padding:30px;">Waiting for you to join the fight...</p>`;
    }
    const youDone   = me.endedTurn || me.bossEnergy <= 0;
    const allyDone  = !ally || !ally.joined ? false : (ally.endedTurn || ally.bossEnergy <= 0);
    const canAttack = !youDone;

    const youWaiting = youDone && ally && ally.joined && !allyDone;

    return `
        <div class="boss-phase-banner" style="background: linear-gradient(90deg, rgba(239,68,68,0.18), transparent);">
            <strong style="color:#ef4444;">PHASE: STRIKE</strong>
            <span style="color:var(--text-dim);">— spend your energy. The boss strikes back at dawn (2 AM CST).</span>
        </div>

        <div class="boss-action-row">
            <button class="submit-btn boss-attack-btn"
                    ${canAttack ? '' : 'disabled'}
                    onclick="bossFight_attack()">
                ⚔ Attack (1 energy)
            </button>
            <button class="submit-btn"
                    style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                    ${canAttack ? '' : 'disabled'}
                    onclick="bossFight_endTurn()">
                ⏳ End My Turn
            </button>
            <button class="submit-btn"
                    style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                    onclick="bossFight_minimize()">
                Step Out
            </button>
        </div>

        ${youWaiting ? `
            <p style="color:#fcd34d; text-align:center; margin-top:14px;">
                You've finished your turn. Waiting for ${ally.heroName}...
            </p>` : ''}
    `;
}

function renderBossTurnBody(battle, me, ally) {
    const remaining = Math.max(0, (battle.bossTurnAt || 0) - Date.now());
    return `
        <div class="boss-phase-banner" style="background: linear-gradient(90deg, rgba(99,102,241,0.18), transparent);">
            <strong style="color:#6366f1;">PHASE: THE BOSS RESTS... AND WAKES</strong>
            <span style="color:var(--text-dim);">— retaliation in ${formatCountdown(remaining)}.</span>
        </div>
        <p style="color:var(--text-dim); margin: 12px 16px; line-height:1.6;">
            Both heroes have spent their energy. At 2 AM CST the ${battle.boss.name} will strike each living
            party member. Spirits are immune; their share of the damage falls on the living.
        </p>
        <div class="boss-action-row">
            <button class="submit-btn"
                    style="background:transparent; border:1px solid var(--border-color); color:var(--text-dim);"
                    onclick="bossFight_minimize()">
                Step Out
            </button>
        </div>
    `;
}

function renderBattleLog(log) {
    if (!log) return '';
    const entries = Object.values(log).slice(-8).reverse();
    return `
        <div class="boss-log">
            <div class="boss-log-title">Battle Log</div>
            ${entries.map(e => `<div class="boss-log-entry">${e.msg}</div>`).join('')}
        </div>
    `;
}

function formatCountdown(ms) {
    if (ms <= 0) return 'momentarily';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

// ---------------------------------------------------------------------------
// 13. VICTORY / DEFEAT SCREENS (per-client)
// ---------------------------------------------------------------------------
// Map: boss key -> quest-crystal id awarded on victory (mirrors legacy single-
// player win_fight handler in game.js). Add new pairs here when new bosses
// drop quest items.
const BOSS_CRYSTAL_DROPS = {
    'boss_squirrel':       'crystal_courage',
    'boss_doom_scroller':  'crystal_vitality'
};

function awardBossQuestCrystal(bossKey) {
    const crystalId = BOSS_CRYSTAL_DROPS[bossKey];
    if (!crystalId) return;
    if (typeof questItems === 'undefined' || !questItems[crystalId]) return;

    const data = getSaveData();
    if (!data.quest_items) data.quest_items = [];
    if (data.quest_items.includes(crystalId)) return;

    data.quest_items.push(crystalId);
    updateSaveData(data);
    updateAdventureHUD();
    updateStatusLog(`✨ You found the ${questItems[crystalId].name}!`);

    if (typeof checkQuestCompletion === 'function') {
        checkQuestCompletion(data);
    }
}

let _victoryApplied = {};
function drawVictoryScreen(battle) {
    const panel = document.getElementById('encounter-panel');
    if (!panel) return;
    const data = getSaveData();
    const myName = data.hero_name;
    const myReward = battle.rewards && battle.rewards[myName];
    const xp = battle.xpReward || BOSS_FIGHT_CONFIG.XP_VICTORY_BASE;

    // Award XP once per client (and only once per battle).
    if (!_victoryApplied[_bossRoomBattleId]) {
        _victoryApplied[_bossRoomBattleId] = true;
        const leveled = awardXP(xp);
        updateStatusLog(`🏆 You defeated ${battle.boss.name}! +${xp} XP`);
        if (leveled) updateStatusLog('⬆️ LEVEL UP!');

        // Award quest crystals tied to specific bosses (mirrors the legacy
        // single-player flow in resolveEncounter for boss_squirrel / boss_doom_scroller).
        awardBossQuestCrystal(battle.bossKey);

        // Clear local pointer.
        const ld = getSaveData();
        ld.active_boss_battle = null;
        if (!ld.completed_boss_battles) ld.completed_boss_battles = [];
        ld.completed_boss_battles.push({
            battleId: _bossRoomBattleId,
            bossKey:  battle.bossKey,
            wonAt:    Date.now(),
            reward:   myReward || null
        });
        updateSaveData(ld);
    }

    panel.innerHTML = `
        <div class="encounter-card boss-victory-card">
            <style>
                @keyframes boss-victory-glow {
                    0%   { transform: scale(0.5); opacity: 0; filter: brightness(2); }
                    60%  { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); filter: brightness(1); }
                }
            </style>
            <div style="font-size:5rem; animation: boss-victory-glow 1s ease-out forwards;">🏆</div>
            <h2 style="color:#fcd34d; letter-spacing:3px; margin-top:14px; text-transform:uppercase;">VICTORY</h2>
            <p style="color:var(--text-dim); max-width:480px; margin:14px auto; line-height:1.7;">
                The ${battle.boss.name} has fallen. The realm is brighter for what you did here.
                <br><br>
                <strong style="color:#10b981;">+${xp} XP earned.</strong>
            </p>

            ${myReward
                ? `<div class="boss-reward-card" style="border-color:#fcd34d; box-shadow: 0 0 20px rgba(252,211,77,0.4);">
                       <div style="font-size:3rem; line-height:1;">${myReward.icon || '🎁'}</div>
                       <div style="color:#fcd34d; font-size:1.1rem; letter-spacing:2px; text-transform:uppercase; margin-top:8px;">
                           Real-World Reward
                       </div>
                       <div style="color:#fff; font-size:1.3rem; margin-top:6px; font-weight:bold;">${myReward.name}</div>
                       <div style="color:var(--text-dim); margin-top:6px; font-style:italic;">${myReward.description || ''}</div>
                   </div>`
                : `<div class="boss-reward-card" style="opacity:0.7;">
                       <div style="color:var(--text-dim); padding:20px;">
                           No real-world rewards have been added yet. Edit
                           <code>realWorldRewards</code> in <code>boss-fight.js</code>
                           to populate the prize pool.
                       </div>
                   </div>`
            }

            <button class="submit-btn" style="margin-top:20px; background:#fcd34d; border-color:#fcd34d; color:#000;"
                    onclick="bossFight_dismissResult()">
                Continue
            </button>
        </div>
    `;
    panel.classList.add('active');
}

let _defeatApplied = {};
function drawDefeatScreen(battle) {
    const panel = document.getElementById('encounter-panel');
    if (!panel) return;

    if (!_defeatApplied[_bossRoomBattleId]) {
        _defeatApplied[_bossRoomBattleId] = true;
        // Halve XP, restore some HP, clear pointer.
        const data = getSaveData();
        if (data.stats) {
            data.stats.xp = Math.floor(data.stats.xp / 2);
            data.stats.current_hp = 50 + (getTotalStat(data, 'vit') * 10);
        }
        data.active_boss_battle = null;
        updateSaveData(data);
        updateStatusLog(`☠️ Defeated by ${battle.boss.name}. Lost half your XP.`);
    }

    panel.innerHTML = `
        <div class="encounter-card boss-defeat-card">
            <div style="font-size:5rem;">☠️</div>
            <h2 style="color:#ef4444; letter-spacing:3px; margin-top:14px; text-transform:uppercase;">DEFEAT</h2>
            <p style="color:var(--text-dim); max-width:480px; margin:14px auto; line-height:1.7;">
                The ${battle.boss.name} has overwhelmed you. You wake at the edge of the realm,
                shaken and lighter — half your unspent XP is gone.
                <br><br>
                <em style="color:#fcd34d;">It will be back. So will you. Stronger.</em>
            </p>
            <button class="submit-btn" style="margin-top:14px; background:transparent; border:1px solid #ef4444; color:#ef4444;"
                    onclick="bossFight_dismissResult()">
                Rise Again
            </button>
        </div>
    `;
    panel.classList.add('active');
}

window.bossFight_dismissResult = function () {
    const battleId = _bossRoomBattleId;
    closeBossRoom();
    // Optionally tear down the room from Firebase after a short delay so both
    // clients get a chance to see the screen.  We leave it; both clients clear
    // their local pointer above.
    if (battleId) {
        // Clean up after 60s so battle history doesn't pile up forever.
        setTimeout(() => {
            db.ref(`realm/boss_fights/${battleId}`).remove().catch(() => {});
        }, 60000);
    }
};

window.bossFight_minimize = function () {
    closeBossRoom();
};

window.bossFight_resume = function () {
    const data = getSaveData();
    if (data.active_boss_battle) {
        renderBossBattleRoom(data.active_boss_battle);
    }
};

// ---------------------------------------------------------------------------
// 14. BOOTSTRAP: listeners that run after init
// ---------------------------------------------------------------------------
window.setupBossFightListeners = function () {
    const data = getSaveData();
    if (!data.hero_name) return;

    // (a) Listen for incoming alerts.
    db.ref(`heroes/${data.hero_name.toLowerCase()}/boss_alerts`).on('value', snap => {
        const alerts = snap.val();
        if (!alerts || inEncounter) return;
        const firstKey = Object.keys(alerts)[0];
        handleIncomingBossAlert(firstKey, alerts[firstKey]);
    });

    // (b) If we have an active battle pointer, resume it. We do this on a small
    //     delay so the encounter panel (if any) settles first.
    setTimeout(() => {
        const fresh = getSaveData();
        if (fresh.active_boss_battle && !inEncounter) {
            renderBossBattleRoom(fresh.active_boss_battle);
        }
    }, 1500);

    // (c) Tick every 30 seconds so countdowns refresh and phases auto-advance
    //     even if Firebase doesn't emit a new event.
    setInterval(() => {
        if (_bossRoomBattleId) {
            db.ref(`realm/boss_fights/${_bossRoomBattleId}`).once('value').then(s => {
                const battle = s.val();
                if (battle) {
                    maybeAutoAdvancePhase(_bossRoomBattleId, battle);
                    drawBossRoom(battle);
                }
            });
        }
    }, 30000);
};

// A tiny helper for the Adventure HUD: if there's an active boss fight, give the
// player a way back into the room.
window.getActiveBossBattlePointer = function () {
    return getSaveData().active_boss_battle || null;
};
