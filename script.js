// ─── Sound System ──────────────────────────────────────────────────────────
class SoundManager {
    constructor() { this.ctx = null; this.masterGain = null; }
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    playThwip() {
        if (!this.ctx) return; this.resume();
        const noise = this.ctx.createBufferSource(), gain = this.ctx.createGain();
        const bufferSize = this.ctx.sampleRate * 0.1, buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 1000;
        filter.frequency.exponentialRampToValueAtTime(8000, this.ctx.currentTime + 0.1);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0, this.ctx.currentTime); gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        noise.start(); noise.stop(this.ctx.currentTime + 0.15);
    }
    playGrab() {
        if (!this.ctx) return; this.resume();
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(this.masterGain); osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    }
    playCollect() {
        if (!this.ctx) return; this.resume();
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
            osc.frequency.value = f; osc.connect(gain); gain.connect(this.masterGain);
            gain.gain.setValueAtTime(0, now + i * 0.08); gain.gain.linearRampToValueAtTime(0.2, now + i * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);
            osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.3);
        });
    }
    playExplosion() {
        if (!this.ctx) return; this.resume();
        const noise = this.ctx.createBufferSource(), gain = this.ctx.createGain();
        const bufferSize = this.ctx.sampleRate * 0.5, buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate), data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1000;
        filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.4);
        noise.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        noise.start(); noise.stop(this.ctx.currentTime + 0.5);
    }
}

// ─── Web Physics Engine ───────────────────────────────────────────────────
class WebSimulation {
    constructor() {
        this.segments = [];
        this.numSegments = 16;
        this.gravity = 0.25;
        this.friction = 0.98;
    }

    reset(startX, startY) {
        this.segments = [];
        for (let i = 0; i < this.numSegments; i++) {
            this.segments.push({ x: startX, y: startY, ox: startX, oy: startY });
        }
    }

    update(origin, target = null, progress = 1) {
        if (this.segments.length === 0) return;

        // Pin origin
        this.segments[0].x = origin.x;
        this.segments[0].y = origin.y;

        // Verlet integration
        for (let i = 1; i < this.segments.length; i++) {
            const p = this.segments[i];
            const vx = (p.x - p.ox) * this.friction;
            const vy = (p.y - p.oy) * this.friction;
            p.ox = p.x; p.oy = p.y;
            p.x += vx; p.y += vy + this.gravity;
        }

        // Constraints
        const targetX = target ? target.x : origin.x;
        const targetY = target ? target.y : origin.y;
        const segLen = Math.hypot(targetX - origin.x, targetY - origin.y) / this.numSegments * progress;

        for (let r = 0; r < 5; r++) { // Iterations
            for (let i = 0; i < this.segments.length - 1; i++) {
                const p1 = this.segments[i], p2 = this.segments[i+1];
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy);
                const diff = (segLen - dist) / dist * 0.5;
                const ox = dx * diff, oy = dy * diff;
                if (i > 0) { p1.x -= ox; p1.y -= oy; }
                p2.x += ox; p2.y += oy;
                
                // Add "shot curve" - segments in the middle sag more when traveling
                if (progress < 1 && i > 0) {
                    const midFactor = Math.sin((i / this.segments.length) * Math.PI);
                    p2.y += midFactor * 2 * (1 - progress); 
                }
            }

            if (target && progress >= 1) {
                const last = this.segments[this.segments.length - 1];
                last.x = target.x; last.y = target.y;
            }
        }
    }

    draw(ctx, color) {
        if (this.segments.length < 2) return;
        
        // Draw main core
        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.segments.length; i++) {
            ctx.lineTo(this.segments[i].x, this.segments[i].y);
        }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

        // Draw outer glow/strands
        ctx.beginPath();
        ctx.moveTo(this.segments[0].x, this.segments[0].y);
        for (let i = 1; i < this.segments.length; i++) {
            const p = this.segments[i];
            const offset = Math.sin(Date.now() * 0.01 + i) * 2;
            ctx.lineTo(p.x + offset, p.y + offset);
        }
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.6; ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Draw cross-webbing (optional, for detail)
        if (this.segments.length > 5) {
            ctx.beginPath();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.3;
            for (let i = 0; i < this.segments.length - 2; i += 3) {
                const p1 = this.segments[i], p2 = this.segments[i+2];
                const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                ctx.moveTo(p1.x, p1.y); ctx.quadraticCurveTo(mx + 5, my + 5, p2.x, p2.y);
            }
            ctx.stroke(); ctx.globalAlpha = 1.0;
        }
    }
}

// ─── Particle System ──────────────────────────────────────────────────────
class Particle {
    constructor(x, y, color, size = 3, vx = null, vy = null) {
        this.x = x; this.y = y; this.color = color;
        this.vx = vx ?? (Math.random() - 0.5) * 10;
        this.vy = vy ?? (Math.random() - 0.5) * 10;
        this.life = 1.0; this.decay = 0.02 + Math.random() * 0.03;
        this.size = size;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life -= this.decay;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}


// ─── Smoothing ──────────────────────────────────────────────────────────────
class LandmarkSmoother {
    constructor(alpha = 0.55) { this.alpha = alpha; this.lastLms = null; }
    smooth(newLms) {
        if (!newLms) { this.lastLms = null; return null; }
        if (!this.lastLms) { this.lastLms = newLms.map(p => ({ ...p })); return newLms; }
        const smoothed = newLms.map((p, i) => ({
            x: this.lastLms[i].x + (p.x - this.lastLms[i].x) * this.alpha,
            y: this.lastLms[i].y + (p.y - this.lastLms[i].y) * this.alpha,
            z: this.lastLms[i].z + (p.z - this.lastLms[i].z) * this.alpha
        }));
        this.lastLms = smoothed; return smoothed;
    }
}

const sfx = new SoundManager();
const smoothers = [new LandmarkSmoother(0.3), new LandmarkSmoother(0.3)];

// ─── Theme / Suits Data ───────────────────────────────────────────────────
const THEMES = {
    classic: { primary: '#f00', secondary: '#0055ff', web: '#fff', accent: '#00e5ff', city: '#00050a' },
    symbiote: { primary: '#111', secondary: '#222', web: '#ccc', accent: '#b44dff', city: '#05000a' },
    iron: { primary: '#c00', secondary: '#c90', web: '#ff0', accent: '#ffe033', city: '#0a0a05' },
    miles: { primary: '#111', secondary: '#f00', web: '#0ff', accent: '#ff0044', city: '#0a0005' }
};
let currentSuit = 'classic';

function selectSuit(name) {
    currentSuit = name;
    document.querySelectorAll('.suit-option').forEach(el => el.classList.remove('active'));
    document.querySelector(`.suit-option[data-suit="${name}"]`).classList.add('active');
    const theme = THEMES[name];
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-glow', theme.accent + '66');
}

// ─── Game state ────────────────────────────────────────────────────────────
let score = 0, caught = 0, timeLeft = 10, lives = 3, gameState = 'playing';
let objects = [], particles = [], lightnings = [], screenFlash = 0, portalPulse = 0;
let cityData = null;

const handStates = [
    { landmarks: null, persistence: 0, pinching: false, heldObject: null, webSim: new WebSimulation(), web: { active: false, attached: false, progress: 0, target: null, fromX: 0, fromY: 0 } },
    { landmarks: null, persistence: 0, pinching: false, heldObject: null, webSim: new WebSimulation(), web: { active: false, attached: false, progress: 0, target: null, fromX: 0, fromY: 0 } }
];

const canvas = document.getElementById('gameCanvas'), ctx = canvas.getContext('2d'), video = document.getElementById('videoEl');
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resizeCanvas(); window.addEventListener('resize', resizeCanvas);

const OBJ_TYPES = [
    { emoji: '💎', color: '#00e5ff', pts: 15, danger: false }, { emoji: '⭐', color: '#ffe033', pts: 5, danger: false },
    { emoji: '💰', color: '#ffd700', pts: 20, danger: false }, { emoji: '🔮', color: '#b44dff', pts: 12, danger: false },
    { emoji: '❤️', color: '#ff4488', pts: 8, danger: false }, { emoji: '💣', color: '#ff3333', pts: 0, danger: true },
];

function spawnObject() {
    if (objects.length >= 14 || gameState !== 'playing') return;
    const isDanger = Math.random() < 0.25;
    const type = isDanger ? OBJ_TYPES[5] : OBJ_TYPES[Math.floor(Math.random() * 5)];
    let x = 60 + Math.random() * (canvas.width - 120), y = 60 + Math.random() * (canvas.height - 250);
    objects.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, radius: 30, ...type, id: Math.random(), fadeIn: 0, glitchTimer: 0 });
}
for (let i = 0; i < 7; i++) spawnObject();
setInterval(spawnObject, 1800);

setInterval(() => {
    if (gameState === 'playing') {
        timeLeft--; document.getElementById('timerVal').textContent = timeLeft;
        if (timeLeft <= 0) endGame();
    }
}, 1000);

function updateLives() {
    document.getElementById('lifelineVal').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
    if (lives <= 0) startQuiz();
}

function endGame() {
    gameState = 'gameOver';
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalCaught').textContent = caught;
}

// ─── Quiz Logic ─────────────────────────────────────────────────────────────
let quizManager = {
    questions: [],
    currentIdx: 0,
    generate() {
        this.questions = [];
        for (let i = 0; i < 5; i++) {
            const a = 2 + Math.floor(Math.random() * 8), b = 2 + Math.floor(Math.random() * 8);
            const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
            let q = `${a} ${op} ${b}`, ans = eval(q);
            let opts = [ans, ans + 2 + Math.floor(Math.random() * 3), ans - 3 - Math.floor(Math.random() * 3)].sort(() => Math.random() - 0.5);
            this.questions.push({ q, ans, opts });
        }
    },
    draw() {
        const q = this.questions[this.currentIdx]; document.getElementById('quizQuestion').textContent = `${q.q} = ?`;
        const container = document.getElementById('quizOptions'); container.innerHTML = '';
        q.opts.forEach((opt, i) => { const div = document.createElement('div'); div.className = 'quiz-option'; div.id = `opt-${i}`; div.textContent = opt; container.appendChild(div); });
        document.getElementById('quizProgress').textContent = `Recovery: ${this.currentIdx + 1} / 5`;
    }
};

function startQuiz() { gameState = 'quiz'; quizManager.generate(); quizManager.currentIdx = 0; quizManager.draw(); document.getElementById('quizHUD').classList.remove('hidden'); }

function handleQuizSelection(choice) {
    if (gameState !== 'quiz') return;
    if (quizManager.questions[quizManager.currentIdx].opts[choice] === quizManager.questions[quizManager.currentIdx].ans) {
        quizManager.currentIdx++;
        sfx.playCollect();
        if (quizManager.currentIdx >= 5) { 
            lives = 3; updateLives(); gameState = 'playing'; 
            document.getElementById('quizHUD').classList.add('hidden'); 
            // Reset hand states to prevent "stuck" webs
            handStates.forEach(s => { s.web.active = false; s.web.attached = false; s.heldObject = null; s.pinching = true; }); 
        }
        else quizManager.draw();
    } else { screenFlash = 0.2; }
}

function checkQuizHovers() {
    if (gameState !== 'quiz') return;
    handStates.forEach(state => {
        if (!state.landmarks) return;
        const pos = webOrigin(state.landmarks);
        [0, 1, 2].forEach(i => {
            const el = document.getElementById(`opt-${i}`); if (!el) return;
            const r = el.getBoundingClientRect();
            if (pos.x > r.left && pos.x < r.right && pos.y > r.top && pos.y < r.bottom) { el.classList.add('hovered'); if (state.pinching) handleQuizSelection(i); }
            else el.classList.remove('hovered');
        });
    });
}

// ─── Interaction ────────────────────────────────────────────────────────────
const audioBtn = document.getElementById('audioInitBtn');
audioBtn.addEventListener('click', () => { sfx.init(); sfx.resume(); audioBtn.classList.add('hidden'); setTimeout(() => audioBtn.style.display = 'none', 400); });
document.getElementById('restartBtn').addEventListener('click', () => { lives = 3; score = 0; caught = 0; timeLeft = 10; objects = []; gameState = 'playing'; document.getElementById('gameOverScreen').classList.add('hidden'); updateLives(); });

function lm2canvas(pt) { return { x: (1 - pt.x) * canvas.width, y: pt.y * canvas.height }; }
function pinchDist(lms) { return Math.hypot(lms[4].x - lms[8].x, lms[4].y - lms[8].y); }
const PINCH_THRESHOLD = 0.065; // Slightly more forgiving threshold
function webOrigin(lms) { const t = lm2canvas(lms[4]), i = lm2canvas(lms[8]); return { x: (t.x + i.x) / 2, y: (t.y + i.y) / 2 }; }

function processHand(handIndex) {
    const state = handStates[handIndex];
    if (!state.landmarks || gameState !== 'playing') return;
    const pinchingNow = state.pinching, origin = webOrigin(state.landmarks);
    if (pinchingNow && !state.lastPinch) {
        let nearest = null, minD = 900;
        for (const o of objects) { if (!o.grabbed) { const d = Math.hypot(o.x - origin.x, o.y - origin.y); if (d < minD) { minD = d; nearest = o; } } }
        if (nearest) {
            state.web.active = true; state.web.attached = false; state.web.progress = 0; state.web.target = nearest; 
            state.webSim.reset(origin.x, origin.y); sfx.playThwip(); 

            // Muzzle Flash / Thwip Particles
            for(let i=0; i<8; i++) {
                const angle = Math.atan2(nearest.y - origin.y, nearest.x - origin.x) + (Math.random()-0.5);
                const speed = 5 + Math.random() * 5;
                particles.push(new Particle(origin.x, origin.y, THEMES[currentSuit].web, 3, Math.cos(angle) * speed, Math.sin(angle) * speed));
            }
        }

    }
    if (pinchingNow) {
        if (state.web.active && !state.web.attached) {
            state.web.progress = Math.min(1, state.web.progress + 0.15); // Slightly faster shot
            if (state.web.progress >= 1) { 
                state.web.attached = true; 
                state.web.target.grabbed = true; 
                state.heldObject = state.web.target; 
                
                // Impact Particles
                for(let i=0; i<15; i++) particles.push(new Particle(state.web.target.x, state.web.target.y, THEMES[currentSuit].web, 2));

                if (state.heldObject.danger) { 
                    lives--; updateLives(); sfx.playExplosion(); spawnLightning(origin.x, origin.y); 
                    objects = objects.filter(o => o.id !== state.heldObject.id); state.heldObject = null; state.web.active = false; state.web.attached = false; 
                } else sfx.playGrab(); 
            }
        }

        if (state.web.active) {
            state.webSim.update(origin, state.web.target, state.web.progress);
            if (state.web.attached && state.heldObject) { 
                // Snappier "Zip" Physics with a bit of overshoot/spring
                const dx = origin.x - state.heldObject.x;
                const dy = origin.y - state.heldObject.y;
                state.heldObject.x += dx * 0.45; 
                state.heldObject.y += dy * 0.45; 
            }
        }

    }
    if (!pinchingNow && state.lastPinch) {
        if (state.heldObject) {
            const px = canvas.width / 2, py = canvas.height - 100;
            if (Math.hypot(state.heldObject.x - px, state.heldObject.y - py) < 110) { score += state.heldObject.pts; caught++; timeLeft += 3; portalPulse = 1; document.getElementById('scoreVal').textContent = score; sfx.playCollect(); screenFlash = 0.5; objects = objects.filter(o => o.id !== state.heldObject.id); }
            else { state.heldObject.grabbed = false; state.heldObject.vx = (Math.random()-0.5)*8; state.heldObject.vy = (Math.random()-0.5)*8; }
            state.heldObject = null;
        }
        state.web.active = false; state.web.attached = false; state.web.target = null;
    }
    state.lastPinch = pinchingNow;
}

// ─── Visuals ───────────────────────────────────────────────────────────────
function spawnLightning(x, y) { for (let i = 0; i < 12; i++) { let segments = [{ x, y }], curX = x, curY = y; for (let j = 0; j < 6; j++) { curX += (Math.random() - 0.5) * 120; curY += (Math.random() - 0.5) * 120; segments.push({ x: curX, y: curY }); } lightnings.push({ segments, life: 1 }); } }

function drawCity() {
    const theme = THEMES[currentSuit];
    ctx.fillStyle = theme.city; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!cityData) {
        cityData = { stars: Array.from({ length: 150 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height * 0.7, r: 0.5 + Math.random() * 1.5, bright: Math.random() })), buildings: [] };
        let x = 0; while (x < canvas.width) { const bw = 40 + Math.random() * 90, bh = 60 + Math.random() * 300; cityData.buildings.push({ x, y: canvas.height - bh, w: bw, h: bh }); x += bw + 1; }
    }
    const t = Date.now() / 1000;
    ctx.fillStyle = theme.accent + '99'; cityData.stars.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.8 + 0.4 * Math.sin(t + s.bright * 5)), 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#050a10'; cityData.buildings.forEach(b => { ctx.fillRect(b.x, b.y, b.w, b.h); });
}

function drawPortal() {
    const theme = THEMES[currentSuit], px = canvas.width / 2, py = canvas.height - 100, t = Date.now() / 1000, s = 1.0 + 0.1 * Math.sin(t * 4) + portalPulse * 0.5; portalPulse *= 0.9;
    ctx.save(); ctx.translate(px, py); ctx.rotate(t * 1.5);
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 95 * s + i * 15, 45 * s, i * Math.PI / 4, 0, Math.PI * 2); ctx.strokeStyle = theme.accent + Math.floor((0.5 - i * 0.1) * 255).toString(16).padStart(2, '0'); ctx.stroke(); }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 55 * s); g.addColorStop(0, '#fff'); g.addColorStop(0.3, theme.accent); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 55 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawObject(o) {
    o.fadeIn = Math.min(1, o.fadeIn + 0.05); o.glitchTimer += 0.2;
    ctx.save(); ctx.globalAlpha = o.fadeIn; ctx.translate(o.x, o.y);
    if (o.danger) { const p = 0.5 + 0.5 * Math.sin(o.glitchTimer); ctx.beginPath(); ctx.arc(0, 0, o.radius + 8 * p, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255, 0, 0, ${0.4 * p})`; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, o.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fill(); 
    ctx.strokeStyle = o.color; ctx.lineWidth = 4; ctx.stroke();
    ctx.font = `${o.radius * 1.2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.emoji, 0, 0); ctx.restore();
}

const SUIT_COLORS = { classic: { primary: '#f00', secondary: '#0055ff', web: '#000' }, symbiote: { primary: '#111', secondary: '#000', web: '#fff' }, iron: { primary: '#c00', secondary: '#c90', web: '#000' }, miles: { primary: '#111', secondary: '#f00', web: '#0ff' } };

function drawSpiderHand(lms, pinching) {
    const conn = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]];
    const suit = SUIT_COLORS[currentSuit];
    
    ctx.save();
    // Fill Hand Shape
    ctx.fillStyle = pinching ? suit.primary : suit.secondary;
    ctx.beginPath();
    const palm = [0, 5, 9, 13, 17].map(i => lm2canvas(lms[i]));
    ctx.moveTo(palm[0].x, palm[0].y); palm.forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();

    // Fingers as segments
    ctx.strokeStyle = suit.primary; ctx.lineCap = 'round';
    conn.forEach(f => {
        ctx.beginPath();
        const p0 = lm2canvas(lms[f[0]]); ctx.moveTo(p0.x, p0.y);
        f.forEach(idx => { const p = lm2canvas(lms[idx]); ctx.lineTo(p.x, p.y); });
        ctx.lineWidth = 14; ctx.stroke();
    });

    // Webbing Pattern (Procedural)
    ctx.strokeStyle = suit.web; ctx.lineWidth = 0.5;
    for (let i = 0; i < 21; i += 4) {
        const p = lm2canvas(lms[i]);
        for(let j=0; j<4; j++) {
            const target = lm2canvas(lms[Math.min(20, i+j)]);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        }
    }

    // Nodes
    for (let i = 0; i < 21; i++) {
        const p = lm2canvas(lms[i]);
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fillStyle = suit.primary; ctx.fill();
    }
    ctx.restore();
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); drawCity();
    if (screenFlash > 0) { ctx.fillStyle = `rgba(0,180,255,${screenFlash * 0.15})`; ctx.fillRect(0, 0, canvas.width, canvas.height); screenFlash -= 0.05; }
    if (gameState === 'playing' || gameState === 'quiz') {
        // Particles
        particles.forEach((p, idx) => { p.update(); p.draw(ctx); if (p.life <= 0) particles.splice(idx, 1); });

        objects.forEach(o => { if (!o.grabbed) { o.x += o.vx; o.y += o.vy; if (o.x < 30 || o.x > canvas.width - 30) o.vx *= -1; if (o.y < 30 || o.y > canvas.height - 30) o.vy *= -1; } });

        handStates.forEach((state, i) => { 
            if (state.persistence > 0 || state.landmarks) {
                if (state.landmarks) {
                    state.persistence = 8;
                    // Update pinching state EVERY frame
                    state.pinching = pinchDist(state.landmarks) < PINCH_THRESHOLD;
                }
                if (state.persistence > 0) {
                    if (gameState === 'playing') processHand(i); 
                    drawSpiderHand(state.landmarks, state.pinching); 
                    if (state.web.active) state.webSim.draw(ctx, THEMES[currentSuit].web);
                    if (!state.landmarks) state.persistence--;
                }
            }
        });
        if (gameState === 'quiz') checkQuizHovers();
        drawPortal(); objects.forEach(drawObject);
    }
    lightnings.forEach(l => { ctx.beginPath(); ctx.moveTo(l.segments[0].x, l.segments[0].y); l.segments.forEach(p => ctx.lineTo(p.x, p.y)); ctx.strokeStyle = `rgba(255, 255, 255, ${l.life})`; ctx.lineWidth = 3; ctx.stroke(); l.life -= 0.15; });
    lightnings = lightnings.filter(l => l.life > 0);
    requestAnimationFrame(loop);
}
loop();

const hands = new Hands({ locateFile: f => `https://unpkg.com/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
hands.onResults(res => {
    const hazards = objects.filter(o => o.danger).length;
    document.getElementById('handDetection').textContent = `SYNC: ${hazards >= 3 ? 'DUAL-CORE' : 'SINGLE-CORE'} | HAZARDS: ${hazards}`;
    const allowed = hazards >= 3 ? 2 : 1;
    if (res.multiHandLandmarks) { res.multiHandLandmarks.forEach((lms, i) => { if (i < allowed) handStates[i].landmarks = smoothers[i].smooth(lms); }); }
    else { handStates[0].landmarks = null; handStates[1].landmarks = null; }
});
new Camera(video, { onFrame: async () => { await hands.send({ image: video }); }, width: 640, height: 480 }).start().then(() => { document.getElementById('loadMsg').textContent = 'System Ready'; setTimeout(() => { document.getElementById('loadingScreen').style.opacity = '0'; setTimeout(() => document.getElementById('loadingScreen').style.display = 'none', 850); }, 1500); });
