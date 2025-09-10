// Luku (split file)
// Classic script: attaches to window.Enemies.Luku
(function(){
  if (!window.Enemies) window.Enemies = {};

  // Local utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function circleIntersectsAABB(cx, cy, r, rx, ry, hw, hh) {
    const nx = clamp(cx, rx - hw, rx + hw);
    const ny = clamp(cy, ry - hh, ry + hh);
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) <= r*r;
  }

  // Factory
  // cfg: { METER, player, bounds:{w,h}, onDanger?: ()=>void, sprite?: HTMLImageElement }
  window.Enemies.Luku = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const speedPx = 3.9 * M;
    const Q_CAST = 0.3;       // cast time
    const Q_WAIT = 0.1;       // aftercast
    const Q_SIZE = 0.6 * M;   // square side
    const Q_RANGE = 10.0 * M; // max travel
    const Q_SPEED = 18.0 * M; // px/s

    const e = {
      name: 'Luku', x:0, y:0, facing:1, dead:false, color:'#60a5fa', r:16,
      state:'spawn_idle', t:0,
      q_ang:0,
      proj:null, // {x,y,vx,vy,dist}
      feintRemaining:0,
    };

    (function spawn(){
      const pad = 40; const side = Math.floor(Math.random()*4);
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
    function inRangeForQ(){ const dx=player.x-e.x, dy=player.y-e.y; return (dx*dx+dy*dy) <= Q_RANGE*Q_RANGE; }

    function spawnProjectile(){
      const dx=player.x-e.x, dy=player.y-e.y; const ang=Math.atan2(dy,dx);
      e.q_ang = ang; e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
      e.proj = { x:e.x, y:e.y, vx:Math.cos(ang)*Q_SPEED, vy:Math.sin(ang)*Q_SPEED, dist:0 };
    }

    function update(dt){
      if (e.dead) return; e.t += dt;
      switch(e.state){
        case 'spawn_idle': {
          if (e.t>=1.0){ e.state='move'; e.t=0; }
          break;
        }
        case 'move': {
          steerTowardsPlayer(dt);
          if (inRangeForQ()) { e.feintRemaining = Math.random() * 1.0; e.state='feint'; e.t=0; }
          break;
        }
        case 'feint': {
          steerTowardsPlayer(dt);
          e.feintRemaining -= dt;
          if (e.feintRemaining <= 0){ e.state='Q_cast'; e.t=0; }
          break;
        }
        case 'Q_cast': {
          if (e.t >= Q_CAST){ spawnProjectile(); e.state='Q_fly'; e.t=0; }
          break;
        }
        case 'Q_fly': {
          if (e.proj){
            const p = e.proj; const step = Q_SPEED * dt; const hs = Q_SIZE/2;
            p.x += p.vx*dt; p.y += p.vy*dt; p.dist += step;
            if (circleIntersectsAABB(player.x, player.y, player.radius, p.x, p.y, hs, hs)) { cfg.onDanger && cfg.onDanger(); e.proj = null; }
            if (p.dist >= Q_RANGE) e.proj = null;
          }
          if (!e.proj){ e.state='Q_after'; e.t=0; }
          break;
        }
        case 'Q_after': { if (e.t >= Q_WAIT) { e.dead = true; } break; }
      }
    }

    function draw(ctx){
      if (e.dead) return;
      if (e.proj){
        const p = e.proj; const hs = Q_SIZE/2;
        ctx.save(); ctx.fillStyle='rgba(239,68,68,0.9)'; ctx.translate(p.x,p.y); ctx.fillRect(-hs,-hs,Q_SIZE,Q_SIZE); ctx.restore();
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

