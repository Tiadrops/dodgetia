// Enemy Template (classic script)
// Copy this file to src/enemies/<Name>.js and adapt.
(function(){
  window.Enemies = window.Enemies || {};

  // Optional: local utilities (keep local to avoid cross-impact)
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function circleIntersectsAABB(cx,cy,r,rx,ry,hw,hh){
    const nx = clamp(cx, rx-hw, rx+hw); const ny = clamp(cy, ry-hh, ry+hh);
    const dx=cx-nx, dy=cy-ny; return (dx*dx+dy*dy) <= r*r;
  }
  function circleIntersectsRotRect(cx,cy,r,rx,ry,len,wid,ang){
    const ca=Math.cos(ang), sa=Math.sin(ang);
    const tx=cx-rx, ty=cy-ry; const lx=tx*ca+ty*sa, ly=-tx*sa+ty*ca;
    const nx = clamp(lx,0,len); const ny = clamp(ly,-wid*0.5,wid*0.5);
    const dx=lx-nx, dy=ly-ny; return (dx*dx+dy*dy) <= r*r;
  }

  // Factory signature (keep consistent with others)
  // cfg: { METER, player, bounds:{w,h}, onDanger?:()=>void, onCaution?:()=>void, sprite?: HTMLImageElement, sprites?: any }
  window.Enemies.TemplateEnemy = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    // Tunables (example)
    const SPEED = 3.9 * M; // px/s
    // Example skill Q (projectile)
    const Q_CAST = 0.25; // s
    const Q_WAIT = 0.10; // s
    const Q_RANGE = 8.0 * M; // px
    const Q_SPEED = 12.0 * M; // px/s
    const Q_SIZE = 0.8 * M; // px (square)

    const e = {
      name: 'TemplateEnemy',
      x: 0, y: 0, r: 16,
      color: '#38bdf8',
      facing: 1,
      state: 'spawn_idle', t: 0,
      dead: false,
      // Q example
      q_ang: 0, q_feint: 0, proj: null,
    };

    // Spawn at an edge
    (function spawn(){
      const pad=40, side=Math.floor(Math.random()*4);
      if (side===0){ e.x=pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===1){ e.x=W-pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===2){ e.x=Math.random()*(W-pad*2)+pad; e.y=pad; }
      if (side===3){ e.x=Math.random()*(W-pad*2)+pad; e.y=H-pad; }
    })();

    function steerTowardsPlayer(dt){
      const dx=player.x-e.x, dy=player.y-e.y; const d=Math.hypot(dx,dy)||1;
      e.x += (dx/d)*SPEED*dt; e.y += (dy/d)*SPEED*dt; e.facing = (dx>=0)?1:-1;
      e.x = clamp(e.x, 0, W); e.y = clamp(e.y, 0, H);
    }

    // Trigger conditions (adapt as needed)
    function inRangeQ(){ const dx=player.x-e.x, dy=player.y-e.y; return (dx*dx+dy*dy) <= Q_RANGE*Q_RANGE; }

    function startQ(){ e.state='Q_cast'; e.t=0; e.q_ang = Math.atan2(player.y-e.y, player.x-e.x); }
    function fireQ(){
      e.proj = { x:e.x, y:e.y, vx:Math.cos(e.q_ang)*Q_SPEED, vy:Math.sin(e.q_ang)*Q_SPEED, dist:0 };
      e.state='Q_fly'; e.t=0;
    }

    function update(dt){
      if (e.dead) return; e.t += dt;
      switch(e.state){
        case 'spawn_idle': { if (e.t>=1.0){ e.state='move'; e.t=0; } break; }
        case 'move': {
          steerTowardsPlayer(dt);
          if (inRangeQ()) { e.q_feint = Math.random() * 0.5; e.state='Q_feint'; e.t=0; }
          break;
        }
        case 'Q_feint': { steerTowardsPlayer(dt); e.q_feint -= dt; if (e.q_feint<=0) startQ(); break; }
        case 'Q_cast': { if (e.t>=Q_CAST) fireQ(); break; }
        case 'Q_fly': {
          if (e.proj){
            const p=e.proj; const step=Q_SPEED*dt; const hs=Q_SIZE/2;
            p.x += p.vx*dt; p.y += p.vy*dt; p.dist += step;
            if (circleIntersectsAABB(player.x,player.y,player.radius,p.x,p.y,hs,hs)) { cfg.onDanger && cfg.onDanger(); e.proj=null; }
            if (p.dist >= Q_RANGE) e.proj=null;
          }
          if (!e.proj){ e.state='Q_wait'; e.t=0; }
          break;
        }
        case 'Q_wait': { if (e.t>=Q_WAIT){ e.dead = true; } break; }
      }
    }

    function draw(ctx){
      if (e.dead) return;
      // Telegraph for Q (during cast)
      if (e.state==='Q_cast'){
        const l=Q_RANGE, w=Q_SIZE; ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(e.q_ang);
        ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.rect(0,-w/2,l,w); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // Projectile
      if (e.proj){ const p=e.proj; const hs=Q_SIZE/2; ctx.save(); ctx.fillStyle='rgba(239,68,68,0.9)'; ctx.translate(p.x,p.y); ctx.fillRect(-hs,-hs,Q_SIZE,Q_SIZE); ctx.restore(); }

      // Body
      if (cfg.sprite){
        const iw=cfg.sprite.naturalWidth||cfg.sprite.width||55; const ih=cfg.sprite.naturalHeight||cfg.sprite.height||73; const scale=1.3; const dw=iw*scale, dh=ih*scale;
        const dx=Math.round(e.x - dw/2), dy=Math.round(e.y - dh + 10);
        ctx.save(); if (e.facing<0){ ctx.translate(Math.round(e.x),0); ctx.scale(-1,1); ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh); } else { ctx.drawImage(cfg.sprite, dx, dy, dw, dh); } ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e:e };
  };
})();

