// Katja (split file)
// Classic script, attaches window.Enemies.Katja without ES modules
(function(){
  if (!window.Enemies) window.Enemies = {};

  // Local utils used by Katja
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function circleIntersectsAABB(cx, cy, r, rx, ry, hw, hh) {
    const nx = clamp(cx, rx - hw, rx + hw);
    const ny = clamp(cy, ry - hh, ry + hh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= r*r;
  }
  function pointInPolygon(px, py, verts) {
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

  // Factory
  // cfg: { METER, player, bounds:{w,h}, onDanger?:()=>void, sprite?: HTMLImageElement }
  window.Enemies.Katja = function(cfg){
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
    // R: trapezoid forward with jittered placement within 0..23m (center clamped)
    const R_RANGE = 23.0 * M;
    const R_CAST = 0.8;
    const R_WAIT = 0.3;
    const R_H = 5.0 * M;        // height along facing
    const R_W_NEAR = 3.0 * M;   // width at origin (near)
    const R_W_FAR  = 6.0 * M;   // width at far end

    const e = {
      name: 'Katja', x: 0, y: 0, facing: 1, dead: false, r: 16,
      color: '#a78bfa',
      state: 'spawn_idle', t: 0,
      // Q
      q_ang: 0, proj: null, q_feint: 0,
      // R
      r_ang: 0, r_ox: 0, r_oy: 0, r_center: 0, r_jx: 0, r_jy: 0,
      // plan
      queue: Math.random() < 0.5 ? ['Q','R'] : ['R','Q'],
      usedQ: false, usedR: false,
    };

    (function spawn(){
      const pad = 40; const side = Math.floor(Math.random()*4);
      if (side===0){ e.x=pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===1){ e.x=W-pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===2){ e.x=Math.random()*(W-pad*2)+pad; e.y=pad; }
      if (side===3){ e.x=Math.random()*(W-pad*2)+pad; e.y=H-pad; }
    })();

    function steerTowardsPlayer(dt){
      const dx = player.x - e.x; const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const vx = (dx / d) * speedPx; const vy = (dy / d) * speedPx;
      e.x += vx * dt; e.y += vy * dt;
      e.facing = (dx >= 0) ? 1 : -1;
      e.x = Math.max(0, Math.min(W, e.x)); e.y = Math.max(0, Math.min(H, e.y));
    }

    function inRangeQ(){ const dx=player.x-e.x, dy=player.y-e.y; return (dx*dx+dy*dy) <= Q_RANGE*Q_RANGE; }
    function inRangeR(){ const dx=player.x-e.x, dy=player.y-e.y; return (dx*dx+dy*dy) <= R_RANGE*R_RANGE; }

    function startQ(){ e.state='Q_cast'; e.t=0; e.q_ang = Math.atan2(player.y - e.y, player.x - e.x); }
    function startR(){
      e.state='R_cast'; e.t=0;
      e.r_ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.r_ox = e.x; e.r_oy = e.y;
      const ca=Math.cos(e.r_ang), sa=Math.sin(e.r_ang);
      const dx=player.x-e.x, dy=player.y-e.y;
      const proj = dx*ca + dy*sa;
      e.r_center = Math.max(R_H*0.5, Math.min(R_RANGE - R_H*0.5, proj));
      const J = 1.0 * M; // jitter ±1.0m each axis
      e.r_jx = (Math.random()*2 - 1) * J;
      e.r_jy = (Math.random()*2 - 1) * J;
    }

    function fireQ(){
      const ang = e.q_ang; e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
      e.proj = { x:e.x, y:e.y, vx:Math.cos(ang)*Q_SPEED, vy:Math.sin(ang)*Q_SPEED, dist:0 };
    }

    function buildRVertsWorld(){
      const ca=Math.cos(e.r_ang), sa=Math.sin(e.r_ang);
      const ux=ca, uy=sa; const px=-sa, py=ca;
      const startD = e.r_center - R_H*0.5;
      const endD   = e.r_center + R_H*0.5;
      const sx = e.r_ox + ux*startD; const sy = e.r_oy + uy*startD;
      const ex = e.r_ox + ux*endD;   const ey = e.r_oy + uy*endD;
      const nH = R_W_NEAR*0.5; const fH = R_W_FAR*0.5;
      const jx=e.r_jx||0, jy=e.r_jy||0;
      return [
        [sx + px*nH + jx, sy + py*nH + jy],
        [sx - px*nH + jx, sy - py*nH + jy],
        [ex - px*fH + jx, ey - py*fH + jy],
        [ex + px*fH + jx, ey + py*fH + jy],
      ];
    }
    function applyRHit(){
      const wv = buildRVertsWorld();
      if (circleIntersectsPolygon(player.x, player.y, player.radius, wv)) cfg.onDanger && cfg.onDanger();
    }

    function afterSkill(){
      e.queue.shift();
      if (e.queue.length===0){ e.dead = true; return; }
      e.state='move'; e.t=0;
    }

    function update(dt){
      if (e.dead) return;
      e.t += dt;
      switch(e.state){
        case 'spawn_idle': if (e.t>=1.0){ e.state='move'; e.t=0; } break;
        case 'move': {
          steerTowardsPlayer(dt);
          const next = e.queue[0];
          if (next==='Q' && inRangeQ()) { e.q_feint = Math.random() * 1.0; e.state='Q_feint'; e.t=0; }
          else if (next==='R' && inRangeR()) startR();
          break;
        }
        case 'Q_feint': { steerTowardsPlayer(dt); e.q_feint -= dt; if (e.q_feint <= 0) startQ(); break; }
        case 'Q_cast':  { if (e.t>=Q_CAST) { fireQ(); e.state='Q_fly'; e.t=0; } break; }
        case 'Q_fly': {
          if (e.proj){
            const p=e.proj; const step=Q_SPEED*dt; const hs=Q_SIZE/2;
            p.x += p.vx*dt; p.y += p.vy*dt; p.dist += step;
            if (circleIntersectsAABB(player.x, player.y, player.radius, p.x, p.y, hs, hs)) { cfg.onDanger && cfg.onDanger(); e.proj=null; }
            if (p.dist >= Q_RANGE) e.proj=null;
          }
          if (!e.proj){ e.state='Q_wait'; e.t=0; }
          break;
        }
        case 'Q_wait': { if (e.t>=Q_WAIT){ e.usedQ=true; afterSkill(); } break; }
        case 'R_cast': { if (e.t>=R_CAST){ applyRHit(); e.state='R_wait'; e.t=0; } break; }
        case 'R_wait': { if (e.t>=R_WAIT){ e.usedR=true; afterSkill(); } break; }
      }
    }

    function draw(ctx){
      if (e.dead) return;
      // Q telegraph
      if (e.state==='Q_cast'){
        const w=Q_SIZE, l=Q_RANGE;
        ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.q_ang);
        ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.rect(0,-w/2,l,w); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // R telegraph (polygon in world coords)
      if (e.state==='R_cast'){
        const wv = buildRVertsWorld();
        ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(wv[0][0],wv[0][1]); for (let i=1;i<wv.length;i++) ctx.lineTo(wv[i][0],wv[i][1]); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // Projectile
      if (e.proj){
        const p=e.proj; const hs=Q_SIZE/2;
        ctx.save(); ctx.fillStyle='rgba(239,68,68,0.9)'; ctx.translate(p.x,p.y); ctx.fillRect(-hs,-hs,Q_SIZE,Q_SIZE); ctx.restore();
      }
      // Body
      if (cfg.sprite){
        const iw = cfg.sprite.naturalWidth||cfg.sprite.width||55; const ih = cfg.sprite.naturalHeight||cfg.sprite.height||73;
        const scale=1.3; const dw=iw*scale, dh=ih*scale; const dx=Math.round(e.x-dw/2), dy=Math.round(e.y-dh+10);
        ctx.save(); if (e.facing<0){ ctx.translate(Math.round(e.x),0); ctx.scale(-1,1); ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh); } else { ctx.drawImage(cfg.sprite, dx, dy, dw, dh); } ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e:e };
  };
})();

