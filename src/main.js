// Dodgetia - simple skillshot dodge game (ASCII-only UI strings)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const overlay = document.getElementById('overlay');
const ovBtn = document.getElementById('ov-btn');
const ovScore = document.getElementById('ov-score');
const ovTitle = document.getElementById('ov-title');
const ovDesc = document.getElementById('ov-desc');

// View size in CSS pixels
const VIEW_W = 960;
const VIEW_H = 540;

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
  hits: 0,
  enemies: [],
  bullets: [],
  difficulty: 1,
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

// Enemy factory
function createEnemy(x, y, opts = {}) {
  return {
    x, y,
    radius: opts.radius ?? 16,
    color: opts.color ?? '#d7525e',
    fireCd: 0,
    fireInt: opts.fireInt ?? 1.2, // seconds
    burst: opts.burst ?? 1,
    bulletSpeed: opts.bulletSpeed ?? 360,
    spread: opts.spread ?? 0, // radians
    aimAtPlayer: opts.aimAtPlayer ?? true,
  };
}

function spawnEnemies(n = 4) {
  state.enemies.length = 0;
  const pad = 40;
  for (let i = 0; i < n; i++) {
    // spawn at edges
    const side = i % 4;
    let x = 0, y = 0;
    if (side === 0) { x = pad; y = Math.random() * (VIEW_H - pad*2) + pad; }
    if (side === 1) { x = VIEW_W - pad; y = Math.random() * (VIEW_H - pad*2) + pad; }
    if (side === 2) { x = Math.random() * (VIEW_W - pad*2) + pad; y = pad; }
    if (side === 3) { x = Math.random() * (VIEW_W - pad*2) + pad; y = VIEW_H - pad; }

    const e = createEnemy(x, y, {
      fireInt: 1.3 - Math.min(0.8, 0.1 * state.difficulty),
      burst: 1 + Math.floor(Math.random() * clamp(state.difficulty, 1, 5)),
      spread: 0.25,
      bulletSpeed: 330 + state.difficulty * 10,
      color: ['#d7525e', '#e39a3b', '#5aa7e6'][i % 3],
    });
    state.enemies.push(e);
  }
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
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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

function startGame() {
  state.running = true;
  state.gameOver = false;
  state.time = 0;
  state.hits = 0;
  state.bullets = [];
  state.difficulty = 1;
  player.x = VIEW_W / 2;
  player.y = VIEW_H / 2;
  player.moving = false;
  overlay.classList.remove('show');
  spawnEnemies(4);
}

function gameOver() {
  state.gameOver = true;
  overlay.classList.add('show');
  ovTitle.textContent = 'Game Over';
  ovDesc.textContent = 'You got hit!';
  ovScore.textContent = `Survival: ${state.time.toFixed(1)}s | Hits: ${state.hits} | Speed: ${PLAYER_SPEED_MPS.toFixed(1)} m/s`;
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

  // enemies fire
  for (const e of state.enemies) {
    e.fireCd -= dt;
    if (e.fireCd <= 0) {
      fireFromEnemy(e);
      e.fireCd = e.fireInt;
    }
  }

  // bullets update
  const W = VIEW_W, H = VIEW_H;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  // cull
  state.bullets = state.bullets.filter(b => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);

  // collisions
  for (const b of state.bullets) {
    const r = b.radius + player.radius - 2;
    if (dist2(b.x, b.y, player.x, player.y) <= r*r) {
      state.hits += 1;
      gameOver();
      break;
    }
  }
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

  // enemies
  for (const e of state.enemies) {
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2); ctx.fill();
  }

  // bullets
  for (const b of state.bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill();
  }

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
  hud.textContent = `Right-click to move | Speed: ${PLAYER_SPEED_MPS.toFixed(1)} m/s | Survival: ${state.time.toFixed(1)}s | Hits: ${state.hits}`;
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
  } catch (e) {
    console.warn('Failed to load sprite, using fallback circle', e);
  }
  overlay.classList.add('show');
  ovTitle.textContent = 'Dodgetia';
  ovDesc.textContent = 'Right-click to set destination and dodge bullets.';
  ovScore.textContent = `Units: 1m = ${METER}px | Speed: ${PLAYER_SPEED_MPS.toFixed(1)} m/s`;
  ovBtn.textContent = 'Start';
  requestAnimationFrame(loop);
})();
