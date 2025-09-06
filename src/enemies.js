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

  // Circle vs axis-aligned rectangle centered at (rx,ry) with half-sizes hw,hh
  function circleIntersectsAABB(cx, cy, r, rx, ry, hw, hh) {
    const nx = clamp(cx, rx - hw, rx + hw);
    const ny = clamp(cy, ry - hh, ry + hh);
    const dx = cx - nx; const dy = cy - ny;
    return (dx*dx + dy*dy) <= r*r;
  }

  // Polygon helpers for trapezoid hit
  function pointInPolygon(px, py, verts) {
    // verts: array of [x,y] in order (convex ok)
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i][0], yi = verts[i][1];
      const xj = verts[j][0], yj = verts[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function distPointToSeg(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - x1, py - y1);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - x2, py - y2);
    const b = c1 / c2;
    const bx = x1 + b * vx, by = y1 + b * vy;
    return Math.hypot(px - bx, py - by);
  }

  function circleIntersectsPolygon(cx, cy, r, verts) {
    if (pointInPolygon(cx, cy, verts)) return true;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      if (distPointToSeg(cx, cy, a[0], a[1], b[0], b[1]) <= r) return true;
    }
    return false;
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

  // Luku enemy factory
  // cfg: { METER, player, bounds:{w,h}, onDanger: ()=>void, sprite?: HTMLImageElement }
  Enemies.Luku = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 3.9 * M;
    const Q_CAST = 0.3; // cast time
    const Q_WAIT = 0.1; // aftercast
    const Q_SIZE = 0.6 * M; // square side
    const Q_RANGE = 10.0 * M; // max travel
    const Q_SPEED = 18.0 * M; // px/s

    const e = {
      name: 'Luku',
      x: 0, y: 0,
      facing: 1,
      dead: false,
      color: '#60a5fa',
      r: 16,
      state: 'spawn_idle',
      t: 0,
      q_ang: 0,
      proj: null, // {x,y,vx,vy,dist}
      feintRemaining: 0,
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

    function inRangeForQ() {
      const dx = player.x - e.x; const dy = player.y - e.y;
      return (dx*dx + dy*dy) <= Q_RANGE * Q_RANGE;
    }

    function spawnProjectile() {
      const dx = player.x - e.x; const dy = player.y - e.y;
      const ang = Math.atan2(dy, dx);
      e.q_ang = ang; e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
      const vx = Math.cos(ang) * Q_SPEED;
      const vy = Math.sin(ang) * Q_SPEED;
      e.proj = { x: e.x, y: e.y, vx, vy, dist: 0 };
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
          if (inRangeForQ()) {
            e.feintRemaining = Math.random() * 1.0; // 0..1.0s
            e.state = 'feint';
            e.t = 0;
          }
          break;
        }
        case 'feint': {
          // keep approaching during feint, then cast
          steerTowardsPlayer(dt);
          e.feintRemaining -= dt;
          if (e.feintRemaining <= 0) { e.state = 'Q_cast'; e.t = 0; }
          break;
        }
        case 'Q_cast': {
          if (e.t >= Q_CAST) {
            spawnProjectile();
            e.state = 'Q_fly'; e.t = 0;
          }
          break;
        }
        case 'Q_fly': {
          if (e.proj) {
            const p = e.proj;
            const step = Q_SPEED * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.dist += step;
            const hs = Q_SIZE / 2;
            if (circleIntersectsAABB(player.x, player.y, player.radius, p.x, p.y, hs, hs)) {
              cfg.onDanger && cfg.onDanger();
              e.proj = null;
            }
            if (p.dist >= Q_RANGE) { e.proj = null; }
          }
          if (!e.proj) { e.state = 'Q_after'; e.t = 0; }
          break;
        }
        case 'Q_after': {
          if (e.t >= Q_WAIT) { e.dead = true; }
          break;
        }
      }
    }

    function draw(ctx) {
      if (e.dead) return;

      // Draw projectile if active
      if (e.proj) {
        const p = e.proj; const hs = Q_SIZE / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.translate(p.x, p.y);
        ctx.fillRect(-hs, -hs, Q_SIZE, Q_SIZE);
        ctx.restore();
      }

      // Body
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

  // Katja enemy factory
  // cfg: { METER, player, bounds:{w,h}, onDanger: ()=>void, sprite?: HTMLImageElement }
  Enemies.Katja = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 3.85 * M;
    // Q: projectile
    const Q_CAST = 0.25;
    const Q_WAIT = 0.1;
    const Q_SIZE = 1.2 * M;
    const Q_RANGE = 11.0 * M;
    const Q_SPEED = 26.0 * M;
    // R: trapezoid forward
    const R_RANGE = 23.0 * M;
    const R_CAST = 0.8;
    const R_WAIT = 0.3;
    const R_H = 5.0 * M; // height along facing
    const R_W_NEAR = 3.0 * M; // width at origin (near)
    const R_W_FAR = 6.0 * M;  // width at far end

    const e = {
      name: 'Katja', x: 0, y: 0, facing: 1, dead: false, r: 16,
      color: '#a78bfa',
      state: 'spawn_idle', t: 0,
      // Q
      q_ang: 0, proj: null, q_feint: 0,
      // R
      r_ang: 0, r_ox: 0, r_oy: 0, r_offset: 0, r_center: 0, r_jx: 0, r_jy: 0,
      // plan
      queue: Math.random() < 0.5 ? ['Q','R'] : ['R','Q'],
      usedQ: false, usedR: false,
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

    function inRangeQ() {
      const dx = player.x - e.x; const dy = player.y - e.y;
      return (dx*dx + dy*dy) <= Q_RANGE * Q_RANGE;
    }
    function inRangeR() {
      const dx = player.x - e.x; const dy = player.y - e.y;
      return (dx*dx + dy*dy) <= R_RANGE * R_RANGE;
    }

    function startQ() { e.state = 'Q_cast'; e.t = 0; e.q_ang = Math.atan2(player.y - e.y, player.x - e.x); }
    function startR() {
      e.state = 'R_cast'; e.t = 0;
      e.r_ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.r_ox = e.x; e.r_oy = e.y;
      const ca = Math.cos(e.r_ang), sa = Math.sin(e.r_ang);
      const dx = player.x - e.x, dy = player.y - e.y;
      const proj = (dx * ca + dy * sa); // axis distance to player (signed, forward is +)
      // center distance along axis, clamp to keep trapezoid within [0, R_RANGE]
      e.r_center = Math.max(R_H * 0.5, Math.min(R_RANGE - R_H * 0.5, proj));
      // add world-space jitter: +x/+y in [0, 0.5m]
      const J = 1.0 * M;
      e.r_jx = (Math.random() * 2 - 1) * J; // [-0.5m, +0.5m]
      e.r_jy = (Math.random() * 2 - 1) * J; // [-0.5m, +0.5m]
    }

    function fireQ() {
      const ang = e.q_ang; e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
      const vx = Math.cos(ang) * Q_SPEED;
      const vy = Math.sin(ang) * Q_SPEED;
      e.proj = { x: e.x, y: e.y, vx, vy, dist: 0 };
    }

    function buildRVertsWorld() {
      const ca = Math.cos(e.r_ang), sa = Math.sin(e.r_ang);
      const ux = ca, uy = sa; // axis unit forward
      const px = -sa, py = ca; // perpendicular unit (left)
      const startD = e.r_center - R_H * 0.5;
      const endD   = e.r_center + R_H * 0.5;
      const sx = e.r_ox + ux * startD;
      const sy = e.r_oy + uy * startD;
      const ex = e.r_ox + ux * endD;
      const ey = e.r_oy + uy * endD;
      const nH = R_W_NEAR * 0.5;
      const fH = R_W_FAR * 0.5;
      const jx = e.r_jx || 0, jy = e.r_jy || 0;
      return [
        [sx + px * nH + jx, sy + py * nH + jy], // near-left
        [sx - px * nH + jx, sy - py * nH + jy], // near-right
        [ex - px * fH + jx, ey - py * fH + jy], // far-right
        [ex + px * fH + jx, ey + py * fH + jy], // far-left
      ];
    }

    function applyRHit() {
      const wverts = buildRVertsWorld();
      if (circleIntersectsPolygon(player.x, player.y, player.radius, wverts)) {
        cfg.onDanger && cfg.onDanger();
      }
    }

    function afterSkill() {
      e.queue.shift();
      if (e.queue.length === 0) { e.dead = true; return; }
      e.state = 'move'; e.t = 0;
    }

    function update(dt) {
      if (e.dead) return;
      e.t += dt;
      switch (e.state) {
        case 'spawn_idle': { if (e.t >= 1.0) { e.state = 'move'; e.t = 0; } break; }
        case 'move': {
          steerTowardsPlayer(dt);
          const next = e.queue[0];
          if (next === 'Q' && inRangeQ()) { e.q_feint = Math.random() * 1.0; e.state = 'Q_feint'; e.t = 0; }
          else if (next === 'R' && inRangeR()) startR();
          break;
        }
        case 'Q_feint': {
          steerTowardsPlayer(dt);
          e.q_feint -= dt;
          if (e.q_feint <= 0) startQ();
          break;
        }
        case 'Q_cast': {
          if (e.t >= Q_CAST) { fireQ(); e.state = 'Q_fly'; e.t = 0; }
          break;
        }
        case 'Q_fly': {
          if (e.proj) {
            const p = e.proj; const step = Q_SPEED * dt; const hs = Q_SIZE/2;
            p.x += p.vx * dt; p.y += p.vy * dt; p.dist += step;
            if (circleIntersectsAABB(player.x, player.y, player.radius, p.x, p.y, hs, hs)) { cfg.onDanger && cfg.onDanger(); e.proj = null; }
            if (p.dist >= Q_RANGE) e.proj = null;
          }
          if (!e.proj) { e.state = 'Q_wait'; e.t = 0; }
          break;
        }
        case 'Q_wait': { if (e.t >= Q_WAIT) { e.usedQ = true; afterSkill(); } break; }
        case 'R_cast': { if (e.t >= R_CAST) { applyRHit(); e.state = 'R_wait'; e.t = 0; } break; }
        case 'R_wait': { if (e.t >= R_WAIT) { e.usedR = true; afterSkill(); } break; }
      }
    }

    function draw(ctx) {
      if (e.dead) return;

      // Telegraphs
      if (e.state === 'Q_cast') {
        // preview projectile path as a thin rectangle centered on facing axis
        const w = Q_SIZE, l = Q_RANGE;
        const ca = Math.cos(e.q_ang), sa = Math.sin(e.q_ang);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.q_ang);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(0, -w/2, l, w);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (e.state === 'R_cast') {
        const wv = buildRVertsWorld();
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wv[0][0], wv[0][1]);
        for (let i = 1; i < wv.length; i++) ctx.lineTo(wv[i][0], wv[i][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Projectile
      if (e.proj) {
        const p = e.proj; const hs = Q_SIZE/2;
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.translate(p.x, p.y);
        ctx.fillRect(-hs, -hs, Q_SIZE, Q_SIZE);
        ctx.restore();
      }

      // Body (sprite or circle)
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

  // Darko enemy factory
  // cfg: { METER, player, bounds:{w,h}, onDanger: ()=>void, sprite?: HTMLImageElement }
  Enemies.Darko = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 3.9 * M;
    // E skill params
    const E_CAST = 0.6;
    const E_WAIT = 0.1;
    const E_MOVE = 4.0 * M;
    const E_AOE_R = 2.2 * M;
    const E_RANGE = 6.2 * M; // trigger range

    const e = {
      name: 'Darko', x: 0, y: 0, facing: 1, dead: false, r: 16,
      color: '#94a3b8',
      state: 'spawn_idle', t: 0,
      e_ang: 0, tx: 0, ty: 0, // target dash destination
      e_feint: 0,
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

    function inRangeE() {
      const dx = player.x - e.x; const dy = player.y - e.y;
      return (dx*dx + dy*dy) <= E_RANGE * E_RANGE;
    }

    function startE() {
      e.state = 'E_cast'; e.t = 0;
      e.e_ang = Math.atan2(player.y - e.y, player.x - e.x);
      const ux = Math.cos(e.e_ang), uy = Math.sin(e.e_ang);
      let tx = e.x + ux * E_MOVE;
      let ty = e.y + uy * E_MOVE;
      // clamp inside bounds a bit (leave margin by radius)
      const m = 4;
      tx = Math.max(m, Math.min(W - m, tx));
      ty = Math.max(m, Math.min(H - m, ty));
      e.tx = tx; e.ty = ty;
    }

    function resolveE() {
      // teleport/move to target and apply hit
      e.x = e.tx; e.y = e.ty;
      const dx = player.x - e.x; const dy = player.y - e.y;
      const rr = (player.radius + E_AOE_R);
      if (dx*dx + dy*dy <= rr*rr) { cfg.onDanger && cfg.onDanger(); }
      e.state = 'E_wait'; e.t = 0;
    }

    function update(dt) {
      if (e.dead) return;
      e.t += dt;
      switch (e.state) {
        case 'spawn_idle': { if (e.t >= 1.0) { e.state = 'move'; e.t = 0; } break; }
        case 'move': {
          steerTowardsPlayer(dt);
          if (inRangeE()) { e.e_feint = Math.random() * 0.5; e.state = 'E_feint'; e.t = 0; }
          break;
        }
        case 'E_feint': {
          steerTowardsPlayer(dt);
          e.e_feint -= dt;
          if (e.e_feint <= 0) startE();
          break;
        }
        case 'E_cast': {
          if (e.t >= E_CAST) resolveE();
          break;
        }
        case 'E_wait': {
          if (e.t >= E_WAIT) { e.dead = true; }
          break;
        }
      }
    }

    function draw(ctx) {
      if (e.dead) return;
      // Telegraph during cast: preview destination AOE
      if (e.state === 'E_cast') {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.tx, e.ty, E_AOE_R, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // Body (sprite or circle)
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
