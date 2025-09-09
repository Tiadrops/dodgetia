(function(){
  // Ensure registry
  window.Enemies = window.Enemies || {};

  // Vanya enemy factory
  // cfg: { METER, player, bounds:{w,h}, onDanger: ()=>void, sprite?: HTMLImageElement }
  window.Enemies.Vanya = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    // Feint trigger distance thresholds
    const VQ = 8.3 * M; const VQ2 = VQ * VQ;
    const VE = 7.0 * M; const VE2 = VE * VE;
    const VR = 6.7 * M; const VR2 = VR * VR;

    // Q projectile
    const Q_CAST = 0.25;
    const Q_OUT_RANGE = 7.5 * M;
    const Q_OUT_SPEED = 10.6 * M;
    const Q_BACK_SPEED = 11.0 * M;
    const Q_R = 0.8 * M;
    // E dash
    const E_CAST = 0.3;
    const E_WIDTH = 3.8 * M;
    const E_DIST = 7.0 * M;
    const E_SPEED = 11.2 * M;
    const E_WAIT = 0.01;
    // R telegraph-then-hit (rectangles front/back centered on Vanya)
    const R_CAST = 0.26;
    const R_T_DELAY = 1.0; // telegraph to hit delay
    const R_LEN_FRONT = 6.7 * M;
    const R_LEN_BACK = 0.5 * M;
    const R_WIDTH = 5.4 * M;

    const speedPx = 3.85 * M;

    const e = {
      name: 'Vanya', x: 0, y: 0, facing: 1, dead: false, r: 16,
      color: '#22d3ee',
      state: 'spawn_idle', t: 0,
      // Q
      q_ang: 0, qProj: null, vq_feint: 0,
      // E
      e_ang: 0, ex: 0, ey: 0, esx: 0, esy: 0, edist: 0, ve_feint: 0,
      // R
      r_ang: 0, r_ox: 0, r_oy: 0, r_center: 0, tele: [], vr_feint: 0, r_blockLast: false,
      // plan: use once in either Q>E>R or E>R>Q
      queue: (Math.random() < 0.5) ? ['Q','E','R'] : ['E','R','Q'],
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

    // Q
    function startQ() { e.state = 'Q_cast'; e.t = 0; e.q_ang = Math.atan2(player.y - e.y, player.x - e.x); }
    function fireQ() {
      const ang = e.q_ang; const vx = Math.cos(ang) * Q_OUT_SPEED; const vy = Math.sin(ang) * Q_OUT_SPEED;
      e.qProj = { x: e.x, y: e.y, vx, vy, phase: 'out', sx: e.x, sy: e.y };
      // move out of cast state to avoid refiring
      e.state = 'Q_fly'; e.t = 0;
      // If Q is the last skill in the queue, delay completion until projectile finishes
      e.q_blockLast = (e.queue.length <= 1);
      if (!e.q_blockLast) {
        // allow next action immediately
        afterSkill();
      }
    }
    function updateQ(dt) {
      const p = e.qProj; if (!p) return;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const dx = player.x - p.x, dy = player.y - p.y; const rr = (player.radius + Q_R);
      if (dx*dx + dy*dy <= rr*rr) {
        cfg.onDanger && cfg.onDanger();
        e.qProj = null;
        if (e.q_blockLast) { e.q_blockLast = false; afterSkill(); }
        return;
      }
      const traveled = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (p.phase === 'out' && traveled >= Q_OUT_RANGE) {
        const bx = e.x - p.x, by = e.y - p.y; const d = Math.hypot(bx, by) || 1;
        p.vx = (bx / d) * Q_BACK_SPEED; p.vy = (by / d) * Q_BACK_SPEED;
        p.phase = 'back'; p.sx = p.x; p.sy = p.y;
      } else if (p.phase === 'back' && traveled >= Q_OUT_RANGE) {
        e.qProj = null;
        if (e.q_blockLast) { e.q_blockLast = false; afterSkill(); }
      }
    }

    // E
    function startE() { e.state = 'E_cast'; e.t = 0; e.e_ang = Math.atan2(player.y - e.y, player.x - e.x); e.esx = e.x; e.esy = e.y; e.ex = e.x + Math.cos(e.e_ang)*E_DIST; e.ey = e.y + Math.sin(e.e_ang)*E_DIST; e.edist = 0; }
    function updateEDash(dt) {
      const ux = Math.cos(e.e_ang), uy = Math.sin(e.e_ang);
      const step = E_SPEED * dt; const remain = E_DIST - e.edist; const move = Math.min(step, remain);
      e.x += ux * move; e.y += uy * move; e.edist += move; e.facing = (ux >= 0) ? 1 : -1;
      // hit as swept width
      const dx = player.x - e.esx, dy = player.y - e.esy;
      const proj = dx * ux + dy * uy;
      const perp = Math.abs(-dx * uy + dy * ux);
      if (proj >= 0 && proj <= e.edist && perp <= (E_WIDTH * 0.5 + player.radius)) cfg.onDanger && cfg.onDanger();
    }

    // R
    function startR() { e.state = 'R_cast'; e.t = 0; e.r_ang = Math.atan2(player.y - e.y, player.x - e.x); e.r_ox = e.x; e.r_oy = e.y; }
    function spawnRTelegraph() {
      // store fixed origin and angle for rectangles
      e.tele.push({ ang: e.r_ang, ox: e.r_ox, oy: e.r_oy, t: 0, fired: false });
    }
    function updateTelegraphs(dt) {
      for (const t of e.tele) {
        t.t += dt;
        if (!t.fired && t.t >= R_T_DELAY) {
          // Apply two rectangles: front and back
          if (typeof circleIntersectsRotRect === 'function') {
            const hitFront = circleIntersectsRotRect(
              player.x, player.y, player.radius,
              t.ox, t.oy,
              R_LEN_FRONT, R_WIDTH,
              t.ang
            );
            const hitBack = circleIntersectsRotRect(
              player.x, player.y, player.radius,
              t.ox, t.oy,
              R_LEN_BACK, R_WIDTH,
              t.ang + Math.PI
            );
            if (hitFront || hitBack) cfg.onDanger && cfg.onDanger();
          }
          t.fired = true;
          // If R was scheduled as the last skill, complete it now
          if (e.r_blockLast) { e.r_blockLast = false; afterSkill(); }
        }
      }
      e.tele = e.tele.filter(t => t.t < R_T_DELAY + 0.2);
    }

    function afterSkill(){
      e.queue.shift();
      if (e.queue.length===0){ e.dead = true; return; }
      e.state='move'; e.t=0;
    }

    function update(dt) {
      if (e.dead) return;
      e.t += dt;
      if (e.qProj) updateQ(dt);
      if (e.tele.length) updateTelegraphs(dt);

      switch (e.state) {
        case 'spawn_idle': { if (e.t >= 1.0) { e.state = 'move'; e.t = 0; } break; }
        case 'move': {
          steerTowardsPlayer(dt);
          const next = e.queue[0];
          const dxp = player.x - e.x; const dyp = player.y - e.y; const d2 = dxp*dxp + dyp*dyp;
          if (next === 'Q' && d2 <= VQ2) { e.vq_feint = Math.random() * 0.75; e.state = 'Q_feint'; e.t = 0; }
          else if (next === 'E' && d2 <= VE2) { e.ve_feint = Math.random() * 0.75; e.state = 'E_feint'; e.t = 0; }
          else if (next === 'R' && d2 <= VR2) {
            if (!e.r_blockLast) { e.vr_feint = Math.random() * 0.75; e.state = 'R_feint'; e.t = 0; }
          }
          break;
        }
        case 'Q_feint': { steerTowardsPlayer(dt); e.vq_feint -= dt; if (e.vq_feint <= 0) startQ(); break; }
        case 'E_feint': { steerTowardsPlayer(dt); e.ve_feint -= dt; if (e.ve_feint <= 0) startE(); break; }
        case 'R_feint': { steerTowardsPlayer(dt); e.vr_feint -= dt; if (e.vr_feint <= 0) startR(); break; }
        case 'Q_cast': { if (e.t >= Q_CAST) { fireQ(); } break; }
        case 'E_cast': { if (e.t >= E_CAST) { e.state = 'E_dash'; e.t = 0; } break; }
        case 'E_dash': { updateEDash(dt); if (e.edist >= E_DIST) { e.state = 'E_wait'; e.t = 0; } break; }
        case 'E_wait': { if (e.t >= E_WAIT) { afterSkill(); } break; }
        case 'Q_fly': { break; }
        case 'R_cast': { if (e.t >= R_CAST) { spawnRTelegraph(); if (e.queue.length <= 1) { e.r_blockLast = true; e.state = 'move'; e.t = 0; } else { afterSkill(); } } break; }
      }
    }

    function draw(ctx) {
      if (e.dead) return;
      // Q projectile
      if (e.qProj) { const p = e.qProj; ctx.save(); ctx.fillStyle = 'rgba(239,68,68,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, Q_R, 0, Math.PI*2); ctx.fill(); ctx.restore(); }

      // E telegraph path (light) + covered portion (strong red)
      if (e.state === 'E_cast' || e.state === 'E_dash' || e.state === 'E_wait') {
        const ca = Math.cos(e.e_ang), sa = Math.sin(e.e_ang);
        const ux = ca, uy = sa; const px = -sa, py = ca; const hw = E_WIDTH * 0.5;
        const sx = e.esx ?? e.x, sy = e.esy ?? e.y; const ex = e.ex, ey = e.ey;
        const verts = [ [sx+px*hw,sy+py*hw], [sx-px*hw,sy-py*hw], [ex-px*hw,ey-py*hw], [ex+px*hw,ey+py*hw] ];
        ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(verts[0][0],verts[0][1]); for(let i=1;i<verts.length;i++) ctx.lineTo(verts[i][0],verts[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        let covered = 0; if (e.state === 'E_dash') covered = Math.max(0, Math.min(E_DIST, e.edist||0)); else if (e.state==='E_wait') covered = E_DIST;
        if (covered > 0) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(uy, ux)); ctx.globalAlpha=0.5; ctx.fillStyle='rgba(239,68,68,0.45)'; ctx.strokeStyle='rgba(239,68,68,1.0)'; ctx.lineWidth=2; ctx.beginPath(); ctx.rect(0, -hw, covered, E_WIDTH); ctx.fill(); ctx.stroke(); ctx.restore(); }
      }

      // R telegraphs: draw two rectangles (front/back) centered at fixed origin
      for (const t of e.tele) {
        ctx.save(); ctx.translate(t.ox, t.oy); ctx.rotate(t.ang);
        ctx.globalAlpha = 0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        // Front rectangle 0..R_LEN_FRONT
        ctx.beginPath(); ctx.rect(0, -R_WIDTH/2, R_LEN_FRONT, R_WIDTH); ctx.fill(); ctx.stroke();
        // Back rectangle 0..R_LEN_BACK in opposite direction
        ctx.rotate(Math.PI); ctx.beginPath(); ctx.rect(0, -R_WIDTH/2, R_LEN_BACK, R_WIDTH); ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // body
      if (cfg.sprite) {
        const iw = cfg.sprite.naturalWidth || cfg.sprite.width || 55; const ih = cfg.sprite.naturalHeight || cfg.sprite.height || 73; const scale = 1.3;
        const dw = iw * scale, dh = ih * scale; const dx = Math.round(e.x - dw/2); const dy = Math.round(e.y - dh + 10);
        ctx.save(); if (e.facing < 0) { ctx.translate(Math.round(e.x), 0); ctx.scale(-1,1); ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh); } else { ctx.drawImage(cfg.sprite, dx, dy, dw, dh); } ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e: e };
  };
})();
