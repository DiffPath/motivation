/* =============================================================================
   LOSTPEGS.JS  -  "The Lost Pegs" Pachinko Mini-Game
   -----------------------------------------------------------------------------
   Token Economy
   -------------
   The Mini-Games tab is unlocked one time when the Mysterious Wizard gifts the
   player the Warden's Key.  After that:

     - Players earn 1 Pachinko Token for every 10 XP they gain (instant —
       see grantPachinkoTokensFromXP() in app.js).
     - Each drop costs 1 token.

   The balance is read/written from the shared localStorage key "motivation_RPG"
   under the field "pachinko_tokens".  Fractional XP carries forward via
   "pachinko_xp_remainder" so no XP is ever wasted between gains.

   Public API (window.LostPegs):
     init()                - boot the game (auto-called on DOMContentLoaded)
     dropBall(x)           - drop a ball at canvas-x px (defaults to current aim)
     refreshTheme()        - re-read CSS variables (call after a theme switch)
     refreshTokenDisplay() - force-refresh the on-screen token counter
     getConfig()           - returns the live CONFIG object (mutate to retune)
     getSlots()            - returns the live SLOTS array
     getState()            - returns the live state object (read-only inspection)
     reset()               - wipe score/log/balls back to a fresh game
   ============================================================================= */

(function () {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    const CONFIG = {
        canvasWidth:  480,
        canvasHeight: 640,

        wallInset:    14,
        wallThickness: 4,
        topMargin:    70,
        bottomMargin: 80,

        pegRadius:       6,
        pegRows:         9,
        pegRowSpacing:   46,
        pegColSpacing:   48,
        pegStartY:       110,
        pegHitFlashMs:   180,

        ballRadius:    9,
        ballMaxCount:  6,

        gravity:           0.22,
        wallBounciness:    0.55,
        pegBounciness:     0.62,
        airDrag:           0.999,
        maxSpeed:          14,
        randomKick:        0.35,
        terminalSettle:    0.05,

        aimStep:           6,
        launcherY:         28,

        // 1 Pachinko Token is spent per drop.
        // Tokens accrue at 1 per 10 XP, granted instantly each time the player
        // earns XP — but only after the Warden's Key has been gifted by the
        // Mysterious Wizard.  See grantPachinkoTokensFromXP() in app.js.
        costPerDrop:           1,
        costCurrency:          'pachinko_tokens',
        integrateWithSaveData: true,

        showTrajectoryHint: true,
        showLog:            true,
        logMaxEntries:      8,
    };

    // =========================================================================
    // SLOTS
    // =========================================================================
    const SLOTS = [
        { label: '0',   color: '#475569', prize: { type: 'score', amount: 0   } },
        { label: '5',   color: '#64748b', prize: { type: 'score', amount: 5   } },
        { label: '20',  color: '#0891b2', prize: { type: 'score', amount: 20  } },
        { label: '100', color: '#fbbf24', prize: { type: 'score', amount: 100 } },
        { label: '20',  color: '#0891b2', prize: { type: 'score', amount: 20  } },
        { label: '5',   color: '#64748b', prize: { type: 'score', amount: 5   } },
        { label: '0',   color: '#475569', prize: { type: 'score', amount: 0   } },
    ];

    // =========================================================================
    // STATE
    // =========================================================================
    let canvas = null;
    let ctx = null;
    let rafId = null;

    const state = {
        balls:      [],
        pegs:       [],
        slots:      [],
        score:      0,
        bestScore:  0,
        dropsTotal: 0,
        aimX:       CONFIG.canvasWidth / 2,
        log:        [],
        theme:      null,
        booted:     false,
    };

    // =========================================================================
    // THEME
    // =========================================================================
    function readTheme() {
        const cs = getComputedStyle(document.documentElement);
        const get = (k, fallback) => (cs.getPropertyValue(k).trim() || fallback);
        return {
            bgPrimary:   get('--bg-primary',   '#0f172a'),
            bgSecondary: get('--bg-secondary', '#1e293b'),
            accent:      get('--accent-color', '#38bdf8'),
            textMain:    get('--text-main',    '#f1f5f9'),
            textDim:     get('--text-dim',     '#94a3b8'),
            border:      get('--border-color', '#334155'),
        };
    }

    function refreshTheme() { state.theme = readTheme(); }

    // =========================================================================
    // TOKEN HELPERS
    // =========================================================================

    /** Read the current pachinko_tokens balance from localStorage. */
    function getTokenBalance() {
        const data = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
        return Math.floor(data.pachinko_tokens || 0);
    }

    /**
     * Refresh every on-screen token counter element and update the drop button
     * state so players get clear feedback when they run out of tokens.
     */
    function refreshTokenDisplay() {
        const balance = getTokenBalance();

        const tokenEl = document.getElementById('lost-pegs-tokens');
        if (tokenEl) tokenEl.textContent = balance;

        const dropBtn = document.getElementById('lost-pegs-drop-btn');
        if (dropBtn) {
            dropBtn.disabled = balance < CONFIG.costPerDrop;
            dropBtn.title = balance < CONFIG.costPerDrop
                ? 'No tokens — earn one for every 10 XP you gain.'
                : `Drop (costs 1 token — you have ${balance})`;
        }

        // Notify any external sidebar or HUD panel
        if (typeof window.updateMinigamesSidebarPanel === 'function') {
            window.updateMinigamesSidebarPanel();
        }
    }

    // =========================================================================
    // PEG LAYOUT
    // =========================================================================
    function generatePegs() {
        const pegs = [];
        const innerLeft  = CONFIG.wallInset + CONFIG.wallThickness;
        const innerRight = CONFIG.canvasWidth - CONFIG.wallInset - CONFIG.wallThickness;
        const innerWidth = innerRight - innerLeft;

        for (let row = 0; row < CONFIG.pegRows; row++) {
            const y = CONFIG.pegStartY + row * CONFIG.pegRowSpacing;
            const offset = (row % 2 === 0) ? 0 : CONFIG.pegColSpacing / 2;
            const cols = Math.floor((innerWidth - offset * 2) / CONFIG.pegColSpacing);
            const startX = innerLeft + offset + (innerWidth - 2 * offset - cols * CONFIG.pegColSpacing) / 2;

            for (let col = 0; col <= cols; col++) {
                pegs.push({
                    x: startX + col * CONFIG.pegColSpacing,
                    y,
                    r: CONFIG.pegRadius,
                    type: 'normal',
                    flashUntil: 0,
                });
            }
        }
        return pegs;
    }

    // =========================================================================
    // SLOT LAYOUT
    // =========================================================================
    function buildSlotRects() {
        const innerLeft  = CONFIG.wallInset + CONFIG.wallThickness;
        const innerRight = CONFIG.canvasWidth - CONFIG.wallInset - CONFIG.wallThickness;
        const slotsTop   = CONFIG.canvasHeight - CONFIG.bottomMargin;
        const slotWidth  = (innerRight - innerLeft) / SLOTS.length;

        return SLOTS.map((s, i) => ({
            ...s,
            xStart: innerLeft + i * slotWidth,
            xEnd:   innerLeft + (i + 1) * slotWidth,
            yTop:   slotsTop,
            yBot:   CONFIG.canvasHeight,
            index:  i,
        }));
    }

    // =========================================================================
    // INPUT
    // =========================================================================
    function bindInput() {
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            state.aimX = clamp(x, innerMinX(), innerMaxX());
        });

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            dropBall(clamp(x, innerMinX(), innerMaxX()));
        });

        document.addEventListener('keydown', (e) => {
            if (!isCanvasVisible()) return;
            if (isTypingInForm(e.target)) return;

            if (e.key === 'ArrowLeft') {
                state.aimX = clamp(state.aimX - CONFIG.aimStep, innerMinX(), innerMaxX());
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                state.aimX = clamp(state.aimX + CONFIG.aimStep, innerMinX(), innerMaxX());
                e.preventDefault();
            } else if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
                dropBall(state.aimX);
                e.preventDefault();
            }
        });

        const dropBtn = document.getElementById('lost-pegs-drop-btn');
        if (dropBtn) dropBtn.addEventListener('click', () => dropBall(state.aimX));

        const resetBtn = document.getElementById('lost-pegs-reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => reset());
    }

    function innerMinX() { return CONFIG.wallInset + CONFIG.wallThickness + CONFIG.ballRadius + 2; }
    function innerMaxX() { return CONFIG.canvasWidth - CONFIG.wallInset - CONFIG.wallThickness - CONFIG.ballRadius - 2; }
    function isTypingInForm(el) {
        if (!el) return false;
        const tag = (el.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    }
    function isCanvasVisible() { return canvas && canvas.offsetParent !== null; }

    // =========================================================================
    // GAME LOGIC
    // =========================================================================
    function dropBall(x) {
        if (state.balls.length >= CONFIG.ballMaxCount) return false;

        x = clamp(x, innerMinX(), innerMaxX());

        if (CONFIG.costPerDrop > 0 && CONFIG.integrateWithSaveData) {
            if (!spendCurrency(CONFIG.costCurrency, CONFIG.costPerDrop)) {
                flashMessage('No tokens — earn 10 XP to gain another!');
                return false;
            }
        }

        state.balls.push({
            x,
            y: CONFIG.launcherY + 12,
            vx: (Math.random() - 0.5) * 0.8,
            vy: 0.5,
            r:  CONFIG.ballRadius,
            type: 'standard',
            settled: false,
        });
        state.dropsTotal++;
        return true;
    }

    function update() {
        for (let i = state.balls.length - 1; i >= 0; i--) {
            const b = state.balls[i];
            updateBall(b);

            if (b.y >= CONFIG.canvasHeight - CONFIG.bottomMargin + b.r) {
                const slot = state.slots.find(s => b.x >= s.xStart && b.x < s.xEnd);
                if (slot) onSlotHit(slot, b);
                state.balls.splice(i, 1);
            }
        }
    }

    function updateBall(b) {
        b.vy += CONFIG.gravity;
        b.vx *= CONFIG.airDrag;
        b.vy *= CONFIG.airDrag;

        const speed = Math.hypot(b.vx, b.vy);
        if (speed > CONFIG.maxSpeed) {
            b.vx = (b.vx / speed) * CONFIG.maxSpeed;
            b.vy = (b.vy / speed) * CONFIG.maxSpeed;
        }

        b.x += b.vx;
        b.y += b.vy;

        const leftWall  = CONFIG.wallInset + CONFIG.wallThickness + b.r;
        const rightWall = CONFIG.canvasWidth - CONFIG.wallInset - CONFIG.wallThickness - b.r;
        if (b.x < leftWall)  { b.x = leftWall;  b.vx = -b.vx * CONFIG.wallBounciness; }
        if (b.x > rightWall) { b.x = rightWall; b.vx = -b.vx * CONFIG.wallBounciness; }

        for (const peg of state.pegs) {
            const dx = b.x - peg.x;
            const dy = b.y - peg.y;
            const distSq = dx * dx + dy * dy;
            const minDist = b.r + peg.r;
            if (distSq < minDist * minDist && distSq > 0.0001) {
                handlePegCollision(b, peg, dx, dy, Math.sqrt(distSq), minDist);
            }
        }
    }

    function handlePegCollision(b, peg, dx, dy, dist, minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x += nx * (minDist - dist);
        b.y += ny * (minDist - dist);

        const dot = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * dot * nx) * CONFIG.pegBounciness;
        b.vy = (b.vy - 2 * dot * ny) * CONFIG.pegBounciness;
        b.vx += (Math.random() - 0.5) * CONFIG.randomKick;

        peg.flashUntil = performance.now() + CONFIG.pegHitFlashMs;
    }

    function onSlotHit(slot) {
        processPrize(slot.prize);
        addLogEntry(slot, slot.prize);
    }

    function processPrize(prize) {
        if (!prize) return;
        if (prize.type === 'score') {
            state.score += prize.amount || 0;
            if (state.score > state.bestScore) state.bestScore = state.score;
        }
        updateScoreDisplay();
    }

    // =========================================================================
    // CURRENCY HOOK
    // =========================================================================

    /**
     * Deduct `amount` of the given currency key from the shared save data.
     * Returns true on success, false if the player cannot afford it.
     */
    function spendCurrency(key, amount) {
        const data = JSON.parse(localStorage.getItem('motivation_RPG') || '{}');
        const current = Math.floor(data[key] || 0);
        if (current < amount) return false;

        data[key] = current - amount;
        localStorage.setItem('motivation_RPG', JSON.stringify(data));
        refreshTokenDisplay();
        return true;
    }

    // =========================================================================
    // RENDER
    // =========================================================================
    function render() {
        if (!ctx) return;
        const W = CONFIG.canvasWidth;
        const H = CONFIG.canvasHeight;
        const t = state.theme;

        ctx.clearRect(0, 0, W, H);

        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, t.bgSecondary);
        grad.addColorStop(1, t.bgPrimary);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        drawWalls();
        drawLauncher();
        drawSlots();
        drawPegs();
        drawBalls();
    }

    function drawWalls() {
        const t = state.theme;
        ctx.fillStyle = t.border;
        ctx.fillRect(CONFIG.wallInset, CONFIG.topMargin - 6,
                     CONFIG.wallThickness, CONFIG.canvasHeight - CONFIG.topMargin - CONFIG.bottomMargin + 6);
        ctx.fillRect(CONFIG.canvasWidth - CONFIG.wallInset - CONFIG.wallThickness, CONFIG.topMargin - 6,
                     CONFIG.wallThickness, CONFIG.canvasHeight - CONFIG.topMargin - CONFIG.bottomMargin + 6);
    }

    function drawLauncher() {
        const t = state.theme;
        const x = state.aimX;
        const y = CONFIG.launcherY;

        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(CONFIG.wallInset, 0, CONFIG.canvasWidth - 2 * CONFIG.wallInset, CONFIG.topMargin - 8);

        if (CONFIG.showTrajectoryHint) {
            ctx.save();
            ctx.strokeStyle = hexToRgba(t.accent, 0.18);
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(x, y + 14);
            ctx.lineTo(x, CONFIG.canvasHeight - CONFIG.bottomMargin);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = t.accent;
        ctx.shadowColor = t.accent;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(x - 9, y - 8);
        ctx.lineTo(x + 9, y - 8);
        ctx.lineTo(x,     y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = hexToRgba(t.textDim, 0.8);
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AIM', x, y - 14);
    }

    function drawPegs() {
        const t = state.theme;
        const now = performance.now();
        for (const peg of state.pegs) {
            const isFlashing = peg.flashUntil > now;
            ctx.save();
            if (isFlashing) {
                ctx.shadowColor = t.accent;
                ctx.shadowBlur = 12;
                ctx.fillStyle = t.accent;
            } else {
                ctx.fillStyle = t.textDim;
            }
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.beginPath();
            ctx.arc(peg.x - peg.r * 0.3, peg.y - peg.r * 0.3, peg.r * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawSlots() {
        const t = state.theme;
        for (const slot of state.slots) {
            const slotGrad = ctx.createLinearGradient(0, slot.yTop, 0, slot.yBot);
            slotGrad.addColorStop(0, hexToRgba(slot.color, 0.45));
            slotGrad.addColorStop(1, hexToRgba(slot.color, 0.85));
            ctx.fillStyle = slotGrad;
            ctx.fillRect(slot.xStart + 1, slot.yTop, (slot.xEnd - slot.xStart) - 2, slot.yBot - slot.yTop);

            ctx.fillStyle = t.border;
            ctx.fillRect(slot.xEnd - 1, slot.yTop - 8, 2, slot.yBot - slot.yTop + 8);

            ctx.fillStyle = t.textMain;
            ctx.font = 'bold 16px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(slot.label, (slot.xStart + slot.xEnd) / 2, (slot.yTop + slot.yBot) / 2);
        }
        ctx.fillStyle = t.border;
        ctx.fillRect(CONFIG.wallInset, state.slots[0].yTop - 1,
                     CONFIG.canvasWidth - 2 * CONFIG.wallInset, 1);
    }

    function drawBalls() {
        for (const b of state.balls) {
            ctx.save();
            ctx.shadowColor = '#fbbf24';
            ctx.shadowBlur = 8;
            const grad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, b.x, b.y, b.r);
            grad.addColorStop(0, '#fef3c7');
            grad.addColorStop(0.5, '#fbbf24');
            grad.addColorStop(1, '#b45309');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // =========================================================================
    // DOM UI
    // =========================================================================
    function updateScoreDisplay() {
        const scoreEl = document.getElementById('lost-pegs-score');
        const bestEl  = document.getElementById('lost-pegs-best');
        const dropsEl = document.getElementById('lost-pegs-drops');
        if (scoreEl) scoreEl.textContent = state.score;
        if (bestEl)  bestEl.textContent  = state.bestScore;
        if (dropsEl) dropsEl.textContent = state.dropsTotal;
    }

    function addLogEntry(slot, prize) {
        if (!CONFIG.showLog) return;
        const list = document.getElementById('lost-pegs-log-list');
        if (!list) return;

        let msg;
        switch (prize.type) {
            case 'score': msg = prize.amount > 0 ? `+${prize.amount}` : 'miss'; break;
            default:      msg = prize.type;
        }

        state.log.unshift({ slot: slot.label, color: slot.color, msg });
        if (state.log.length > CONFIG.logMaxEntries) state.log.length = CONFIG.logMaxEntries;

        list.innerHTML = state.log.map(entry => `
            <li class="lost-pegs-log-item">
                <span class="lost-pegs-log-pip" style="background:${entry.color}"></span>
                <span class="lost-pegs-log-slot">Slot ${entry.slot}</span>
                <span class="lost-pegs-log-msg">${entry.msg}</span>
            </li>
        `).join('');
    }

    function flashMessage(text) {
        const el = document.getElementById('lost-pegs-message');
        if (!el) return;
        el.textContent = text;
        el.classList.add('lost-pegs-message-show');
        clearTimeout(flashMessage._t);
        flashMessage._t = setTimeout(() => el.classList.remove('lost-pegs-message-show'), 1800);
    }

    // =========================================================================
    // ANIMATION LOOP
    // =========================================================================
    function loop() {
        if (isCanvasVisible()) { update(); render(); }
        rafId = requestAnimationFrame(loop);
    }

    // =========================================================================
    // MINIGAMES SUB-TAB NAVIGATION
    // =========================================================================
    function bindMinigamesTabNav() {
        const btns  = document.querySelectorAll('.minigames-tab-btn');
        const views = document.querySelectorAll('.minigames-sub-view');
        if (!btns.length) return;

        btns.forEach(btn => {
            btn.addEventListener('click', function () {
                btns.forEach(b => b.classList.remove('active'));
                views.forEach(v => v.classList.remove('active'));
                this.classList.add('active');
                const target = document.getElementById(this.getAttribute('data-target'));
                if (target) target.classList.add('active');
                refreshTokenDisplay(); // Always sync when the tab is opened
            });
        });
    }

    // =========================================================================
    // BOOT
    // =========================================================================
    function init() {
        if (state.booted) return;
        canvas = document.getElementById('lost-pegs-canvas');
        if (!canvas) return;

        canvas.width  = CONFIG.canvasWidth;
        canvas.height = CONFIG.canvasHeight;
        ctx = canvas.getContext('2d');

        refreshTheme();
        state.pegs  = generatePegs();
        state.slots = buildSlotRects();
        state.aimX  = CONFIG.canvasWidth / 2;

        bindInput();
        bindMinigamesTabNav();
        updateScoreDisplay();
        refreshTokenDisplay();  // Show current balance on boot

        const observer = new MutationObserver(() => refreshTheme());
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

        state.booted = true;
        loop();
    }

    function reset() {
        state.balls.length = 0;
        state.score = 0;
        state.dropsTotal = 0;
        state.log.length = 0;
        const list = document.getElementById('lost-pegs-log-list');
        if (list) list.innerHTML = '';
        updateScoreDisplay();
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    function hexToRgba(hex, alpha) {
        if (!hex) return `rgba(255,255,255,${alpha})`;
        hex = hex.trim();
        if (hex.startsWith('rgb')) {
            return hex.replace(/rgba?\(([^)]+)\)/, (_, parts) => {
                const ps = parts.split(',').map(s => s.trim());
                return `rgba(${ps[0]}, ${ps[1]}, ${ps[2]}, ${alpha})`;
            });
        }
        if (hex[0] === '#') hex = hex.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================
    window.LostPegs = {
        init,
        dropBall:            (x) => dropBall(x == null ? state.aimX : x),
        refreshTheme,
        refreshTokenDisplay,
        reset,
        getConfig:   () => CONFIG,
        getSlots:    () => SLOTS,
        getState:    () => state,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
