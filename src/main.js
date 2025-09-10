// Dodgetia - simple skillshot dodge game (ASCII-only UI strings)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const ovBtn = document.getElementById('ov-btn');
const ovScore = document.getElementById('ov-score');
const ovTitle = document.getElementById('ov-title');
const ovDesc = document.getElementById('ov-desc');
const uncheckBtn = document.getElementById('opt-uncheck-all');

// View size in CSS pixels
const VIEW_W = 960;
const VIEW_H = 540;

// Version (provided by user)
const VERSION = '0.4.0';

// HiDPI scaling to keep crisp rendering
function setupHiDPI() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = VIEW_W;
  const h = VIEW_H;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
setupHiDPI();
window.addEventListener('resize', setupHiDPI);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// --- Assets ---
const SPRITE_W = 55;
const SPRITE_H = 73;
const SPRITE_FRAMES = 8;
let tiaImage;
let hisuiImage;
let abigailImage;
let lukuImage;
let katjaImage;
let darkoImage;
let vanyaImage;
let debiImage;
let marleneImage;

// Units: 1m = 55px (fixed)
const METER = 55;
const PLAYER_SPEED_MPS = 3.9; // meters per second

// --- Utility ---
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx; const dy = ay - by; return dx*dx + dy*dy;
};

function worldFromMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left);
  const y = (e.clientY - rect.top);
  return { x, y };
}

// --- Game State ---
const state = {
  running: false,
  gameOver: false,
  time: 0,
  dangerHits: 0,
  cautionHits: 0,
  enemies: [],
  bullets: [],
  difficulty: 1,
  spawnToken: 0,
};

// Player
const player = {
  x: VIEW_W / 2,
  y: VIEW_H / 2,
  radius: 18,
  speed: PLAYER_SPEED_MPS * METER, // px/s
  targetX: null,
  targetY: null,
  moving: false,
  facing: 1, // 1:right, -1:left
  frame: 0,
  frameTime: 0,
  frameDur: 0.09,
};

// Enemy spawner
function makeHisui() {
  return Enemies.Hisui({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    onCaution: () => {
      if (ignoreCautionSelected()) return;
      state.cautionHits += 1;
      if (state.cautionHits >= 3) gameOver();
    },
    sprite: hisuiImage,
  });
}

function makeAbigail() {
  return Enemies.Abigail({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    sprite: abigailImage,
  });
}

function makeLuku() {
  return Enemies.Luku({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    sprite: lukuImage,
  });
}

function makeKatja() {
  return Enemies.Katja({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    sprite: katjaImage,
  });
}

function makeDarko() {
  return Enemies.Darko({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    sprite: darkoImage,
  });
}

function makeVanya() {
  return Enemies.Vanya({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    sprite: vanyaImage,
  });
}

function makeDebiMarlene() {
  return Enemies.DebiMarlene({
    METER,
    player,
    bounds: { w: VIEW_W, h: VIEW_H },
    onDanger: () => { state.dangerHits += 1; gameOver(); },
    sprites: { debi: debiImage, marlene: marleneImage },
  });
}

function allowedEnemyTypes() {
  const hisuiEl = document.getElementById('opt-hisui');
  const abelEl = document.getElementById('opt-abigail');
  const lukuEl = document.getElementById('opt-luku');
  const katjaEl = document.getElementById('opt-katja');
  const darkoEl = document.getElementById('opt-darko');
  const vanyaEl = document.getElementById('opt-vanya');
  const dmEl = document.getElementById('opt-debimarlene');
  const allowed = [];
  if (!hisuiEl || hisuiEl.checked) allowed.push('Hisui');
  if (!abelEl || abelEl.checked) allowed.push('Abigail');
  if (!lukuEl || lukuEl.checked) allowed.push('Luku');
  if (!katjaEl || katjaEl.checked) allowed.push('Katja');
  if (!darkoEl || darkoEl.checked) allowed.push('Darko');
  if (!vanyaEl || vanyaEl.checked) allowed.push('Vanya');
  if (!dmEl || dmEl.checked) allowed.push('DebiMarlene');
  if (allowed.length === 0) return ['Hisui','Abigail','Luku','Katja','Darko','Vanya'];
  return allowed;
}

function ignoreCautionSelected() {
  const el = document.getElementById('opt-ignore-caution');
  return !!(el && el.checked);
}

function makeRandomEnemyAllowed() {
  const types = allowedEnemyTypes();
  const t = types[Math.floor(Math.random() * types.length)];
  if (t === 'Abigail') return makeAbigail();
  if (t === 'Luku') return makeLuku();
  if (t === 'Katja') return makeKatja();
  if (t === 'Darko') return makeDarko();
  if (t === 'Vanya') return makeVanya();
  if (t === 'DebiMarlene') return makeDebiMarlene();
  return makeHisui();
}

function spawnEnemies() {
  state.enemies.length = 0;
  state.enemies.push(makeRandomEnemyAllowed());
}

function fireFromEnemy(enemy) {
  const aimAngle = enemy.aimAtPlayer ? Math.atan2(player.y - enemy.y, player.x - enemy.x) : Math.random() * Math.PI * 2;
  const shots = enemy.burst;
  const start = -enemy.spread * 0.5;
  for (let i = 0; i < shots; i++) {
    const t = shots === 1 ? 0.5 : i / (shots - 1);
    const a = aimAngle + start + t * enemy.spread;
    const speed = enemy.bulletSpeed;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    state.bullets.push({
      x: enemy.x,
      y: enemy.y,
      vx, vy,
      radius: 8,
      color: enemy.color,
      life: 3.5,
    });
  }
}

// Input: right-click to move
// Disable context menu globally to avoid Back/Forward menu popping up
document.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    e.preventDefault();
    const p = worldFromMouse(e);
    player.targetX = clamp(p.x, 0, VIEW_W);
    player.targetY = clamp(p.y, 0, VIEW_H);
    player.moving = true;
    player.facing = (player.targetX >= player.x) ? 1 : -1;
  }
});

// Overlay control
ovBtn.addEventListener('click', () => {
  if (!state.running) startGame();
  else if (state.gameOver) restartGame();
});

// Uncheck all enemy options at once
if (uncheckBtn) {
  uncheckBtn.addEventListener('click', () => {
    const ids = [
      'opt-hisui','opt-abigail','opt-luku','opt-katja','opt-darko','opt-vanya','opt-debimarlene'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
  });
}

function startGame() {
  state.running = true;
  state.gameOver = false;
  state.spawnToken++;
  state.time = 0;
  state.dangerHits = 0;
  state.cautionHits = 0;
  state.bullets = [];
  state.difficulty = 1;
  player.x = VIEW_W / 2;
  player.y = VIEW_H / 2;
  player.moving = false;
  overlay.classList.remove('show');
  spawnEnemies();
}

function gameOver() {
  state.gameOver = true;
  overlay.classList.add('show');
  ovTitle.textContent = 'Game Over';
  ovDesc.textContent = 'You got hit!';
  ovScore.textContent = `Survival: ${state.time.toFixed(1)}s | Danger: ${state.dangerHits} | Caution: ${state.cautionHits}/3 | Speed: ${PLAYER_SPEED_MPS.toFixed(1)} m/s`;
  ovBtn.textContent = 'Restart';
}

function restartGame() { startGame(); }

// Update & Draw
let last = performance.now();
let acc = 0;
const FIXED_DT = 1 / 120; // physics tick

function update(dt) {
  if (!state.running || state.gameOver) return;

  // difficulty ramp
  state.time += dt;
  if (Math.floor(state.time) % 15 === 0) {
    state.difficulty = 1 + Math.floor(state.time / 15);
  }

  // player move
  if (player.moving && player.targetX != null && player.targetY != null) {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < 2) {
      player.moving = false;
    } else {
      const d = Math.sqrt(d2);
      const vx = (dx / d) * player.speed;
      const vy = (dy / d) * player.speed;
      player.x += vx * dt;
      player.y += vy * dt;
      if (Math.hypot(player.targetX - player.x, player.targetY - player.y) < 2) {
        player.x = player.targetX; player.y = player.targetY; player.moving = false;
      }
    }
  }

  // animate
  if (player.moving) {
    player.frameTime += dt;
    if (player.frameTime >= player.frameDur) {
      player.frameTime -= player.frameDur;
      player.frame = (player.frame + 1) % SPRITE_FRAMES;
    }
  } else {
    player.frame = 0;
    player.frameTime = 0;
  }

  // enemies update and schedule respawn
  for (const e of state.enemies) {
    e.update(dt);
    if (e.dead && !e._respawnScheduled) {
      e._respawnScheduled = true;
      const token = state.spawnToken;
      setTimeout(() => {
        if (state.running && !state.gameOver && token === state.spawnToken) {
          // ensure only one enemy at a time
          if (state.enemies.length === 0) state.enemies.push(makeRandomEnemyAllowed());
        }
      }, 0);
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead);
  if (state.enemies.length === 0 && state.running && !state.gameOver) {
    // safety: keep exactly one enemy alive
    state.enemies.push(makeRandomEnemyAllowed());
  }

  // collisions handled inside enemies (e.g., A/B skills)
}

function drawGrid() {
  const s = METER; // 1 tile = 1m = 55px
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.strokeStyle = '#c7cbde';
  ctx.lineWidth = 1;
  for (let x = 0; x <= VIEW_W; x += s) {
    ctx.beginPath(); ctx.moveTo(x+0.5, 0); ctx.lineTo(x+0.5, VIEW_H); ctx.stroke();
  }
  for (let y = 0; y <= VIEW_H; y += s) {
    ctx.beginPath(); ctx.moveTo(0, y+0.5); ctx.lineTo(VIEW_W, y+0.5); ctx.stroke();
  }
  ctx.restore();
}

function draw() {
  // clear
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  // ground grid
  drawGrid();

  // enemies draw (handles telegraphs internally)
  for (const e of state.enemies) e.draw(ctx);

  // player
  if (tiaImage) {
    const frame = player.moving ? player.frame : 0;
    const sx = frame * SPRITE_W;
    const sy = 0;
    const scale = 1.3;
    const dw = SPRITE_W * scale;
    const dh = SPRITE_H * scale;
    const dx = Math.round(player.x - dw/2);
    const dy = Math.round(player.y - dh + 10);
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(Math.round(player.x), 0);
      ctx.scale(-1, 1);
      ctx.drawImage(tiaImage, sx, sy, SPRITE_W, SPRITE_H, Math.round(-dw/2), dy, dw, dh);
    } else {
      ctx.drawImage(tiaImage, sx, sy, SPRITE_W, SPRITE_H, dx, dy, dw, dh);
    }
    ctx.restore();
  } else {
    // fallback: circle
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
  }

  // HUD
  hud.textContent = `v${VERSION} | Right-click to move | Speed: ${PLAYER_SPEED_MPS.toFixed(1)} m/s | Survival: ${state.time.toFixed(1)}s | Danger: ${state.dangerHits} | Caution: ${state.cautionHits}/3`;
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= FIXED_DT) {
    update(FIXED_DT);
    acc -= FIXED_DT;
  }
  draw();
  requestAnimationFrame(loop);
}

// Boot
(async function boot() {
  try {
    // Load sprite relative to document
    tiaImage = await loadImage('img/touka_tia.png');
    hisuiImage = await loadImage('img/hisui_touka_55px.png');
    abigailImage = await loadImage('img/abigail.png');
    try {
      lukuImage = await loadImage('img/Luku.png');
    } catch (_) {
      // Fallback to Luke.png if provided under that name
      try { lukuImage = await loadImage('img/Luke.png'); } catch (__) {}
    }
    try {
      katjaImage = await loadImage('img/Katja.png');
    } catch (___) {}
    try {
      darkoImage = await loadImage('img/darko.png');
    } catch (____) {}
    try {
      vanyaImage = await loadImage('img/Vanya.png');
    } catch (_____) {}
    try { debiImage = await loadImage('img/Debi.png'); } catch (______) {}
    try { marleneImage = await loadImage('img/Marlene.png'); } catch (_______) {}
  } catch (e) {
    console.warn('Failed to load sprite, using fallback circle', e);
  }
  overlay.classList.add('show');
  ovTitle.textContent = `Dodgetia v${VERSION}`;
  ovDesc.textContent = 'Right-click to set destination and dodge bullets.';
  ovScore.textContent = `Units: 1m = ${METER}px | Speed: ${PLAYER_SPEED_MPS.toFixed(1)} m/s`;
  ovBtn.textContent = 'Start';
  requestAnimationFrame(loop);
})();
