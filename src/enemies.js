// Enemy definitions (classic script, exposes window.Enemies)
(function(){
  const Enemies = {};

  // Helper: clamp
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Rotated rectangle vs circle collision
  function circleIntersectsRotRect(cx, cy, r, rx, ry, len, wid, angle) {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    // translate into rect space
    const tx = cx - rx;
    const ty = cy - ry;
    const localX =  ( tx * ca + ty * sa);
    const localY = (-tx * sa + ty * ca);
    const hw = len; // we treat rect origin at (0,0) and extend +len along +X
    const hh = wid * 0.5;
    const nx = clamp(localX, 0, len);
    const ny = clamp(localY, -hh, hh);
    const dx = localX - nx;
    const dy = localY - ny;
    return (dx*dx + dy*dy) <= r*r;
  }

  // Front semicircle (center cx,cy, radius r, facing ang) vs player circle (px,py, pr)
  // Approximation: require circle intersects disk (<= r+pr) AND has any point in front half-plane (lx + pr >= 0)
  function circleInFrontSemicircle(px, py, pr, cx, cy, r, ang) {
    const dx = px - cx, dy = py - cy;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lx =  ( dx * ca + dy * sa);
    const ly = (-dx * sa + dy * ca);
    // half-plane test with circle extent
    if ((lx + pr) < 0) return false;
    // disk intersection test with expanded radius
    return (lx*lx + ly*ly) <= (r + pr) * (r + pr);
  }

  // Cone vs circle (approx): sector of radius R, half-angle TH (radians) in +X direction
  function circleIntersectsCone(px, py, pr, cx, cy, R, TH, ang) {
    const dx = px - cx, dy = py - cy;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lx =  ( dx * ca + dy * sa);
    const ly = (-dx * sa + dy * ca);
    const d = Math.hypot(lx, ly);
    if (d > R + pr) return false; // outside radius even with padding
    const a = Math.atan2(ly, lx);
    const half = TH * 0.5;
    const pad = Math.min(half, Math.asin(Math.min(1, pr / Math.max(d, pr))));
    return Math.abs(a) <= (half + pad) && (lx + pr) >= 0;
  }

  // Hisui enemy factory
  // cfg: { METER, player, bounds:{w,h}, onDanger: ()=>void, onCaution: ()=>void, sprite?: HTMLImageElement }
  Enemies.Hisui = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const onHit = cfg.onHit;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 4.11 * M; // m/s -> px/s

    // Skill W2 (formerly A): telegraphed rectangle
    const W2_LEN = 7.2 * M; // length along facing
    const W2_WID = 1.2 * M; // width
    const W2_TELEGRAPH = 0.5; // s

    // Skill E (formerly B): back dash -> wait -> forward dash with AoE
    const E_BACK_TIME = 0.13;
    const E_BACK_DIST = 2.0 * M;
    const E_WAIT1 = 0.325;
    const E_FWD_TIME = 0.25;
    const E_FWD_DIST = 6.0 * M; // forward distance
    const E_WAIT2 = 0.25;
    const E_AOE_R = 1.2 * M; // active during E_fwd

    // Skill R: front semicircle then rectangle
    const R_CAST1 = 0.5;
    const R_SEMI_R = 5.0 * M;
    const R_CAST2 = 0.625;
    const R_RECT_LEN = 5.5 * M;
    const R_RECT_WID = 2.0 * M;
    const R_WAIT = 0.25;

    // State
    function createQueue() {
      // Ensure last skill is either W2 or R (E cannot be last)
      const end = Math.random() < 0.5 ? 'W2' : 'R';
      const rest = end === 'W2' ? ['E', 'R'] : ['E', 'W2'];
      // shuffle the first two
      if (Math.random() < 0.5) return [rest[0], rest[1], end];
      return [rest[1], rest[0], end];
    }

    const e = {
      name: 'Hisui',
      x: 0, y: 0,
      facing: 1, // 1 right, -1 left (for potential sprite)
      dead: false,
      color: '#68e0a2',
      r: 16,
      state: 'spawn_idle',
      t: 0,
      feintRemaining: 0,
      // Skill E snapshot (lock direction through the whole skill)
      e_ang: 0,
      // Skill W2 snapshot
      w2_ox: 0, w2_oy: 0, w2_ang: 0,
      // Skill R snapshot
      r_ox: 0, r_oy: 0, r_ang: 0,
      // Skill usage plan
      queue: createQueue(),
      usedE: false,
      usedW2: false,
      usedR: false,
      lastSkill: null,
    };

    // spawn at edge
    (function spawn(){
      const pad = 40;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { e.x = pad; e.y = Math.random() * (H - pad*2) + pad; }
      if (side === 1) { e.x = W - pad; e.y = Math.random() * (H - pad*2) + pad; }
      if (side === 2) { e.x = Math.random() * (W - pad*2) + pad; e.y = pad; }
      if (side === 3) { e.x = Math.random() * (W - pad*2) + pad; e.y = H - pad; }
    })();

    // simple steering towards player
    function steerTowardsPlayer(dt) {
      const dx = player.x - e.x; const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const vx = (dx / d) * speedPx;
      const vy = (dy / d) * speedPx;
      e.x += vx * dt; e.y += vy * dt;
      e.facing = (dx >= 0) ? 1 : -1;
      // keep in bounds
      e.x = clamp(e.x, 0, W); e.y = clamp(e.y, 0, H);
    }

    // Range checks for skills
    function inRangeForW2() {
      const dx = player.x - e.x; const dy = player.y - e.y;
      const ang = Math.atan2(dy, dx);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const px =  (dx * ca + dy * sa);
      const py = (-dx * sa + dy * ca);
      return (px >= 0 && px <= W2_LEN && Math.abs(py) <= (W2_WID * 0.5));
    }
    function inRangeForE() {
      // Engage range for E is 4m (independent of dash distance)
      const dx = player.x - e.x; const dy = player.y - e.y;
      const d2 = dx*dx + dy*dy; const r = 4.0 * M;
      return d2 <= r*r;
    }
    function inRangeForR() {
      // If player within front 5m or within the 5.5x2.0 rect footprint
      const dx = player.x - e.x; const dy = player.y - e.y;
      const ang = Math.atan2(dy, dx);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const px =  (dx * ca + dy * sa);
      const py = (-dx * sa + dy * ca);
      const inSemi = (px >= 0 && (px*px + py*py) <= R_SEMI_R*R_SEMI_R);
      const inRect = (px >= 0 && px <= R_RECT_LEN && Math.abs(py) <= R_RECT_WID * 0.5);
      return inSemi || inRect;
    }

    // W2 control
    function startW2Telegraph() {
      e.state = 'W2_telegraph';
      e.t = 0;
      const dx = player.x - e.x; const dy = player.y - e.y;
      e.w2_ang = Math.atan2(dy, dx);
      e.w2_ox = e.x; e.w2_oy = e.y; // snapshot
    }
    function resolveW2Hit() {
      const hit = circleIntersectsRotRect(player.x, player.y, player.radius, e.w2_ox, e.w2_oy, W2_LEN, W2_WID, e.w2_ang);
      if (hit) cfg.onDanger && cfg.onDanger();
      e.usedW2 = true;
      e.lastSkill = 'W2';
      afterSkill();
    }

    // E control
    function startE() {
      // Lock aiming direction at start of E (towards player)
      const dx = player.x - e.x; const dy = player.y - e.y;
      e.e_ang = Math.atan2(dy, dx);
      e.state = 'E_back';
      e.t = 0;
    }

    // R control
    function startR() {
      e.state = 'R_cast1'; e.t = 0;
      const dx = player.x - e.x; const dy = player.y - e.y;
      e.r_ang = Math.atan2(dy, dx);
      e.r_ox = e.x; e.r_oy = e.y;
    }

    function afterSkill() {
      if (e.usedE && e.usedW2 && e.usedR) {
        e.dead = true; // leave after using all skills
      } else {
        e.state = 'move';
        e.t = 0;
        // advance queue
        e.queue.shift();
        if (e.queue.length === 0) {
          // safety
          e.queue = [];
        }
      }
    }

    function update(dt) {
      if (e.dead) return;
      e.t += dt;

      switch (e.state) {
        case 'spawn_idle': {
          if (e.t >= 1.0) { e.state = 'move'; e.t = 0; }
          break;
        }
        case 'move': {
          steerTowardsPlayer(dt);
          // decide next skill from queue[0]
          const next = e.queue[0];
          let cond = false;
          if (next === 'W2') cond = inRangeForW2();
          else if (next === 'E') cond = inRangeForE();
          else if (next === 'R') cond = inRangeForR();
          if (next && cond) {
            const feintMax = (e.lastSkill === 'E') ? 0.25 : 0.5;
            e.feintRemaining = Math.random() * feintMax;
            e.state = 'feint';
            e.t = 0;
          }
          break;
        }
        case 'feint': {
          // approach for feint duration then cast A
          const tRemain = Math.max(0, e.feintRemaining - dt);
          steerTowardsPlayer(dt);
          e.feintRemaining = tRemain;
          if (e.feintRemaining <= 0) {
            const next = e.queue[0];
            if (next === 'W2') startW2Telegraph();
            else if (next === 'E') startE();
            else if (next === 'R') startR();
          }
          break;
        }
        case 'W2_telegraph': {
          // immobile during telegraph
          if (e.t >= W2_TELEGRAPH) { resolveW2Hit(); }
          break;
        }
        case 'E_back': {
          // move opposite to locked direction (cannot re-aim during E)
          const ang = e.e_ang + Math.PI;
          // Facing can stay aligned with forward (use e.e_ang)
          e.facing = (Math.cos(e.e_ang) >= 0) ? 1 : -1;
          const frac = Math.min(1, e.t / E_BACK_TIME);
          const dist = E_BACK_DIST * (dt / E_BACK_TIME);
          e.x += Math.cos(ang) * dist;
          e.y += Math.sin(ang) * dist;
          if (e.t >= E_BACK_TIME) { e.state = 'E_wait1'; e.t = 0; }
          break;
        }
        case 'E_wait1': {
          if (e.t >= E_WAIT1) { e.state = 'E_fwd'; e.t = 0; }
          break;
        }
        case 'E_fwd': {
          // dash forward along locked direction (cannot re-aim during E)
          const ang = e.e_ang;
          e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
          const dist = E_FWD_DIST * (dt / E_FWD_TIME);
          e.x += Math.cos(ang) * dist;
          e.y += Math.sin(ang) * dist;
          // Damage window: during forward phase, circle centered on Hisui
          const rr = (player.radius + E_AOE_R);
          const ddx = player.x - e.x; const ddy = player.y - e.y;
          if ((ddx*ddx + ddy*ddy) <= rr*rr) { cfg.onDanger && cfg.onDanger(); }
          if (e.t >= E_FWD_TIME) { e.state = 'E_wait2'; e.t = 0; }
          break;
        }
        case 'E_wait2': {
          if (e.t >= E_WAIT2) { e.usedE = true; e.lastSkill = 'E'; afterSkill(); }
          break;
        }
        case 'R_cast1': {
          if (e.t >= R_CAST1) {
            // Apply semicircle hit in front
            if (circleInFrontSemicircle(player.x, player.y, player.radius, e.r_ox, e.r_oy, R_SEMI_R, e.r_ang)) {
              cfg.onCaution && cfg.onCaution();
            }
            e.state = 'R_cast2'; e.t = 0;
          }
          break;
        }
        case 'R_cast2': {
          if (e.t >= R_CAST2) {
            // Apply rectangle hit in front
            if (circleIntersectsRotRect(player.x, player.y, player.radius, e.r_ox, e.r_oy, R_RECT_LEN, R_RECT_WID, e.r_ang)) {
              cfg.onDanger && cfg.onDanger();
            }
            e.state = 'R_wait'; e.t = 0; }
          break;
        }
        case 'R_wait': {
          if (e.t >= R_WAIT) { e.usedR = true; e.lastSkill = 'R'; afterSkill(); }
          break;
        }
      }
    }

    function draw(ctx) {
      if (e.dead) return;
      // Color scheme
      const DANGER_FILL = 'rgba(239, 68, 68, 0.25)';
      const DANGER_STROKE = 'rgba(239, 68, 68, 0.9)';
      const CAUTION_FILL = 'rgba(234, 179, 8, 0.25)';
      const CAUTION_STROKE = 'rgba(234, 179, 8, 0.9)';

      // Telegraph for W2
      if (e.state === 'W2_telegraph') {
        ctx.save();
        ctx.translate(e.w2_ox, e.w2_oy);
        ctx.rotate(e.w2_ang);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = DANGER_FILL;
        ctx.strokeStyle = DANGER_STROKE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(0, -W2_WID/2, W2_LEN, W2_WID);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Optional visual for E damage window
      if (e.state === 'E_fwd') {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = DANGER_FILL;
        ctx.beginPath(); ctx.arc(e.x, e.y, E_AOE_R, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }

      // Telegraphs for R
      if (e.state === 'R_cast1') {
        // preview semicircle
        ctx.save();
        ctx.translate(e.r_ox, e.r_oy);
        ctx.rotate(e.r_ang);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = CAUTION_FILL;
        ctx.strokeStyle = CAUTION_STROKE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R_SEMI_R, -Math.PI/2, Math.PI/2, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (e.state === 'R_cast2') {
        // preview forward rectangle
        ctx.save();
        ctx.translate(e.r_ox, e.r_oy);
        ctx.rotate(e.r_ang);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = DANGER_FILL;
        ctx.strokeStyle = DANGER_STROKE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(0, -R_RECT_WID/2, R_RECT_LEN, R_RECT_WID);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Body (sprite if provided, else circle)
      if (cfg.sprite) {
        const SW = 55, SH = 73; // assumed frame size
        const scale = 1.3;
        const dw = SW * scale, dh = SH * scale;
        const dx = Math.round(e.x - dw/2);
        const dy = Math.round(e.y - dh + 10);
        ctx.save();
        if (e.facing < 0) {
          ctx.translate(Math.round(e.x), 0);
          ctx.scale(-1, 1);
          ctx.drawImage(cfg.sprite, 0, 0, SW, SH, Math.round(-dw/2), dy, dw, dh);
        } else {
          ctx.drawImage(cfg.sprite, 0, 0, SW, SH, dx, dy, dw, dh);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }

    return {
      get dead(){ return e.dead; },
      update, draw,
      // expose for debug if needed
      _e: e,
    };
  };

  // Abigail enemy factory
  // cfg: { METER, player, bounds:{w,h}, onDanger: ()=>void, sprite?: HTMLImageElement }
  Enemies.Abigail = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 3.9 * M;
    const W_CAST = 0.35;
    const W_WAIT = 0.1;
    const W_RADIUS = 5.75 * M;
    const W_THETA = (60 * Math.PI) / 180;

    const e = {
      name: 'Abigail',
      x: 0, y: 0,
      facing: 1,
      dead: false,
      color: '#f59e0b',
      r: 16,
      state: 'spawn_idle',
      t: 0,
      w_ang: 0,
      w_ox: 0, w_oy: 0,
    };

    (function spawn(){
      const pad = 40;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { e.x = pad; e.y = Math.random() * (H - pad*2) + pad; }
      if (side === 1) { e.x = W - pad; e.y = Math.random() * (H - pad*2) + pad; }
      if (side === 2) { e.x = Math.random() * (W - pad*2) + pad; e.y = pad; }
      if (side === 3) { e.x = Math.random() * (W - pad*2) + pad; e.y = H - pad; }
    })();

    function steerTowardsPlayer(dt) {
      const dx = player.x - e.x; const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const vx = (dx / d) * speedPx;
      const vy = (dy / d) * speedPx;
      e.x += vx * dt; e.y += vy * dt;
      e.facing = (dx >= 0) ? 1 : -1;
      e.x = Math.max(0, Math.min(W, e.x));
      e.y = Math.max(0, Math.min(H, e.y));
    }

    function inRangeForW() {
      // quick center check with angular limit and radial padding by player radius
      const dx = player.x - e.x; const dy = player.y - e.y;
      const ang = Math.atan2(dy, dx);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const px =  (dx * ca + dy * sa);
      const py = (-dx * sa + dy * ca);
      const d2 = px*px + py*py;
      if (px < -player.radius) return false;
      if (d2 > (W_RADIUS + player.radius) * (W_RADIUS + player.radius)) return false;
      const a = Math.atan2(py, px);
      return Math.abs(a) <= W_THETA / 2;
    }

    function startW() {
      e.state = 'W_cast'; e.t = 0;
      const dx = player.x - e.x; const dy = player.y - e.y;
      e.w_ang = Math.atan2(dy, dx);
      e.w_ox = e.x; e.w_oy = e.y;
    }

    function resolveWHit() {
      const hit = circleIntersectsCone(player.x, player.y, player.radius, e.w_ox, e.w_oy, W_RADIUS, W_THETA, e.w_ang);
      if (hit) cfg.onDanger && cfg.onDanger();
      e.state = 'W_wait'; e.t = 0;
    }

    function update(dt) {
      if (e.dead) return;
      e.t += dt;
      switch (e.state) {
        case 'spawn_idle': {
          if (e.t >= 1.0) { e.state = 'move'; e.t = 0; }
          break;
        }
        case 'move': {
          steerTowardsPlayer(dt);
          if (inRangeForW()) startW();
          break;
        }
        case 'W_cast': {
          if (e.t >= W_CAST) resolveWHit();
          break;
        }
        case 'W_wait': {
          if (e.t >= W_WAIT) { e.dead = true; }
          break;
        }
      }
    }

    function draw(ctx) {
      if (e.dead) return;

      if (e.state === 'W_cast') {
        ctx.save();
        ctx.translate(e.w_ox, e.w_oy);
        ctx.rotate(e.w_ang);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, W_RADIUS, -W_THETA/2, W_THETA/2, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Body (sprite if provided, else circle)
      if (cfg.sprite) {
        const iw = cfg.sprite.naturalWidth || cfg.sprite.width || 55;
        const ih = cfg.sprite.naturalHeight || cfg.sprite.height || 73;
        const scale = 1.3;
        const dw = iw * scale, dh = ih * scale;
        const dx = Math.round(e.x - dw/2);
        const dy = Math.round(e.y - dh + 10);
        ctx.save();
        if (e.facing < 0) {
          ctx.translate(Math.round(e.x), 0);
          ctx.scale(-1, 1);
          ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh);
        } else {
          ctx.drawImage(cfg.sprite, dx, dy, dw, dh);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e: e };
  };

  window.Enemies = Enemies;
})();
