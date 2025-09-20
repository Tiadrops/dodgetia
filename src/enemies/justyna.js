// Justyna enemy implementation
(function(){
  window.Enemies = window.Enemies || {};

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  function circleIntersectsRotRect(cx, cy, cr, rx, ry, len, wid, ang) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const tx = cx - rx, ty = cy - ry;
    const lx =  (tx * ca + ty * sa);
    const ly = -(tx * sa - ty * ca);
    const nx = clamp(lx, 0, len);
    const ny = clamp(ly, -wid * 0.5, wid * 0.5);
    const dx = lx - nx, dy = ly - ny;
    return (dx * dx + dy * dy) <= cr * cr;
  }

  window.Enemies.Justyna = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const SPEED = 3.94 * M;

    const W_CAST = 0.40;
    const W_RANGE = 6.5 * M;
    const W_RADIUS = 2.0 * M;

    const Q1_CAST = 0.40;
    const Q1_LEN = 6.25 * M;
    const Q1_WIDTH = 1.8 * M;
    const Q1_TRIG = 6.4 * M;

    const Q2_CAST = 0.70;
    const Q2_LEN = 7.0 * M;
    const Q2_WIDTH = 1.5 * M;
    const Q2_TRIG = 7.2 * M;
    const Q2_WINDOW = 3.0;
    const Q2_LOCK = 0.40;

    const E_DIST = 2.5 * M;
    const E_TIME = 0.26;
    const E_SPEED = E_DIST / E_TIME;
    const E_COOLDOWN = 2.0;

    const R_CAST = 0.50;
    const R_DELAY = 0.125;
    const R_PULSES = 8;
    const R_RADIUS = 3.0 * M;
    const R_MAX_OFFSET = 6.0 * M;
    const R_TRIGGER = R_MAX_OFFSET + R_RADIUS;
    const R_SPEED_FACTOR = 0.60;

    const PAD = 40;

    const e = {
      name: 'Justyna',
      x: 0, y: 0, r: 16,
      color: '#f87171',
      facing: 1,
      state: 'spawn_idle',
      t: 0,
      dead: false,
      queue: ['W','Q1','Q2','R'],
      qRect: null,
      wTele: null,
      rTele: null,
      q2Window: 0,
      q2Lock: 0,
      eCd: 0,
      dash: null,
      qAng: 0,
      wFlash: 0,
      r_active: false,
      rHits: 0,
      rTimer: 0,
    };

    (function spawn(){
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { e.x = PAD; e.y = Math.random() * (H - PAD * 2) + PAD; }
      if (side === 1) { e.x = W - PAD; e.y = Math.random() * (H - PAD * 2) + PAD; }
      if (side === 2) { e.x = Math.random() * (W - PAD * 2) + PAD; e.y = PAD; }
      if (side === 3) { e.x = Math.random() * (W - PAD * 2) + PAD; e.y = H - PAD; }
    })();

    function currentSpeedFactor(){ return e.r_active ? R_SPEED_FACTOR : 1; }

    function steerTowardsPlayer(dt, factor = 1){
      if (e.dash) return;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = SPEED * factor;
      e.x += (dx / d) * speed * dt;
      e.y += (dy / d) * speed * dt;
      e.facing = (dx >= 0) ? 1 : -1;
      e.x = clamp(e.x, 0, W);
      e.y = clamp(e.y, 0, H);
    }

    function updateDash(dt){
      if (!e.dash) return;
      const move = Math.min(e.dash.speed * dt, e.dash.remain);
      if (move <= 0) return;
      const nx = clamp(e.x + e.dash.ux * move, 0, W);
      const ny = clamp(e.y + e.dash.uy * move, 0, H);
      const actual = Math.hypot(nx - e.x, ny - e.y);
      e.x = nx;
      e.y = ny;
      e.facing = (e.dash.ux >= 0) ? 1 : -1;
      if (actual <= 0.0001) {
        e.dash = null;
        return;
      }
      e.dash.remain = Math.max(0, e.dash.remain - actual);
      if (e.dash.remain <= 0.0001) e.dash = null;
    }

    function canUseE(){ return !e.r_active && !e.dash && e.eCd <= 0; }

    function startDash(angle){
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      e.dash = { ux, uy, speed: E_SPEED, remain: E_DIST };
      e.eCd = E_COOLDOWN;
      e.facing = (ux >= 0) ? 1 : -1;
    }

    function computeDashAlignment(proj, perp, dist, len, wid){
      const margin = wid * 0.5 + player.radius + 12;
      const behind = proj < -0.5 * M;
      const farAhead = proj > len + 0.6 * M;
      const lateral = Math.abs(perp) > margin;
      const tooFar = dist > len + E_DIST * 0.6;

      let targetProjMin = 0.35 * M;
      let targetProjMax = len - 0.35 * M;
      if (targetProjMax < targetProjMin) targetProjMax = targetProjMin;
      if (behind) targetProjMin = 0;
      if (farAhead || tooFar) targetProjMax = len;
      const targetProj = clamp(proj, targetProjMin, targetProjMax);

      const softPerpRange = Math.min(margin * 0.6, Math.max(player.radius + 0.35 * M, wid * 0.35));
      let targetPerp = clamp(perp, -softPerpRange, softPerpRange);
      if (lateral) {
        const hardLimit = Math.max(softPerpRange, margin - 0.15 * M);
        targetPerp = clamp(perp, -hardLimit, hardLimit);
      }

      return { targetProj, targetPerp, margin, behind, farAhead, lateral, tooFar };
    }

    function maybeTriggerEFor(type, ang){
      if (!canUseE()) return;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.5 * M) return;
      const len = (type === 'Q2') ? Q2_LEN : Q1_LEN;
      const wid = (type === 'Q2') ? Q2_WIDTH : Q1_WIDTH;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const proj = dx * ca + dy * sa;
      const perp = -dx * sa + dy * ca;
      const params = computeDashAlignment(proj, perp, dist, len, wid);
      const shiftLocalX = proj - params.targetProj;
      const shiftLocalY = perp - params.targetPerp;
      const shiftDist = Math.hypot(shiftLocalX, shiftLocalY);

      const triggeredByShift = shiftDist > 0.45 * M;
      const shouldDash = params.behind || params.farAhead || params.lateral || params.tooFar || triggeredByShift;
      if (!shouldDash) return;

      const moveX = shiftLocalX * ca - shiftLocalY * sa;
      const moveY = shiftLocalX * sa + shiftLocalY * ca;

      const candidates = [];
      if (Math.hypot(moveX, moveY) > 0.0001) candidates.push({ vx: moveX, vy: moveY });
      candidates.push({ vx: dx, vy: dy });
      if (params.behind || params.farAhead || triggeredByShift) {
        candidates.push({ vx: ca, vy: sa });
      }
      if (params.lateral) {
        const lateralSign = (perp >= 0) ? 1 : -1;
        candidates.push({ vx: -sa * lateralSign, vy: ca * lateralSign });
      }
      candidates.push({ vx: moveX * 0.7 + dx * 0.3, vy: moveY * 0.7 + dy * 0.3 });

      function evaluateCandidate(vec){
        const mag = Math.hypot(vec.vx, vec.vy);
        if (mag <= 0.0001) return null;
        const ux = vec.vx / mag;
        const uy = vec.vy / mag;
        const nx = clamp(e.x + ux * E_DIST, 0, W);
        const ny = clamp(e.y + uy * E_DIST, 0, H);
        const actual = Math.hypot(nx - e.x, ny - e.y);
        if (actual <= 0.0001) return null;
        const pdx = player.x - nx;
        const pdy = player.y - ny;
        const newDist = Math.hypot(pdx, pdy);
        const newProj = pdx * ca + pdy * sa;
        const newPerp = -pdx * sa + pdy * ca;
        const post = computeDashAlignment(newProj, newPerp, newDist, len, wid);
        const newShiftX = newProj - post.targetProj;
        const newShiftY = newPerp - post.targetPerp;
        const newShiftDist = Math.hypot(newShiftX, newShiftY);
        const improvement = shiftDist - newShiftDist;
        const resolvedCount =
          (params.behind && !post.behind ? 1 : 0) +
          (params.farAhead && !post.farAhead ? 1 : 0) +
          (params.lateral && !post.lateral ? 1 : 0) +
          (params.tooFar && !post.tooFar ? 1 : 0) +
          (triggeredByShift && improvement > 0 ? 1 : 0);
        const resolved = resolvedCount > 0;
        const improved = improvement > 0.08 * M || (shiftDist > 0 && newShiftDist < shiftDist * 0.7) || newShiftDist < 0.32 * M;
        if (!resolved && !improved) return null;
        const penalty =
          (post.behind ? 0.30 * M : 0) +
          (post.farAhead ? 0.24 * M : 0) +
          (post.lateral ? 0.20 * M : 0) +
          (post.tooFar ? 0.18 * M : 0);
        const reward = resolvedCount * 0.08 * M + Math.max(0, improvement) * 0.1;
        const score = newShiftDist + penalty - reward;
        return {
          angle: Math.atan2(uy, ux),
          newShiftDist,
          improvement,
          resolvedCount,
          score,
        };
      }

      let best = null;
      for (const candidate of candidates) {
        const result = evaluateCandidate(candidate);
        if (!result) continue;
        if (!best || result.score < best.score - 0.02 * M ||
            (Math.abs(result.score - best.score) <= 0.02 * M &&
             (result.newShiftDist < best.newShiftDist - 0.01 * M ||
              (Math.abs(result.newShiftDist - best.newShiftDist) <= 0.01 * M && result.improvement > best.improvement)))) {
          best = result;
        }
      }

      if (!best) return;
      startDash(best.angle);
    }

    function afterSkill(){
      e.queue.shift();
      if (e.queue.length === 0) {
        e.dead = true;
        return;
      }
      e.state = 'move';
      e.t = 0;
    }

    function applyRectHit(len, wid, ang){
      if (circleIntersectsRotRect(player.x, player.y, player.radius, e.x, e.y, len, wid, ang)) {
        if (cfg.onCaution) cfg.onCaution(); else if (cfg.onDanger) cfg.onDanger();
      }
      if (e.qRect) e.qRect.flash = 0.12;
    }

    function startQ1(){
      e.state = 'Q1_cast1';
      e.t = 0;
      e.qAng = Math.atan2(player.y - e.y, player.x - e.x);
      e.qRect = { len: Q1_LEN, wid: Q1_WIDTH, ang: e.qAng, flash: 0, dissolve: false };
    }

    function startQ2(){
      e.state = 'Q2_cast';
      e.t = 0;
      e.qAng = Math.atan2(player.y - e.y, player.x - e.x);
      e.qRect = { len: Q2_LEN, wid: Q2_WIDTH, ang: e.qAng, flash: 0, dissolve: false };
    }

    function finishQ1(){
      if (e.qRect) e.qRect.dissolve = true;
      e.q2Window = Q2_WINDOW;
      e.q2Lock = Q2_LOCK;
      afterSkill();
    }

    function finishQ2(){
      if (e.qRect) e.qRect.dissolve = true;
      e.q2Window = 0;
      afterSkill();
    }

    function startW(){
      e.state = 'W_cast';
      e.t = 0;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(dist, W_RANGE);
      const ang = Math.atan2(dy, dx);
      const cx = e.x + Math.cos(ang) * reach;
      const cy = e.y + Math.sin(ang) * reach;
      e.wTele = { x: clamp(cx, 0, W), y: clamp(cy, 0, H), dissolve: false };
      e.wFlash = 0;
    }

    function applyW(){
      if (e.wTele) {
        const dx = player.x - e.wTele.x;
        const dy = player.y - e.wTele.y;
        const rr = W_RADIUS + player.radius;
        if (dx * dx + dy * dy <= rr * rr) {
          if (cfg.onCaution) cfg.onCaution(); else if (cfg.onDanger) cfg.onDanger();
        }
        e.wTele.dissolve = true;
        e.wFlash = 0.18;
      }
      afterSkill();
    }

    function startR(){
      e.state = 'R_cast';
      e.t = 0;
      e.r_active = true;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(dist, R_MAX_OFFSET);
      const ang = Math.atan2(dy, dx);
      const cx = clamp(e.x + Math.cos(ang) * reach, 0, W);
      const cy = clamp(e.y + Math.sin(ang) * reach, 0, H);
      e.rTele = { x: cx, y: cy, flash: 0, dissolve: false };
      e.rHits = R_PULSES;
      e.rTimer = R_DELAY;
    }

    function applyRHit(){
      if (e.rTele) {
        const cx = clamp(e.rTele.x, 0, W);
        const cy = clamp(e.rTele.y, 0, H);
        const rr = R_RADIUS + player.radius;
        const dx = player.x - cx;
        const dy = player.y - cy;
        if (dx * dx + dy * dy <= rr * rr) {
          if (cfg.onCaution) cfg.onCaution(); else if (cfg.onDanger) cfg.onDanger();
        }
        e.rTele.flash = 0.12;
      }
    }

    function purgeTelegraphs(dt){
      if (e.qRect) {
        e.qRect.flash = Math.max(0, e.qRect.flash - dt);
        const active = (e.state === 'Q1_cast1' || e.state === 'Q1_cast2' || e.state === 'Q2_cast');
        if (!active && e.qRect.dissolve && e.qRect.flash <= 0) e.qRect = null;
      }
      if (e.wFlash > 0) e.wFlash = Math.max(0, e.wFlash - dt);
      if (e.wTele) {
        if (e.wTele.dissolve && e.wFlash <= 0 && e.state !== 'W_cast') e.wTele = null;
      }
      if (e.rTele) {
        e.rTele.flash = Math.max(0, e.rTele.flash - dt);
        const active = (e.state === 'R_cast' || e.state === 'R_channel');
        if (!active && e.rTele.dissolve && e.rTele.flash <= 0) e.rTele = null;
      }
    }

    function ensureQ2Queue(){
      while (e.queue.length && e.queue[0] === 'Q2' && e.q2Window <= 0) {
        e.queue.shift();
      }
      if (e.queue.length === 0) {
        e.dead = true;
      }
    }

    function update(dt){
      if (e.dead) return;
      e.t += dt;
      e.eCd = Math.max(0, e.eCd - dt);
      e.q2Lock = Math.max(0, e.q2Lock - dt);
      e.q2Window = Math.max(0, e.q2Window - dt);
      updateDash(dt);
      purgeTelegraphs(dt);

      switch (e.state) {
        case 'spawn_idle': {
          if (e.t >= 1.0) { e.state = 'move'; e.t = 0; }
          break;
        }
        case 'move': {
          ensureQ2Queue();
          if (e.dead) break;
          const next = e.queue[0];
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const dist = Math.hypot(dx, dy);
          if (next === 'Q1') {
            maybeTriggerEFor('Q1', Math.atan2(dy, dx));
          } else if (next === 'Q2' && e.q2Lock <= 0 && e.q2Window > 0) {
            maybeTriggerEFor('Q2', Math.atan2(dy, dx));
          }
          steerTowardsPlayer(dt, currentSpeedFactor());
          if (next === 'W') {
            if (dist <= W_RANGE + 15) startW();
          } else if (next === 'Q1') {
            if (dist <= Q1_TRIG) startQ1();
          } else if (next === 'Q2') {
            if (e.q2Lock <= 0 && e.q2Window > 0 && dist <= Q2_TRIG) startQ2();
          } else if (next === 'R') {
            if (dist <= R_TRIGGER) startR();
          }
          break;
        }
        case 'W_cast': {
          steerTowardsPlayer(dt, currentSpeedFactor());
          if (e.t >= W_CAST) { applyW(); }
          break;
        }
        case 'Q1_cast1': {
          if (e.qRect) maybeTriggerEFor('Q1', e.qRect.ang);
          steerTowardsPlayer(dt, currentSpeedFactor());
          if (e.t >= Q1_CAST) {
            e.t = 0;
            applyRectHit(Q1_LEN, Q1_WIDTH, e.qAng);
            e.state = 'Q1_cast2';
          }
          break;
        }
        case 'Q1_cast2': {
          if (e.qRect) maybeTriggerEFor('Q1', e.qRect.ang);
          steerTowardsPlayer(dt, currentSpeedFactor());
          if (e.t >= Q1_CAST) {
            applyRectHit(Q1_LEN, Q1_WIDTH, e.qAng);
            finishQ1();
          }
          break;
        }
        case 'Q2_cast': {
          if (e.qRect) maybeTriggerEFor('Q2', e.qRect.ang);
          steerTowardsPlayer(dt, currentSpeedFactor());
          if (e.t >= Q2_CAST) {
            applyRectHit(Q2_LEN, Q2_WIDTH, e.qAng);
            finishQ2();
          }
          break;
        }
        case 'R_cast': {
          steerTowardsPlayer(dt, currentSpeedFactor());
          if (e.t >= R_CAST) {
            e.state = 'R_channel';
            e.t = 0;
          }
          break;
        }
        case 'R_channel': {
          steerTowardsPlayer(dt, currentSpeedFactor());
          e.rTimer -= dt;
          if (e.rTimer <= 0 && e.rHits > 0) {
            applyRHit();
            e.rHits -= 1;
            e.rTimer += R_DELAY;
            if (e.rHits <= 0) {
              if (e.rTele) e.rTele.dissolve = true;
              e.r_active = false;
              afterSkill();
            }
          }
          break;
        }
      }
    }

    function drawRectTelegraph(ctx){
      if (!e.qRect) return;
      const active = (e.state === 'Q1_cast1' || e.state === 'Q1_cast2' || e.state === 'Q2_cast');
      if (!active && e.qRect.flash <= 0) return;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.qRect.ang);
      const flash = e.qRect.flash > 0;
      ctx.globalAlpha = flash ? 0.6 : 0.35;
      ctx.fillStyle = flash ? 'rgba(234,179,8,0.45)' : 'rgba(234,179,8,0.25)';
      ctx.strokeStyle = flash ? 'rgba(234,179,8,1.0)' : 'rgba(234,179,8,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(0, -e.qRect.wid * 0.5, e.qRect.len, e.qRect.wid);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function drawWTel(ctx){
      if (!e.wTele) return;
      const active = (e.state === 'W_cast');
      if (!active && e.wFlash <= 0) return;
      const flash = e.wFlash > 0;
      ctx.save();
      ctx.globalAlpha = flash ? 0.6 : 0.35;
      ctx.fillStyle = flash ? 'rgba(234,179,8,0.45)' : 'rgba(234,179,8,0.25)';
      ctx.strokeStyle = flash ? 'rgba(234,179,8,1.0)' : 'rgba(234,179,8,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.wTele.x, e.wTele.y, W_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function drawRTel(ctx){
      if (!e.rTele) return;
      const active = (e.state === 'R_cast' || e.state === 'R_channel');
      if (!active && e.rTele.flash <= 0) return;
      const cx = clamp(e.rTele.x, 0, W);
      const cy = clamp(e.rTele.y, 0, H);
      const flash = e.rTele.flash > 0;
      ctx.save();
      ctx.globalAlpha = flash ? 0.55 : 0.35;
      ctx.fillStyle = flash ? 'rgba(234,179,8,0.45)' : 'rgba(234,179,8,0.25)';
      ctx.strokeStyle = flash ? 'rgba(234,179,8,1.0)' : 'rgba(234,179,8,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R_RADIUS, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function draw(ctx){
      if (e.dead) return;
      drawRectTelegraph(ctx);
      drawWTel(ctx);
      drawRTel(ctx);

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
        ctx.arc(e.x, e.y, e.r, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e: e };
  };
})();
