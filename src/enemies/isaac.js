(function(){
  window.Enemies = window.Enemies || {};

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function circleIntersectsRotRect(cx, cy, r, rx, ry, len, wid, ang) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tx = cx - rx, ty = cy - ry;
    const lx = tx * ca + ty * sa;
    const ly = -tx * sa + ty * ca;
    const nx = clamp(lx, 0, len);
    const ny = clamp(ly, -wid * 0.5, wid * 0.5);
    const dx = lx - nx, dy = ly - ny;
    return (dx * dx + dy * dy) <= r * r;
  }

  window.Enemies.Isaac = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w;
    const H = cfg.bounds.h;

    const MOVE_SPEED = 3.85 * M;

    const E_TRIGGER_RANGE = 7.0 * M;

    const E1_TIME = 0.2;
    const E1_DIST = 3.0 * M;
    const E1_SPEED = E1_DIST / Math.max(E1_TIME, 0.0001);

    const E2_FEINT_MAX = 0.25;
    const E2_CAST = 0.4;
    const E2_LENGTH = 5.0 * M;
    const E2_WIDTH = 2.0 * M;
    const E2_POST = 0.35;

    const R_TRIGGER_RANGE = 7.5 * M;
    const R_CAST = 0.5;
    const R_RANGE = 4.0 * M;
    const R_RADIUS = 2.5 * M;
    const R_POST = 0.35;

    const DANGER_FILL = 'rgba(239,68,68,0.25)';
    const DANGER_STROKE = 'rgba(239,68,68,0.9)';
    const CAUTION_FILL = 'rgba(234,179,8,0.25)';
    const CAUTION_STROKE = 'rgba(234,179,8,0.9)';

    const e = {
      name: 'Isaac',
      x: 0,
      y: 0,
      facing: 1,
      r: 16,
      color: '#ef4444',
      dead: false,
      state: 'spawn_idle',
      t: 0,
      forceTimer: 0,
      queue: ['Ecombo', 'R'],
      // E1
      e1_ang: 0,
      e1_travel: 0,
      // E2
      e2_ang: 0,
      e2_ox: 0,
      e2_oy: 0,
      e2_feint: 0,
      // R
      r_tx: 0,
      r_ty: 0,
    };

    (function spawn(){
      const pad = 40;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { e.x = pad; e.y = Math.random() * (H - pad * 2) + pad; }
      if (side === 1) { e.x = W - pad; e.y = Math.random() * (H - pad * 2) + pad; }
      if (side === 2) { e.x = Math.random() * (W - pad * 2) + pad; e.y = pad; }
      if (side === 3) { e.x = Math.random() * (W - pad * 2) + pad; e.y = H - pad; }
    })();

    function steerTowardsPlayer(dt) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const vx = (dx / dist) * MOVE_SPEED;
      const vy = (dy / dist) * MOVE_SPEED;
      e.x += vx * dt;
      e.y += vy * dt;
      e.facing = (dx >= 0) ? 1 : -1;
      e.x = clamp(e.x, 0, W);
      e.y = clamp(e.y, 0, H);
    }

    function afterSkill() {
      e.queue.shift();
      if (e.queue.length === 0) {
        e.dead = true;
        return;
      }
      e.state = 'move';
      e.t = 0;
      e.forceTimer = 0;
    }

    function startE1() {
      e.state = 'E1_dash';
      e.t = 0;
      const ang = Math.atan2(player.y - e.y, player.x - e.x) || 0;
      e.e1_ang = ang;
      e.e1_travel = 0;
      e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
      e.forceTimer = 0;
    }

    function startE2Feint() {
      e.state = 'E2_feint';
      e.t = 0;
      e.e2_feint = Math.random() * E2_FEINT_MAX;
    }

    function updateE1(dt) {
      const remain = Math.max(0, E1_DIST - e.e1_travel);
      if (remain <= 0 || e.t >= E1_TIME) {
        startE2Feint();
        return;
      }
      const step = Math.min(remain, E1_SPEED * dt);
      const ux = Math.cos(e.e1_ang);
      const uy = Math.sin(e.e1_ang);
      e.x = clamp(e.x + ux * step, 0, W);
      e.y = clamp(e.y + uy * step, 0, H);
      e.e1_travel += step;
      if (e.e1_travel >= E1_DIST - 0.01 || e.t >= E1_TIME) {
        startE2Feint();
        return;
      }
    }

    function startE2() {
      e.state = 'E2_cast';
      e.t = 0;
      const ang = Math.atan2(player.y - e.y, player.x - e.x) || 0;
      e.e2_ang = ang;
      e.e2_ox = e.x;
      e.e2_oy = e.y;
      e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
    }

    function resolveE2() {
      const hit = circleIntersectsRotRect(
        player.x,
        player.y,
        player.radius,
        e.e2_ox,
        e.e2_oy,
        E2_LENGTH,
        E2_WIDTH,
        e.e2_ang
      );
      if (hit && cfg.onDanger) cfg.onDanger();
      e.state = 'E2_post';
      e.t = 0;
    }

    function startR() {
      e.state = 'R_cast';
      e.t = 0;
      e.forceTimer = 0;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0.0001) {
        e.r_tx = clamp(e.x + R_RANGE, 0, W);
        e.r_ty = clamp(e.y, 0, H);
      } else if (dist <= R_RANGE) {
        e.r_tx = clamp(player.x, 0, W);
        e.r_ty = clamp(player.y, 0, H);
      } else {
        const ux = dx / dist;
        const uy = dy / dist;
        e.r_tx = clamp(e.x + ux * R_RANGE, 0, W);
        e.r_ty = clamp(e.y + uy * R_RANGE, 0, H);
      }
      const margin = 6;
      e.r_tx = clamp(e.r_tx, margin, W - margin);
      e.r_ty = clamp(e.r_ty, margin, H - margin);
    }

    function resolveR() {
      const dx = player.x - e.r_tx;
      const dy = player.y - e.r_ty;
      const rr = player.radius + R_RADIUS;
      if ((dx * dx + dy * dy) <= rr * rr) {
        if (cfg.onCaution) cfg.onCaution();
      }
      e.x = e.r_tx;
      e.y = e.r_ty;
      const fdx = player.x - e.x;
      e.facing = (fdx >= 0) ? 1 : -1;
      e.state = 'R_post';
      e.t = 0;
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
          e.forceTimer += dt;
          steerTowardsPlayer(dt);
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const d = Math.hypot(dx, dy);
          const next = e.queue[0];
          if (next === 'Ecombo') {
            if (d <= E_TRIGGER_RANGE || e.forceTimer >= 2.0) {
              startE1();
            }
          } else if (next === 'R') {
            if (d <= R_TRIGGER_RANGE || e.forceTimer >= 2.0) {
              startR();
            }
          }
          break;
        }
        case 'E1_dash': {
          updateE1(dt);
          break;
        }
        case 'E2_feint': {
          e.facing = (player.x - e.x >= 0) ? 1 : -1;
          if (e.t >= e.e2_feint) {
            startE2();
          }
          break;
        }
        case 'E2_cast': {
          if (e.t >= E2_CAST) {
            resolveE2();
          }
          break;
        }
        case 'E2_post': {
          if (e.t >= E2_POST) {
            afterSkill();
          }
          break;
        }
        case 'R_cast': {
          if (e.t >= R_CAST) {
            resolveR();
          }
          break;
        }
        case 'R_post': {
          if (e.t >= R_POST) {
            afterSkill();
          }
          break;
        }
      }
    }

    function draw(ctx) {
      if (e.dead) return;

      if (e.state === 'E2_cast') {
        ctx.save();
        ctx.translate(e.e2_ox, e.e2_oy);
        ctx.rotate(e.e2_ang);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = DANGER_FILL;
        ctx.strokeStyle = DANGER_STROKE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(0, -E2_WIDTH / 2, E2_LENGTH, E2_WIDTH);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      if (e.state === 'R_cast') {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = CAUTION_FILL;
        ctx.strokeStyle = CAUTION_STROKE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.r_tx, e.r_ty, R_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      if (cfg.sprite) {
        const iw = cfg.sprite.naturalWidth || cfg.sprite.width || 55;
        const ih = cfg.sprite.naturalHeight || cfg.sprite.height || 73;
        const scale = 1.3;
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = Math.round(e.x - dw / 2);
        const dy = Math.round(e.y - dh + 10);
        ctx.save();
        if (e.facing < 0) {
          ctx.translate(Math.round(e.x), 0);
          ctx.scale(-1, 1);
          ctx.drawImage(cfg.sprite, Math.round(-dw / 2), dy, dw, dh);
        } else {
          ctx.drawImage(cfg.sprite, dx, dy, dw, dh);
        }
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    return {
      get dead() { return e.dead; },
      update,
      draw,
      _e: e,
    };
  };
})();