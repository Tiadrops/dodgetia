// Abigail (split file)
// Classic script: attaches to window.Enemies.Abigail
(function(){
  if (!window.Enemies) window.Enemies = {};

  // Local utils
  // Cone vs circle (approx): sector radius R, angle TH (radians) in +X from (cx,cy) rotated by ang
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

  // Factory
  // cfg: { METER, player, bounds:{w,h}, onDanger?: ()=>void, sprite?: HTMLImageElement }
  window.Enemies.Abigail = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 3.9 * M;
    const W_CAST = 0.35;
    const W_WAIT = 0.1;
    const W_RADIUS = 5.75 * M;
    const W_THETA = (60 * Math.PI) / 180;

    const e = {
      name: 'Abigail', x:0, y:0, facing:1, dead:false, color:'#f59e0b', r:16,
      state:'spawn_idle', t:0,
      w_ang:0, w_ox:0, w_oy:0,
      w_feint:0,
    };

    (function spawn(){
      const pad=40; const side=Math.floor(Math.random()*4);
      if (side===0){ e.x=pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===1){ e.x=W-pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===2){ e.x=Math.random()*(W-pad*2)+pad; e.y=pad; }
      if (side===3){ e.x=Math.random()*(W-pad*2)+pad; e.y=H-pad; }
    })();

    function steerTowardsPlayer(dt){
      const dx=player.x-e.x, dy=player.y-e.y; const d=Math.hypot(dx,dy)||1;
      const vx=(dx/d)*speedPx, vy=(dy/d)*speedPx; e.x+=vx*dt; e.y+=vy*dt; e.facing=(dx>=0)?1:-1;
      e.x = Math.max(0, Math.min(W, e.x)); e.y = Math.max(0, Math.min(H, e.y));
    }

    function inRangeForW(){
      // center-angle check with radial padding by player radius
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

    function startW(){
      e.state='W_cast'; e.t=0;
      e.w_ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.w_ox = e.x; e.w_oy = e.y;
    }

    function resolveWHit(){
      const hit = circleIntersectsCone(player.x, player.y, player.radius, e.w_ox, e.w_oy, W_RADIUS, W_THETA, e.w_ang);
      if (hit) cfg.onDanger && cfg.onDanger();
      e.state='W_wait'; e.t=0;
    }

    function update(dt){
      if (e.dead) return; e.t += dt;
      switch(e.state){
        case 'spawn_idle': { if (e.t>=1.0){ e.state='move'; e.t=0; } break; }
        case 'move': {
          steerTowardsPlayer(dt);
          if (inRangeForW()) { e.w_feint = Math.random() * 0.2; e.state='W_feint'; e.t=0; }
          break;
        }
        case 'W_feint': { steerTowardsPlayer(dt); e.w_feint -= dt; if (e.w_feint <= 0) startW(); break; }
        case 'W_cast': { if (e.t >= W_CAST) resolveWHit(); break; }
        case 'W_wait': { if (e.t >= W_WAIT) { e.dead = true; } break; }
      }
    }

    function draw(ctx){
      if (e.dead) return;
      if (e.state==='W_cast'){
        ctx.save(); ctx.translate(e.w_ox, e.w_oy); ctx.rotate(e.w_ang);
        ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,W_RADIUS,-W_THETA/2, W_THETA/2, false); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (cfg.sprite){
        const iw = cfg.sprite.naturalWidth||cfg.sprite.width||55; const ih = cfg.sprite.naturalHeight||cfg.sprite.height||73; const scale=1.3; const dw=iw*scale, dh=ih*scale; const dx=Math.round(e.x-dw/2), dy=Math.round(e.y-dh+10);
        ctx.save(); if (e.facing<0){ ctx.translate(Math.round(e.x),0); ctx.scale(-1,1); ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh); } else { ctx.drawImage(cfg.sprite, dx, dy, dw, dh); } ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e:e };
  };
})();

