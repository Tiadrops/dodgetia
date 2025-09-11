// Haze enemy
(function(){
  window.Enemies = window.Enemies || {};

  // Local geometry helpers
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function circleHit(cx,cy,cr, px,py,pr){ const dx=px-cx, dy=py-cy; const rr=cr+pr; return (dx*dx+dy*dy) <= rr*rr; }
  function circleIntersectsCone(px, py, pr, cx, cy, R, TH, ang) {
    const dx = px - cx, dy = py - cy;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lx =  ( dx * ca + dy * sa);
    const ly = (-dx * sa + dy * ca);
    const d = Math.hypot(lx, ly);
    if (d > R + pr) return false;
    const a = Math.atan2(ly, lx);
    const half = TH * 0.5;
    const pad = Math.min(half, Math.asin(Math.min(1, pr / Math.max(d, pr))));
    return Math.abs(a) <= (half + pad) && (lx + pr) >= 0;
  }

  window.Enemies.Haze = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    const SPEED = 3.98 * M;

    // Q (Caution)
    const Q_TRIG = 7.0 * M; const Q_TRIG2 = Q_TRIG*Q_TRIG;
    const Q_FEINT_MAX = 0.5;
    const Q_CAST = 0.2; const Q_TELE = 0.45; const Q_POST = 0.1;
    const Q_RADIUS = 1.8 * M; const Q_RANGE = 7.0 * M; // telegraph at 7m forward

    // W (Danger)
    const W_TRIG = 4.0 * M; const W_TRIG2 = W_TRIG*W_TRIG;
    const W_FEINT_MAX = 0.5; const W_CAST = 0.3; const W_POST = 0.1; const W_BACK = 1.5 * M;
    const W_RADIUS = 5.5 * M; const W_THETA = (55 * Math.PI) / 180;

    // RQ (Caution, repeated projectile)
    const RQ_TRIG = 13.0 * M; const RQ_TRIG2 = RQ_TRIG*RQ_TRIG;
    const RQ_CAST = 0.33; const RQ_CD = 0.6; const RQ_POST = 0.1; const RQ_SHOTS = 4;
    const RQ_SIZE = 1.0 * M; const RQ_SPEED = 17.0 * M;

    const e = {
      name:'Haze', x:0,y:0, r:16, color:'#94a3ff', facing:1,
      state:'spawn_idle', t:0, dead:false,
      // queue
      queue: [],
      // Q
      q_ang:0, q_ox:0, q_oy:0, q_feint:0,
      // W
      w_ang:0, w_ox:0, w_oy:0, w_feint:0,
      // RQ
      rq_ang:0, rq_shots:0, rq_cd:0, rq_proj:[],
    };

    // init queue (random order, use each once)
    (function init(){
      const pad=40, side=Math.floor(Math.random()*4);
      if (side===0){ e.x=pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===1){ e.x=W-pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===2){ e.x=Math.random()*(W-pad*2)+pad; e.y=pad; }
      if (side===3){ e.x=Math.random()*(W-pad*2)+pad; e.y=H-pad; }
      const base=['Q','W','RQ'];
      for (let i=base.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [base[i],base[j]]=[base[j],base[i]]; }
      e.queue = base;
    })();

    function steer(dt){
      const dx=player.x-e.x, dy=player.y-e.y; const d=Math.hypot(dx,dy)||1;
      e.x += (dx/d)*SPEED*dt; e.y += (dy/d)*SPEED*dt; e.facing = (dx>=0)?1:-1;
      e.x = clamp(e.x, 0, W); e.y = clamp(e.y, 0, H);
    }
    function d2toPlayer(){ const dx=player.x-e.x, dy=player.y-e.y; return dx*dx+dy*dy; }

    // Q flow
    function startQ(){ e.state='Q_cast'; e.t=0; e.q_ang=Math.atan2(player.y-e.y, player.x-e.x); e.q_ox=e.x; e.q_oy=e.y; }
    function applyQ(){
      const cx = e.q_ox + Math.cos(e.q_ang)*Q_RANGE;
      const cy = e.q_oy + Math.sin(e.q_ang)*Q_RANGE;
      if (circleHit(cx,cy,Q_RADIUS, player.x,player.y,player.radius)) { cfg.onCaution && cfg.onCaution(); }
      e.state='Q_post'; e.t=0;
    }

    // W flow
    function startW(){
      e.w_ang = Math.atan2(player.y-e.y, player.x-e.x);
      // backstep 1.5m
      e.x -= Math.cos(e.w_ang)*W_BACK; e.y -= Math.sin(e.w_ang)*W_BACK;
      e.x = clamp(e.x, 0, W); e.y = clamp(e.y, 0, H);
      e.w_ox = e.x; e.w_oy = e.y; e.state='W_cast'; e.t=0;
    }
    function applyW(){
      if (circleIntersectsCone(player.x,player.y,player.radius, e.w_ox,e.w_oy, W_RADIUS, W_THETA, e.w_ang)) { cfg.onDanger && cfg.onDanger(); }
      e.state='W_post'; e.t=0;
    }

    // RQ flow
    function startRQ(){ e.rq_ang = Math.atan2(player.y-e.y, player.x-e.x); e.rq_shots = RQ_SHOTS; e.state='RQ_cast'; e.t=0; }
    function fireRQ(){
      const ang = e.rq_ang;
      e.rq_proj.push({ x:e.x, y:e.y, vx:Math.cos(ang)*RQ_SPEED, vy:Math.sin(ang)*RQ_SPEED, dist:0 });
      e.rq_shots -= 1; e.state='RQ_cd'; e.rq_cd = RQ_CD; e.t=0;
    }
    function updateProjs(dt){
      if (!e.rq_proj.length) return;
      const keep = [];
      for (const p of e.rq_proj){
        p.x += p.vx*dt; p.y += p.vy*dt; p.dist += RQ_SPEED*dt;
        // hit
        const hs = RQ_SIZE/2;
        const nx = clamp(player.x, p.x-hs, p.x+hs);
        const ny = clamp(player.y, p.y-hs, p.y+hs);
        const dx = player.x - nx, dy = player.y - ny;
        if ((dx*dx+dy*dy) <= player.radius*player.radius) {
          cfg.onCaution && cfg.onCaution();
          if (cfg.applySlow) cfg.applySlow(0.7, 1.0);
          continue; // remove
        }
        if (p.dist < Q_TRIG*10) keep.push(p); // arbitrary safety life
      }
      e.rq_proj = keep;
    }

    function afterSkill(){ e.queue.shift(); if (e.queue.length===0){ e.dead=true; } else { e.state='move'; e.t=0; } }

    function update(dt){
      if (e.dead) return; e.t += dt; updateProjs(dt);
      switch(e.state){
        case 'spawn_idle': if (e.t>=1.0){ e.state='move'; e.t=0; } break;
        case 'move': {
          steer(dt);
          const next = e.queue[0]; const d2 = d2toPlayer();
          if (next==='Q'){
            const d = Math.sqrt(d2);
            if (d < Q_TRIG) { e.state='Q_repos'; e.t=0; }
            else if (d <= Q_TRIG) { e.q_feint = Math.random()*Q_FEINT_MAX; e.state='Q_feint'; e.t=0; }
          }
          else if (next==='W' && d2 <= W_TRIG2){ e.w_feint = Math.random()*W_FEINT_MAX; e.state='W_feint'; e.t=0; }
          else if (next==='RQ' && d2 <= RQ_TRIG2){ startRQ(); }
          break; }
        case 'Q_repos': {
          // move away from player until distance >= Q_TRIG
          const dx = e.x - player.x, dy = e.y - player.y; const d = Math.hypot(dx,dy)||1;
          const ux = dx/d, uy = dy/d; e.x += ux*SPEED*dt; e.y += uy*SPEED*dt; e.facing = ( (player.x - e.x) >= 0) ? 1 : -1;
          e.x = clamp(e.x, 0, W); e.y = clamp(e.y, 0, H);
          const ndx = player.x - e.x, ndy = player.y - e.y; if ((ndx*ndx + ndy*ndy) >= Q_TRIG2){ e.q_feint = Math.random()*Q_FEINT_MAX; e.state='Q_feint'; e.t=0; }
          break; }
        case 'Q_feint': { steer(dt); e.q_feint -= dt; if (e.q_feint<=0) startQ(); break; }
        case 'Q_cast': { if (e.t>=Q_CAST){ e.state='Q_tele'; e.t=0; } break; }
        case 'Q_tele': { if (e.t>=Q_TELE) { applyQ(); } break; }
        case 'Q_post': { if (e.t>=Q_POST) { afterSkill(); } break; }

        case 'W_feint': { steer(dt); e.w_feint -= dt; if (e.w_feint<=0) startW(); break; }
        case 'W_cast': { if (e.t>=W_CAST) { applyW(); } break; }
        case 'W_post': { if (e.t>=W_POST) { afterSkill(); } break; }

        case 'RQ_cast': { if (e.t>=RQ_CAST) { fireRQ(); } break; }
        case 'RQ_cd': {
          e.rq_cd -= dt;
          if (e.rq_cd <= 0) {
            if (e.rq_shots > 0) { e.state='RQ_cast'; e.t=0; e.rq_ang = Math.atan2(player.y-e.y, player.x-e.x); }
            else { e.state='RQ_post'; e.t=0; }
          }
          break; }
        case 'RQ_post': { if (e.t>=RQ_POST) { afterSkill(); } break; }
      }
    }

    function draw(ctx){
      if (e.dead) return;
      // Q telegraph
      if (e.state==='Q_tele' || e.state==='Q_cast'){
        const cx = e.q_ox + Math.cos(e.q_ang)*Q_RANGE;
        const cy = e.q_oy + Math.sin(e.q_ang)*Q_RANGE;
        ctx.save(); ctx.globalAlpha=0.35; ctx.fillStyle='rgba(234,179,8,0.25)'; ctx.strokeStyle='rgba(234,179,8,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(cx,cy,Q_RADIUS,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // W telegraph (during cast)
      if (e.state==='W_cast'){
        ctx.save(); ctx.translate(e.w_ox,e.w_oy); ctx.rotate(e.w_ang);
        ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,W_RADIUS,-W_THETA/2, W_THETA/2,false); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // RQ projectiles (caution=yellow)
      for (const p of e.rq_proj){ const hs=RQ_SIZE/2; ctx.save(); ctx.fillStyle='rgba(234,179,8,0.9)'; ctx.translate(p.x,p.y); ctx.fillRect(-hs,-hs,RQ_SIZE,RQ_SIZE); ctx.restore(); }

      // Body
      if (cfg.sprite){
        const iw = cfg.sprite.naturalWidth||cfg.sprite.width||55; const ih = cfg.sprite.naturalHeight||cfg.sprite.height||73; const scale=1.3; const dw=iw*scale, dh=ih*scale; const dx=Math.round(e.x-dw/2), dy=Math.round(e.y-dh+10);
        ctx.save(); if (e.facing<0){ ctx.translate(Math.round(e.x),0); ctx.scale(-1,1); ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh); } else { ctx.drawImage(cfg.sprite, dx, dy, dw, dh); } ctx.restore();
      } else { ctx.save(); ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    }

    return { get dead(){ return e.dead; }, update, draw, _e:e };
  };
})();
