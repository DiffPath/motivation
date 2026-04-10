// --- Game State & Local Storage ---

const DEFAULT_STATE = {
    level: 1,
    currentXP: 0,
    totalXP: 0, 
    xpRequiredForNextLevel: 100,
    startDate: null,       
    lastLogDate: null,     
    todayXP: 0,            
    pendingXP: 0,
    energy: 100,           // CHANGED: Start with 100 energy
    pendingEnergy: 0,      
    history: [],
    theme: 'fantasy',
    characterName: null,
    characterType: null,
    unallocatedStatPoints: 0,
    attributes: { str: 0, def: 0, wis: 0, vit: 0, end: 0 },
    friends: []
};

let playerState = JSON.parse(localStorage.getItem('lifeQuestState')) || { ...DEFAULT_STATE };

// Fallbacks
if (!playerState.theme) playerState.theme = 'tetris';
if (playerState.unallocatedStatPoints === undefined) playerState.unallocatedStatPoints = 0; 
if (playerState.pendingXP === undefined) playerState.pendingXP = 0; 
if (!playerState.friends) playerState.friends = []; 
if (playerState.energy === undefined) playerState.energy = 100;             // CHANGED: Fallback to 100
if (playerState.pendingEnergy === undefined) playerState.pendingEnergy = 0; 

// --- NEW: Max Energy Formula ---
// Base 100 Energy + 15 Energy per point of Endurance
function getPlayerMaxEnergy() {
    return 100 + ((playerState.attributes?.end || 0) * 15);
}

// Vitality determines Maximum HP
function getPlayerMaxHP() {
    // Base 50 HP + (10 HP per point of Vitality)
    return 50 + ((playerState.attributes?.vit || 0) * 10);
}

if (playerState.currentHP === undefined) {
    playerState.currentHP = getPlayerMaxHP();
}

function saveData() {
    localStorage.setItem('lifeQuestState', JSON.stringify(playerState));
    
    // Sync to Cloud if a character name exists
    if (playerState.characterName) {
        database.ref('players/' + playerState.characterName).set(playerState);
    }
}

// --- Firebase Configuration ---

const firebaseConfig = {
    apiKey: "AIzaSyBHWbaqMHNIIdSzFCDkthNZc3NZHMPkVgo", // Replace with your actual key if different
    authDomain: "motivation-game-26ee1.firebaseapp.com",
    projectId: "motivation-game-26ee1",
    storageBucket: "motivation-game-26ee1.firebasestorage.app",
    messagingSenderId: "404620697586",
    appId: "1:404620697586:web:8c9e3008294166d910d56b",
    databaseURL: "https://motivation-game-26ee1-default-rtdb.firebaseio.com/" 
};

// Initialize Firebase using the Compat scripts already in your HTML
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

function trackFriend() {
    const friendName = document.getElementById('friend-search').value.trim();
    if (!friendName) return;

    // "On Value" means this fires every time the friend's data changes in the cloud
    database.ref('players/' + friendName).on('value', (snapshot) => {
        const friendData = snapshot.val();
        const displayArea = document.getElementById('friend-data-area');
        
        if (friendData) {
            displayArea.innerHTML = `
                <div style="text-align: center;">
                    <img src="${friendData.attributes.images.stage1}" style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--t-cyan);">
                    <h3 style="margin: 10px 0;">${friendData.characterName} (Lvl ${friendData.level})</h3>
                    <p style="color: var(--t-green);">Status: Online & Training</p>
                    <div style="font-family: monospace; font-size: 0.8rem; text-align: left;">
                        STR: ${friendData.attributes.str} | DEF: ${friendData.attributes.def}
                    </div>
                </div>
            `;
        } else {
            displayArea.innerHTML = `<p style="color: var(--t-red);">Player not found.</p>`;
        }
    });
}

// --- Character Class Database ---

// Note: 10 stages of evolution per class! Replace URLs with your generated images.
const CLASS_DATABASE = {
    "Black Cat":  { 
        str: 3, def: 4, wis: 8, vit: 4, end: 6,
        images: {
            stage1: "https://i.imgur.com/rdnhWr1.png",
            stage2: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+2%5Cnjuvenile",
            stage3: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+3%5Cnadult",
            stage4: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+4%5Cnarcane",
            stage5: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+5%5Cnferal",
            stage6: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+6%5Cnsentinel",
            stage7: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+7%5Cnbattle",
            stage8: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+8%5Cnobsidian",
            stage9: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+9%5Cnwarlord",
            stage10: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+10+%5CnEPIC"
        }
    },
    "Rock Hyrax": { 
        str: 4, def: 8, wis: 5, vit: 6, end: 2,
        images: {
            stage1: "https://i.imgur.com/ypZAw8g.jpeg",
            stage2: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+2%5Cnscruffy",
            stage3: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+3%5Cnsurvivor",
            stage4: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+4%5Cncrystal",
            stage5: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+5%5Cnstoneback",
            stage6: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+6%5Cnboulder",
            stage7: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+7%5Cniron-clad",
            stage8: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+8%5Cnquartz",
            stage9: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+9%5Cndiamond",
            stage10: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+10+%5CnEPIC"
        }
    },
    "Earthworm":  { 
        str: 1, def: 3, wis: 4, vit: 10, end: 7,
        images: {
            stage1: "https://i.imgur.com/bmY949E.jpeg",
            stage2: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+2%5Cngarden",
            stage3: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+3%5Cncrawler",
            stage4: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+4%5Cnglowing",
            stage5: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+5%5Cnburrower",
            stage6: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+6%5Cntremor",
            stage7: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+7%5Cnchitin",
            stage8: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+8%5Cnguardian",
            stage9: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+9%5Cndread-maw",
            stage10: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+10+%5CnEPIC"
        }
    },
    "Gray Wolf":  { 
        str: 7, def: 5, wis: 4, vit: 4, end: 5,
        images: {
            stage1: "https://i.imgur.com/PxLqjJS.jpeg",
            stage2: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+2%5Cnyearling",
            stage3: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+3%5Cnhunter",
            stage4: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+4%5Cnstalker",
            stage5: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+5%5Cndire+wolf",
            stage6: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+6%5Cnshadow",
            stage7: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+7%5Cniron-clad",
            stage8: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+8%5Cnarmored",
            stage9: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+9%5Cnvanguard",
            stage10: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+10+%5CnEPIC"
        }
    },
    "Frog":       { 
        str: 4, def: 3, wis: 5, vit: 5, end: 8,
        images: {
            stage1: "https://i.imgur.com/3VKwThi.jpeg",
            stage2: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+2%5Cnfroglet",
            stage3: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+3%5Cnpond+frog",
            stage4: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+4%5Cnmarsh",
            stage5: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+5%5Cngiant+toad",
            stage6: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+6%5Cnvenom",
            stage7: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+7%5Cngladiator",
            stage8: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+8%5Cniron-plated",
            stage9: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+9%5Cnwarlord",
            stage10: "https://placehold.co/200x200/1a2015/a3b18a?text=Lvl+10+%5CnEPIC"
        }
    }
};

function getEvolutionStage(level) {
    if (level < 5) return 'stage1';
    if (level < 10) return 'stage2';
    if (level < 15) return 'stage3';
    if (level < 20) return 'stage4';
    if (level < 25) return 'stage5';
    if (level < 30) return 'stage6';
    if (level < 35) return 'stage7';
    if (level < 40) return 'stage8';
    if (level < 45) return 'stage9';
    return 'stage10';
}

// --- Theme Logic ---

const chartThemes = {
    tetris: {
        font: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        textColor: '#888899', gridColor: '#2a2a35',
        dailyLine: '#00FFFF', dailyBg: 'rgba(0, 255, 255, 0.1)',
        cumLine: '#00FF00', cumBg: 'rgba(0, 255, 0, 0.1)', pointColor: '#FFFF00'
    },
    fantasy: {
        font: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        textColor: '#c084fc', gridColor: '#4c1d95',
        dailyLine: '#22d3ee', dailyBg: 'rgba(34, 211, 238, 0.1)',
        cumLine: '#4ade80', cumBg: 'rgba(74, 222, 128, 0.1)', pointColor: '#fde047'
    },
    bioluminescent: {
        font: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
        textColor: '#c084fc', gridColor: '#7b4fb6',
        dailyLine: '#38bdf8', dailyBg: 'rgba(56, 189, 248, 0.1)', // Intense blue path
        cumLine: '#fb7185', cumBg: 'rgba(251, 113, 133, 0.1)',   // Intense magenta trees
        pointColor: '#22d3ee' // Cyan points
    }
};

function changeTheme(themeName) {
    playerState.theme = themeName;
    saveData();
    applyTheme();
    updateChartTheme();
}

// --- Chart State ---
let dailyChartInstance = null;
let cumulativeChartInstance = null;

// --- Initial Setup Logic ---

function previewStats() {
    const selectedClass = document.getElementById('char-type').value;
    const stats = CLASS_DATABASE[selectedClass];
    const previewDiv = document.getElementById('stat-preview');
    
    // Update the image preview to always show the Baby (Stage 1)
    document.getElementById('setup-char-img').src = stats.images.stage1;
    
    // Using CSS Grid to perfectly align the text, numbers, and color bars
    previewDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: 90px 20px 1fr; row-gap: 5px; column-gap: 10px; align-items: center;">
            <strong style="text-align: right;">Strength:</strong> 
            <span>${stats.str}</span> 
            <span style="color: var(--t-red);">${'█'.repeat(stats.str)}</span>
            
            <strong style="text-align: right;">Defense:</strong> 
            <span>${stats.def}</span> 
            <span style="color: var(--t-blue);">${'█'.repeat(stats.def)}</span>
            
            <strong style="text-align: right;">Wisdom:</strong> 
            <span>${stats.wis}</span> 
            <span style="color: var(--t-purple);">${'█'.repeat(stats.wis)}</span>
            
            <strong style="text-align: right;">Vitality:</strong> 
            <span>${stats.vit}</span> 
            <span style="color: var(--t-green);">${'█'.repeat(stats.vit)}</span>
            
            <strong style="text-align: right;">Endurance:</strong> 
            <span>${stats.end}</span> 
            <span style="color: var(--t-yellow);">${'█'.repeat(stats.end)}</span>
        </div>
    `;
}

function checkSetupState() {
    if (playerState.characterName) {
        // Existing player logic...
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block'; 
        
        checkDailyReset();
        updateChartData();
        updateUI(); 
    } else {
        // New player logic...
        document.getElementById('setup-screen').style.display = 'block'; 
        document.getElementById('main-app').style.display = 'none';
        
        // NEW: Instantly draw the default "Black Cat" preview!
        if (typeof previewStats === "function") previewStats();
    }
}

function startAdventure() {
    const nameInput = document.getElementById('char-name').value.trim();
    const typeInput = document.getElementById('char-type').value;

    if (nameInput === "") {
        alert("Even a hero needs a name. Please enter one to continue!");
        return;
    }

    // Save the identity AND the specific attributes for that class
    playerState.characterName = nameInput;
    playerState.characterType = typeInput;
    playerState.attributes = CLASS_DATABASE[typeInput];
    
    // NEW: Calculate and fill HP and Energy immediately based on the new class stats!
    playerState.currentHP = 50 + ((playerState.attributes.vit || 0) * 10);
    playerState.energy = 100 + ((playerState.attributes.end || 0) * 15);
    
    saveData();
    checkSetupState();
    updateUI(); 
}

// --- Date & Time Logic ---

function getCSTDateString() {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date());
}

function calculateDayNumber(currentDateStr) {
    if (!playerState.startDate) {
        playerState.startDate = currentDateStr; 
        saveData(); 
    }
    const start = new Date(playerState.startDate);
    const current = new Date(currentDateStr);
    const diffDays = Math.round((current - start) / (1000 * 60 * 60 * 24));
    return diffDays + 1; 
}

function checkDailyReset() {
    const todayCST = getCSTDateString();
    document.getElementById('current-date-display').innerText = `Date: ${todayCST} (CST)`;

// IF IT IS A NEW DAY: Clear the boxes as usual
    if (playerState.lastLogDate !== null && playerState.lastLogDate !== todayCST) {
        
        // --- Process yesterday's pending XP and Energy ---
        if (playerState.pendingXP > 0 || playerState.pendingEnergy > 0) {
            playerState.currentXP += playerState.pendingXP;
            playerState.totalXP += playerState.pendingXP;
            playerState.pendingXP = 0; 
            
            // Cash in the Energy and apply the Cap!
            const maxEnergy = getPlayerMaxEnergy();
            playerState.energy += playerState.pendingEnergy;
            
            // If they exceed their max capacity, cap it
            if (playerState.energy > maxEnergy) {
                playerState.energy = maxEnergy;
            }
            playerState.pendingEnergy = 0;

            checkLevelUp(); 
        }
        // ... (keep the rest of your clear boxes / saveData code here)        document.getElementById('min-read').value = '';
        document.getElementById('min-chores').value = '';
        document.getElementById('min-relax').value = '';
        document.getElementById('min-exercise').value = '';
        playerState.todayXP = 0; 
        saveData(); 
    } 
    // IF IT IS THE SAME DAY: Reload the saved values into the boxes
    else if (playerState.lastLogDate === todayCST) {
        const todayRecord = playerState.history.find(h => h.date === todayCST);
        if (todayRecord && todayRecord.activities) {
            todayRecord.activities.forEach(act => {
                const input = document.getElementById(act.id);
                // Only fill the box if the ID matches and we saved a value
                if (input && act.minutes > 0) {
                    input.value = act.minutes;
                }
            });
        }
    }
}


// --- Core Functions ---

function submitActivities() {
    const todayCST = getCSTDateString();
    const isResubmission = (playerState.lastLogDate === todayCST);
    const currentDayNum = calculateDayNumber(todayCST);

    if (isResubmission) {
        const confirmed = confirm("You have already logged activities for today. Are you sure you want to resubmit? This will overwrite today's pending XP.");
        if (!confirmed) return; 
    }

    const activities = [
        { id: 'min-read', name: 'Read a Book', multiplier: 1 },
        { id: 'min-chores', name: 'Do Chores', multiplier: 1.5 },
        { id: 'min-relax', name: 'Relax', multiplier: 0.5 },
        { id: 'min-exercise', name: 'Exercise', multiplier: 2 }
    ];

let newXPEarnedToday = 0;
    let newEnergyEarnedToday = 0; // NEW: Track total minutes
    let loggedAny = false;
    let dailyActivitiesArray = []; 

activities.forEach(activity => {
        const inputElement = document.getElementById(activity.id);
        const minutes = parseInt(inputElement.value) || 0;

        if (minutes > 0) {
            const xpEarned = Math.round(minutes * activity.multiplier);
            newXPEarnedToday += xpEarned;
            
            // CHANGED: Energy gain is now exactly equal to XP gain
            newEnergyEarnedToday += xpEarned; 
            
            dailyActivitiesArray.push({
                id: activity.id,
                name: activity.name,
                minutes: minutes,
                xp: xpEarned
            });
            
            loggedAny = true;
        }
    });

if (loggedAny || isResubmission) {
        // Set the new XP and Energy as PENDING
        playerState.pendingXP = newXPEarnedToday;
        playerState.pendingEnergy = newEnergyEarnedToday; // NEW
        playerState.todayXP = newXPEarnedToday;
        playerState.lastLogDate = todayCST;

        // Project the total XP just so the charts map correctly today
        const projectedTotalXP = playerState.totalXP + playerState.pendingXP;

        if (isResubmission) {
            let todayRecord = playerState.history.find(h => h.day === currentDayNum);
            if (todayRecord) {
                todayRecord.dailyXP = newXPEarnedToday;
                todayRecord.totalXP = projectedTotalXP;
                todayRecord.date = todayCST; 
                todayRecord.activities = dailyActivitiesArray; 
            }
        } else {
            playerState.history.push({
                day: currentDayNum,
                date: todayCST,
                dailyXP: newXPEarnedToday,
                totalXP: projectedTotalXP, 
                activities: dailyActivitiesArray 
            });
        }

        saveData();
        updateChartData(); 
        
        updateUI();
    }
}

function checkLevelUp() {
    if (playerState.currentXP >= playerState.xpRequiredForNextLevel) {
        playerState.currentXP = playerState.currentXP - playerState.xpRequiredForNextLevel;
        playerState.level++;
        playerState.xpRequiredForNextLevel = Math.floor(playerState.xpRequiredForNextLevel * 1.2);
        
        // NEW: Grant 3 stat points per level!
        playerState.unallocatedStatPoints += 3;
        
        saveData(); 
        showLevelUpMessage();
        checkLevelUp(); 
    }
}

// --- Text Adventure System ---

let advState = {
    inCombat: false,
    currentMonster: null
};

// A small database of enemies to fight
const MONSTERS = [
    { name: "Dust Slime", maxHp: 20, dmg: 3, xp: 10, color: "var(--t-cyan)" },
    { name: "Shadow Bat", maxHp: 35, dmg: 6, xp: 25, color: "var(--t-purple)" },
    { name: "Goblin Scavenger", maxHp: 50, dmg: 10, xp: 45, color: "var(--t-green)" },
    { name: "Forest Troll", maxHp: 100, dmg: 18, xp: 100, color: "var(--t-red)" }
];

// Vitality determines Maximum HP
function getPlayerMaxHP() {
    return 50 + ((playerState.attributes?.vit || 0) * 10);
}

// Utility to print text to the adventure screen
function advLog(message, color = 'var(--text-main)') {
    const logBox = document.getElementById('adventure-log');
    const entry = document.createElement('div');
    entry.style.color = color;
    entry.innerHTML = message;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight; // Auto-scroll to bottom
}

function updateAdvUI() {
    const maxHp = getPlayerMaxHP();
    const maxEnergy = getPlayerMaxEnergy(); // Get Max Energy
    
    if (playerState.currentHP === undefined) playerState.currentHP = maxHp;
    if (playerState.currentHP > maxHp) playerState.currentHP = maxHp; 
    
    // Safety check: if allocating an Endurance point lowered max below current somehow
    if (playerState.energy > maxEnergy) playerState.energy = maxEnergy;
    
    document.getElementById('adv-hp').innerText = playerState.currentHP;
    document.getElementById('adv-max-hp').innerText = maxHp;
    
    // Update Energy display
    document.getElementById('adv-energy').innerText = playerState.energy; 
    document.getElementById('adv-max-energy').innerText = maxEnergy;
    
    // Toggle the buttons based on whether we are fighting or exploring
    if (advState.inCombat && advState.currentMonster) {
        document.getElementById('adv-status').innerText = `Combat: ${advState.currentMonster.name}`;
        document.getElementById('adv-status').style.color = "var(--t-red)";
        document.getElementById('adv-explore-controls').style.display = 'none';
        document.getElementById('adv-combat-controls').style.display = 'flex';
    } else {
        document.getElementById('adv-status').innerText = "Status: Exploring";
        document.getElementById('adv-status').style.color = "var(--text-muted)";
        document.getElementById('adv-explore-controls').style.display = 'flex';
        document.getElementById('adv-combat-controls').style.display = 'none';
    }
}

function advExplore() {
    if (playerState.currentHP <= 0) {
        advLog("You are too exhausted to explore. Rest first!", "var(--t-red)");
        return;
    }

    // Check if they have 5 energy
    if (playerState.energy < 5) {
        advLog("Not enough energy (Costs 5). Log more real-world habits to earn more tomorrow!", "var(--t-yellow)");
        return;
    }

    // Deduct energy
    playerState.energy -= 5;

    const roll = Math.random();
    if (roll < 0.35) {
        // Find an item / Gain free XP
        const xpGain = Math.floor(Math.random() * 15) + 5;
        playerState.currentXP += xpGain;
        playerState.totalXP += xpGain;
        advLog(`🌟 You discovered a glowing rune! Gained ${xpGain} XP.`, "var(--t-yellow)");
        saveData();
        checkLevelUp();
        updateUI(); // Refreshes the main XP bar
    } else if (roll < 0.6) {
        // Flavor text
        advLog("You wander through the quiet landscape. Nothing stirs.", "var(--text-muted)");
    } else {
        // Combat encounter!
        const randomMonster = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
        advState.currentMonster = { ...randomMonster, hp: randomMonster.maxHp }; // Clone the monster stats
        advState.inCombat = true;
        advLog(`⚠️ A wild <strong style="color: ${advState.currentMonster.color};">${advState.currentMonster.name}</strong> appears!`, "var(--t-red)");
        updateAdvUI();
    }
}

function advAttack() {
    // Check if player has enough energy to swing their weapon
    if (playerState.energy < 2) {
        advLog("Not enough energy (Costs 2) to attack! Rest or return tomorrow.", "var(--t-yellow)");
        return;
    }
    
    // Deduct energy
    playerState.energy -= 2;

    // 1. Player deals damage based on STR
    const playerDmg = Math.max(1, (playerState.attributes.str * 2) + Math.floor(Math.random() * 4));
    advState.currentMonster.hp -= playerDmg;
    advLog(`⚔️ You strike the ${advState.currentMonster.name} for ${playerDmg} damage!`);

    // Check for victory
    if (advState.currentMonster.hp <= 0) {
        advLog(`🏆 You defeated the ${advState.currentMonster.name}! Gained ${advState.currentMonster.xp} XP.`, "var(--t-green)");
        playerState.currentXP += advState.currentMonster.xp;
        playerState.totalXP += advState.currentMonster.xp;
        advState.inCombat = false;
        advState.currentMonster = null;
        saveData();
        checkLevelUp();
        updateUI(); 
        updateAdvUI(); // Updates the energy and HP visual
        return;
    }

    // 2. Monster deals damage back (mitigated by player DEF)
    const monsterDmg = Math.max(1, advState.currentMonster.dmg - Math.floor(playerState.attributes.def / 2));
    playerState.currentHP -= monsterDmg;
    advLog(`🩸 The ${advState.currentMonster.name} hits you for ${monsterDmg} damage!`, "var(--t-red)");

    if (playerState.currentHP <= 0) {
        playerState.currentHP = 0;
        advLog("💀 You have been defeated... Rest to recover your strength.", "var(--t-red)");
        advState.inCombat = false;
        advState.currentMonster = null;
    }
    
    saveData();
    updateAdvUI(); // Refresh UI so energy subtraction shows immediately
}

function advFlee() {
    // Check if player has enough energy to run away
    if (playerState.energy < 1) {
        advLog("Not enough energy to run (Costs 1). You are cornered!", "var(--t-yellow)");
        return;
    }

    // Deduct energy
    playerState.energy -= 1;

    // Endurance stat increases your chance to run away safely
    const fleeChance = playerState.attributes.end * 10; 
    const roll = Math.random() * 100;
    
    if (roll < fleeChance + 20) { 
        advLog("💨 You successfully escaped!", "var(--text-muted)");
        advState.inCombat = false;
        advState.currentMonster = null;
    } else {
        advLog("❌ You failed to run away!", "var(--t-red)");
        const monsterDmg = Math.max(1, advState.currentMonster.dmg - Math.floor(playerState.attributes.def / 2));
        playerState.currentHP -= monsterDmg;
        advLog(`🩸 The ${advState.currentMonster.name} strikes you for ${monsterDmg} damage as you try to turn back!`, "var(--t-red)");
        
        if (playerState.currentHP <= 0) {
            playerState.currentHP = 0;
            advLog("💀 You have been defeated... Rest to recover your strength.", "var(--t-red)");
            advState.inCombat = false;
            advState.currentMonster = null;
        }
    }
    saveData();
    updateAdvUI(); // Refresh UI
}

function advRest() {
    const maxHp = getPlayerMaxHP();
    if (playerState.currentHP >= maxHp) {
        advLog("You are already at full health.", "var(--text-muted)");
        return;
    }

    // Check if they have 10 energy to build a camp
    if (playerState.energy < 10) {
        advLog("Not enough energy (Costs 10) to set up camp. Log more real-world habits!", "var(--t-yellow)");
        return;
    }

    // Deduct energy and heal
    playerState.energy -= 10;
    playerState.currentHP = maxHp;
    
    advLog("⛺ You rest by the fire and recover all your HP.", "var(--t-blue)");
    saveData();
    updateAdvUI();
}

// --- UI Update Functions ---

function updateUI() {
    document.getElementById('level-display').innerText = `Level ${playerState.level}`;
    
    // Set Name
    if (playerState.characterName) {
        document.getElementById('header-player-name').innerText = playerState.characterName;
    }

    let xpString = `${playerState.currentXP} / ${playerState.xpRequiredForNextLevel} XP`;
    if (playerState.pendingXP > 0) xpString += ` (+${playerState.pendingXP} Pending)`;
    document.getElementById('xp-text').innerText = xpString;
    
    let xpPercentage = (playerState.currentXP / playerState.xpRequiredForNextLevel) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercentage}%`;
    
    if (playerState.characterType) {
        const currentStage = getEvolutionStage(playerState.level);
        const avatarUrl = CLASS_DATABASE[playerState.characterType].images[currentStage];
        document.getElementById('main-avatar-img').src = avatarUrl;
    }

    // NEW: Draw Mini Stats in Header
    const stats = playerState.attributes;
    if (stats) {
        document.getElementById('header-mini-stats').innerHTML = `
            <span style="color: var(--t-red);">STR:${stats.str}</span>
            <span style="color: var(--t-blue);">DEF:${stats.def}</span>
            <span style="color: var(--t-purple);">WIS:${stats.wis}</span>
            <span style="color: var(--t-green);">VIT:${stats.vit}</span>
            <span style="color: var(--t-yellow);">END:${stats.end}</span>
        `;
    }
    
    renderHistoryLog();
    if (typeof renderStatsTab === "function") renderStatsTab();
    if (typeof renderFriendsList === "function") renderFriendsList();
    
    // NEW: Calculate and draw records
    renderRecords(); 
    // Update the Adventure Tab if it exists
    if (typeof updateAdvUI === "function") updateAdvUI();
}

function renderHistoryLog() {
    const logList = document.getElementById('activity-log');
    logList.innerHTML = ''; 

    if (playerState.history.length === 0) {
        logList.innerHTML = '<li class="empty-log">Waiting for your first daily log...</li>';
        return;
    }

    for (let i = playerState.history.length - 1; i >= 0; i--) {
        const record = playerState.history[i];
        const li = document.createElement('li');
        li.className = 'history-day-card'; 

        const displayDate = record.date ? record.date : '';

        let htmlContent = `
            <div class="day-header">
                <span><strong>Day ${record.day}</strong> <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 5px;">${displayDate}</span></span>
                <span class="day-total-xp">+${record.dailyXP} XP</span>
            </div>
        `;

        if (record.activities && record.activities.length > 0) {
            htmlContent += `<ul class="granular-list">`;
            record.activities.forEach(act => {
                htmlContent += `
                    <li>
                        <span class="act-name">${act.name} <span class="act-mins">(${act.minutes}m)</span></span>
                        <span class="act-xp">+${act.xp} XP</span>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }

        li.innerHTML = htmlContent;
        logList.appendChild(li);
    }
}

function showLevelUpMessage() {
    const msgElement = document.getElementById('level-up-message');
    msgElement.classList.remove('hidden');
    setTimeout(() => msgElement.classList.add('hidden'), 3000);
}

// --- Stat Allocation Logic ---

// Temporary storage for points allocated during the current session
let pendingStats = { str: 0, def: 0, wis: 0, vit: 0, end: 0 };

function renderStatsTab() {
    const stats = playerState.attributes;
    if (!stats || !document.getElementById('stats-allocation-container')) return;

    // Update the counter at the top
    document.getElementById('unallocated-points-display').innerText = playerState.unallocatedStatPoints;

    const statConfig = [
        { key: 'str', label: 'STR', color: 'var(--t-red)' },
        { key: 'def', label: 'DEF', color: 'var(--t-blue)' },
        { key: 'wis', label: 'WIS', color: 'var(--t-purple)' },
        { key: 'vit', label: 'VIT', color: 'var(--t-green)' },
        { key: 'end', label: 'END', color: 'var(--t-yellow)' }
    ];

    const canAllocate = playerState.unallocatedStatPoints > 0;
    let hasPending = false; // Check if we need to show the Save button
    
    // Grid now has 5 columns to fit the new Minus button
    let html = `<div style="display: grid; grid-template-columns: 40px 30px 25px 25px 1fr; row-gap: 8px; column-gap: 5px; align-items: center;">`;

    statConfig.forEach(stat => {
        const baseVal = stats[stat.key];
        const pendingVal = pendingStats[stat.key];
        const totalVal = baseVal + pendingVal; // Visual total
        
        if (pendingVal > 0) hasPending = true;

        // Minus Button (Only shows if they've added pending points to this stat)
        const subBtn = pendingVal > 0 
            ? `<button onclick="allocatePoint('${stat.key}', -1)" style="padding: 1px 7px; background: ${stat.color}; border: none; border-radius: 3px; cursor: pointer; color: #000; font-weight: bold; box-shadow: inset -1px -1px 0px rgba(0,0,0,0.5);">-</button>` 
            : ``;

        // Plus Button (Only shows if they have points to spend)
        const addBtn = canAllocate 
            ? `<button onclick="allocatePoint('${stat.key}', 1)" style="padding: 1px 5px; background: ${stat.color}; border: none; border-radius: 3px; cursor: pointer; color: #000; font-weight: bold; box-shadow: inset -1px -1px 0px rgba(0,0,0,0.5);">+</button>` 
            : ``;
            
        html += `
            <strong style="text-align: right;">${stat.label}:</strong>
            <span style="text-align: right; color: var(--text-main); font-weight: bold;">${totalVal}</span>
            <div style="text-align: center;">${subBtn}</div>
            <div style="text-align: center;">${addBtn}</div>
            <span style="color: ${stat.color}; letter-spacing: -2px;">${'█'.repeat(totalVal)}</span>
        `;
    });

    html += `</div>`;

    // Only show the Save button if there are points to lock in
    if (hasPending) {
        html += `
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="saveAttributes()" class="submit-btn" style="padding: 10px; font-size: 1rem; width: auto; padding-left: 20px; padding-right: 20px;">
                    Lock In Attributes
                </button>
            </div>
        `;
    }

    document.getElementById('stats-allocation-container').innerHTML = html;
}

function allocatePoint(statKey, amount) {
    // Adding a point
    if (amount > 0 && playerState.unallocatedStatPoints > 0) {
        playerState.unallocatedStatPoints--;
        pendingStats[statKey]++;
    } 
    // Subtracting a point (only allowed if it's currently pending)
    else if (amount < 0 && pendingStats[statKey] > 0) {
        playerState.unallocatedStatPoints++;
        pendingStats[statKey]--;
    }
    
    // Only update UI, do NOT call saveData() yet!
    updateUI(); 
}

function saveAttributes() {
    // Commit all pending points permanently to the player's save
    for (const key in pendingStats) {
        playerState.attributes[key] += pendingStats[key];
        pendingStats[key] = 0; // Clear the pending pool
    }
    saveData();
    updateUI();
}

// --- Tab Logic ---

function switchTab(evt, tabId) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));

    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach(link => link.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}

function switchSubTab(evt, tabId) {
    // Hide all sub-tabs
    const contents = document.getElementsByClassName("sub-tab-content");
    for (let i = 0; i < contents.length; i++) {
        contents[i].style.display = "none";
    }
    // Remove active class from buttons
    const links = document.getElementsByClassName("sub-tab-link");
    for (let i = 0; i < links.length; i++) {
        links[i].classList.remove("active");
    }
    // Show current and set active
    document.getElementById(tabId).style.display = "block";
    evt.currentTarget.classList.add("active");
}

// --- Chart Logic ---

function initChart() {
    const activeTheme = chartThemes[playerState.theme];
    Chart.defaults.color = activeTheme.textColor;
    Chart.defaults.font.family = activeTheme.font;

    const xAxisConfig = {
        type: 'linear',
        title: { display: true, text: 'Day Number' },
        grid: { color: activeTheme.gridColor },
        min: 0, 
        ticks: { stepSize: 1, precision: 0 }
    };

    const dailyCtx = document.getElementById('dailyChart').getContext('2d');
    dailyChartInstance = new Chart(dailyCtx, {
        type: 'line', 
        data: { datasets: [{
            label: 'Daily XP',
            data: [], 
            borderColor: activeTheme.dailyLine, 
            backgroundColor: activeTheme.dailyBg, 
            borderWidth: 3,
            pointBackgroundColor: activeTheme.pointColor, 
            pointBorderColor: '#121213',
            pointBorderWidth: 2, pointRadius: 6,
            fill: true, tension: 0.2
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: xAxisConfig, y: { title: { display: true, text: 'XP Earned' }, grid: { color: activeTheme.gridColor }, beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });

    const cumulativeCtx = document.getElementById('cumulativeChart').getContext('2d');
    cumulativeChartInstance = new Chart(cumulativeCtx, {
        type: 'line',
        data: { datasets: [{
            label: 'Total Lifetime XP',
            data: [], 
            borderColor: activeTheme.cumLine, 
            backgroundColor: activeTheme.cumBg,
            borderWidth: 3,
            pointBackgroundColor: activeTheme.pointColor, 
            pointBorderColor: '#121213',
            pointBorderWidth: 2, pointRadius: 6,
            fill: true, tension: 0.2
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: xAxisConfig, y: { title: { display: true, text: 'Total XP' }, grid: { color: activeTheme.gridColor }, beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });

    updateChartData();
}

function updateChartTheme() {
    if (!dailyChartInstance || !cumulativeChartInstance) return;
    
    const activeTheme = chartThemes[playerState.theme];
    
    // Update global defaults
    Chart.defaults.color = activeTheme.textColor;
    Chart.defaults.font.family = activeTheme.font;

    // Update Daily Chart
    dailyChartInstance.options.scales.x.grid.color = activeTheme.gridColor;
    dailyChartInstance.options.scales.y.grid.color = activeTheme.gridColor;
    dailyChartInstance.data.datasets[0].borderColor = activeTheme.dailyLine;
    dailyChartInstance.data.datasets[0].backgroundColor = activeTheme.dailyBg;
    dailyChartInstance.data.datasets[0].pointBackgroundColor = activeTheme.pointColor;
    dailyChartInstance.update();

    // Update Cumulative Chart
    cumulativeChartInstance.options.scales.x.grid.color = activeTheme.gridColor;
    cumulativeChartInstance.options.scales.y.grid.color = activeTheme.gridColor;
    cumulativeChartInstance.data.datasets[0].borderColor = activeTheme.cumLine;
    cumulativeChartInstance.data.datasets[0].backgroundColor = activeTheme.cumBg;
    cumulativeChartInstance.data.datasets[0].pointBackgroundColor = activeTheme.pointColor;
    cumulativeChartInstance.update();
}

function updateChartData() {
    if (!dailyChartInstance || !cumulativeChartInstance) return;

    const dailyDataPoints = playerState.history.map(h => ({ x: h.day, y: h.dailyXP }));
    const cumulativeDataPoints = playerState.history.map(h => ({ x: h.day, y: h.totalXP }));

    dailyDataPoints.unshift({ x: 0, y: 0 });
    cumulativeDataPoints.unshift({ x: 0, y: 0 });

    dailyChartInstance.data.datasets[0].data = dailyDataPoints;
    dailyChartInstance.update();

    cumulativeChartInstance.data.datasets[0].data = cumulativeDataPoints;
    cumulativeChartInstance.update();
}

function applyTheme() {
    // 1. Clear out ANY existing theme classes to reset the slate
    document.body.classList.remove('theme-fantasy', 'theme-bioluminescent', 'theme-tetris');
    
    // 2. ALWAYS add the active theme class (even for Tetris)
    if (playerState.theme) {
        document.body.classList.add('theme-' + playerState.theme);
    }
    
    // 3. Sync the dropdown menus to match the theme
    syncDropdowns();
}

// --- Records Logic ---

function renderRecords() {
    let bestXpDay = null; // Store the entire daily record, not just the number
    let maxXP = 0;
    
    let maxReading = 0;
    let maxExercise = 0;
    let maxChores = 0;    // NEW
    let maxRelax = 0;     // NEW

    playerState.history.forEach(log => {
        // Track the absolute best XP day
        if (log.dailyXP > maxXP) {
            maxXP = log.dailyXP;
            bestXpDay = log; // Save the full object to extract details later
        }
        
        // Check for personal bests in specific activity categories
        if (log.activities) {
            log.activities.forEach(act => {
                if (act.id === 'min-read' && act.minutes > maxReading) maxReading = act.minutes;
                if (act.id === 'min-exercise' && act.minutes > maxExercise) maxExercise = act.minutes;
                if (act.id === 'min-chores' && act.minutes > maxChores) maxChores = act.minutes; 
                if (act.id === 'min-relax' && act.minutes > maxRelax) maxRelax = act.minutes;   
            });
        }
    });

    // 1. Draw the basic top-line numbers
    document.getElementById('record-max-xp').innerText = maxXP + ' XP';
    document.getElementById('record-max-read').innerText = maxReading + ' min';
    document.getElementById('record-max-exercise').innerText = maxExercise + ' min';
    document.getElementById('record-max-chores').innerText = maxChores + ' min';
    document.getElementById('record-max-relax').innerText = maxRelax + ' min';

    // 2. Draw the granular breakdown for the Best XP Day
    const detailsContainer = document.getElementById('record-max-xp-details');
    
    if (bestXpDay && bestXpDay.activities && bestXpDay.activities.length > 0) {
        // Start building the HTML with the date
        let detailsHtml = `<div style="margin-bottom: 5px;"><em>Achieved on: ${bestXpDay.date}</em></div>`;
        
        // Loop through everything they did that day
        bestXpDay.activities.forEach(act => {
            detailsHtml += `<div>• ${act.name}: ${act.minutes}m <span style="color: var(--t-green);">(${act.xp} XP)</span></div>`;
        });
        
        detailsContainer.innerHTML = detailsHtml;
        detailsContainer.style.display = 'block'; // Make it visible
    } else {
        // Hide it if they haven't logged anything yet
        detailsContainer.innerHTML = '';
        detailsContainer.style.display = 'none';
    }
}

// --- Multiplayer / Social Logic ---

function addFriend() {
    const friendNameInput = document.getElementById('friend-search');
    const friendName = friendNameInput.value.trim();
    
    if (!friendName) return;
    if (friendName === playerState.characterName) {
        alert("You cannot add yourself to your own party!");
        return;
    }
    if (playerState.friends.includes(friendName)) {
        alert("This hero is already in your party.");
        friendNameInput.value = '';
        return;
    }

    // Check Firebase to see if this player actually exists before adding them
    database.ref('players/' + friendName).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            playerState.friends.push(friendName);
            saveData();
            friendNameInput.value = '';
            renderFriendsList(); // Redraw the list
        } else {
            alert("Player not found in the realm. Check the spelling and try again.");
        }
    });
}

function removeFriend(friendName) {
    if(confirm(`Remove ${friendName} from your party?`)) {
        playerState.friends = playerState.friends.filter(name => name !== friendName);
        saveData();
        database.ref('players/' + friendName).off(); // Stop listening to their data
        renderFriendsList();
    }
}

// Keep track of active listeners so we don't multiply them
let activeFriendListeners = [];

function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;
    
    // Clear old HTML and turn off old listeners to prevent memory leaks
    container.innerHTML = '';
    activeFriendListeners.forEach(name => database.ref('players/' + name).off());
    activeFriendListeners = [];

    if (!playerState.friends || playerState.friends.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Your party is currently empty.</p>`;
        return;
    }

    // Loop through every friend and create a live-updating card
    playerState.friends.forEach(friendName => {
        const cardId = `friend-card-${friendName.replace(/\s+/g, '-')}`;
        
        // Draw a temporary loading card
        container.innerHTML += `
            <div id="${cardId}" style="background: var(--bg-dark); border: 2px solid var(--grid-line); padding: 15px; border-radius: 4px; display: flex; align-items: center; gap: 15px; position: relative;">
                <div style="flex-grow: 1; text-align: center; color: var(--text-muted);">Summoning ${friendName}...</div>
            </div>
        `;

        // Turn on the live Firebase listener for this specific friend
        activeFriendListeners.push(friendName);
        database.ref('players/' + friendName).on('value', (snapshot) => {
            const friendData = snapshot.val();
            const cardElement = document.getElementById(cardId);
            
            if (friendData && cardElement) {
                // Calculate their XP bar percentage
                const xpPercent = Math.min((friendData.currentXP / friendData.xpRequiredForNextLevel) * 100, 100);
                
                // Draw their actual stats
                cardElement.innerHTML = `
                    <img src="${friendData.attributes.images.stage1}" style="width: 50px; height: 50px; border-radius: 50%; border: 2px solid var(--t-cyan); object-fit: cover;">
                    <div style="flex-grow: 1;">
                        <h3 style="margin: 0 0 5px 0; color: var(--text-main); font-size: 1.1rem;">
                            ${friendData.characterName} <span style="font-size: 0.8rem; color: var(--t-yellow);">Level ${friendData.level}</span>
                        </h3>
                        <div style="width: 100%; background: #000; height: 6px; border-radius: 3px; margin-bottom: 5px; box-shadow: inset 1px 1px 2px rgba(0,0,0,0.8);">
                            <div style="width: ${xpPercent}%; background: var(--t-green); height: 100%; border-radius: 3px;"></div>
                        </div>
                        <div style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">
                            STR:${friendData.attributes.str} DEF:${friendData.attributes.def} WIS:${friendData.attributes.wis} VIT:${friendData.attributes.vit} END:${friendData.attributes.end}
                        </div>
                    </div>
                    <button onclick="removeFriend('${friendName}')" style="background: transparent; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; position: absolute; top: 5px; right: 10px;" title="Remove">&times;</button>
                `;
            }
        });
    });
}

// --- INITIALIZATION & SYNC ---

function syncDropdowns() {
    // Force the HTML dropdowns to match the saved player state
    const settingsSelect = document.getElementById('theme-select');
    if (settingsSelect) {
        settingsSelect.value = playerState.theme;
    }

    const setupSelect = document.getElementById('setup-theme-select');
    if (setupSelect) {
        setupSelect.value = playerState.theme;
    }
}

// 1. Apply the visual theme
applyTheme(); 

// 2. Sync the dropdown menus to match the theme
syncDropdowns(); 

// 3. Run normal game setup
checkSetupState(); 
checkDailyReset();
updateUI();

// 4. Draw the charts only after everything else is ready
window.onload = function() {
    if (document.getElementById('dailyChart')) {
        initChart();
    }
};
