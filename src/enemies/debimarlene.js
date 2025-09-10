// Debi & Marlene (split file)
// Classic script style: attaches to window.Enemies.DebiMarlene without ES modules
(function(){
  if (!window.Enemies) window.Enemies = {};

  // Local utils (self-contained)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function circleIntersectsRotRect(cx, cy, r, rx, ry, len, wid, angle) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const tx = cx - rx, ty = cy - ry;
    const lx =  ( tx * ca + ty * sa);
    const ly = (-tx * sa + ty * ca);
    const nx = clamp(lx, 0, len);
    const ny = clamp(ly, -wid*0.5, wid*0.5);
    const dx = lx - nx, dy = ly - ny;
    return (dx*dx + dy*dy) <= r*r;
  }

  // Factory
  // cfg: { METER, player, bounds:{w,h}, onDanger?:()=>void, onCaution?:()=>void, sprites?: {debi?: HTMLImageElement, marlene?: HTMLImageElement} }
  window.Enemies.DebiMarlene = function(cfg){
    const M = cfg.METER;
    const player = cfg.player;
    const W = cfg.bounds.w, H = cfg.bounds.h;

    // timings and dims
    const Q_MAR_CAST = 0.166;
    const Q_MAR_PROJ_R = 0.5 * M;
    const Q_MAR_PROJ_SPEED = 20.0 * M;
    const Q_MAR_PROJ_RANGE = 6.25 * M;

    const MAR_DASH_TIME = 0.30;
    const MAR_DASH_DIST = 4.5 * M;
    const MAR_SWEEP_LEN = 1.5 * M;
    const MAR_SWEEP_WID = 1.2 * M;

    const E_MAR_CAST = 0.2;

    const Q_DEB_CAST = 0.15;
    const Q_DEB_RECT_L = 4.5 * M;
    const Q_DEB_RECT_W = 1.0 * M;
    const DEB_PROJ_R = 0.8 * M;
    const DEB_PROJ_SPEED = 18.0 * M;
    const DEB_PROJ_RANGE = 6.0 * M;
    const E_DEB_CAST = 0.15;
    const Q_POST_WAIT = 0.15; // additional wait after DQ/MQ completes

    const R_CAST = 0.67;
    const R_RECT_L = 8.0 * M;
    const R_RECT_W = 2.0 * M;
    const R_WAIT = 0.6;

    const speedPx = 3.9 * M;

    const e = {
      name: 'DebiMarlene', x: 0, y: 0, facing: 1, r: 16, dead:false,
      color: '#14b8a6',
      state: 'spawn_idle', t:0,
      form: (Math.random() < 0.5) ? 'Debi' : 'Marlene',
      // placed markers
      placedDebi: null, // {x,y}
      placedMarlene: null, // {x,y}
      // projectiles/dashes
      projs: [], // {x,y,vx,vy,r,range,sx,sy,caution?}
      dashes: [], // list of active dashes: {ox,oy,ux,uy,elapsed,follow?:bool,marker?:'Debi'}
      // feint + post-E idle timer
      dq_feint: 0, de_feint: 0, mq_feint: 0, me_feint: 0, r_feint: 0,
      postETime: 0,
      // cached angles for telegraphs
      dq_ang: 0,
      r_ang: 0, r_ox: 0, r_oy: 0,
      // queue
      queue: [],
    };

    // initialize order: Base depends on start form; R is inserted at random position
    const base = (e.form === 'Debi') ? ['DQ','DE','MQ','ME'] : ['MQ','ME','DQ','DE'];
    const insertAt = Math.floor(Math.random() * (base.length + 1));
    base.splice(insertAt, 0, 'R');
    e.queue = base;

    (function spawn(){
      const pad = 40; const side = Math.floor(Math.random()*4);
      if (side===0){ e.x=pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===1){ e.x=W-pad; e.y=Math.random()*(H-pad*2)+pad; }
      if (side===2){ e.x=Math.random()*(W-pad*2)+pad; e.y=pad; }
      if (side===3){ e.x=Math.random()*(W-pad*2)+pad; e.y=H-pad; }
    })();

    function steerTowardsPlayer(dt){
      const dx = player.x - e.x, dy = player.y - e.y; const d = Math.hypot(dx,dy)||1;
      const vx = (dx/d)*speedPx, vy=(dy/d)*speedPx; e.x+=vx*dt; e.y+=vy*dt; e.facing = (dx>=0)?1:-1;
      e.x = Math.max(0, Math.min(W, e.x)); e.y = Math.max(0, Math.min(H, e.y));
    }

    // helpers
    function startCast(duration, next){ e.state = next; e.t = 0; e.castDur = duration; }

    // distance helpers (player proximity triggers)
    const TH6 = 6.0 * M; const TH6_2 = TH6 * TH6;
    const TH55 = 5.5 * M; const TH55_2 = TH55 * TH55;
    const TH45 = 4.5 * M; const TH45_2 = TH45 * TH45;
    const THR = 8.0 * M; const THR_2 = THR * THR;
    function near2(ax, ay, bx, by, r2){ const dx=ax-bx, dy=ay-by; return (dx*dx + dy*dy) <= r2; }
    function inRangeDQ(){
      // within 4.5m of enemy body OR 6m of placed Marlene (if any)
      if (near2(player.x, player.y, e.x, e.y, TH45_2)) return true;
      if (e.placedMarlene && near2(player.x, player.y, e.placedMarlene.x, e.placedMarlene.y, TH6_2)) return true;
      return false;
    }
    function inRangeDE(){ return near2(player.x, player.y, e.x, e.y, TH6_2); }
    function inRangeMQ(){
      // within 5.5m of enemy or placed Debi (if any)
      if (near2(player.x, player.y, e.x, e.y, TH55_2)) return true;
      if (e.placedDebi && near2(player.x, player.y, e.placedDebi.x, e.placedDebi.y, TH55_2)) return true;
      return false;
    }
    function inRangeME(){ return near2(player.x, player.y, e.x, e.y, TH55_2); }
    function inRangeR(){ return near2(player.x, player.y, e.x, e.y, THR_2); }

    // skill drivers
    function startDQ(){ e.dq_ang = Math.atan2(player.y - e.y, player.x - e.x); startCast(Q_DEB_CAST,'DQ_cast'); }
    function startDE(){ startCast(E_DEB_CAST,'DE_cast'); }
    function startMQ(){ startCast(Q_MAR_CAST,'MQ_cast'); }
    function startME(){ startCast(E_MAR_CAST,'ME_cast'); }
    function startR(){
      // snapshot direction and origin at cast start to keep telegraph fixed
      e.r_ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.r_ox = e.x; e.r_oy = e.y;
      startCast(R_CAST, 'R_cast');
    }

    function fireMarProj(){
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.projs.push({ x:e.x, y:e.y, vx:Math.cos(ang)*Q_MAR_PROJ_SPEED, vy:Math.sin(ang)*Q_MAR_PROJ_SPEED, r:Q_MAR_PROJ_R, range:Q_MAR_PROJ_RANGE, sx:e.x, sy:e.y, caution:true });
    }
    function triggerDebiDashFrom(px,py, opts){
      // Create a dash that either follows (self dash) or moves marker Debi
      const ang = (opts && opts.ang) || Math.atan2(player.y - py, player.x - px);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      e.dashes.push({ ox:px, oy:py, ux, uy, elapsed:0, follow: !!(opts && opts.follow), marker: opts && opts.marker });
    }
    function dashUpdate(dt){
      if (!e.dashes.length) return;
      const remain = [];
      for (const d of e.dashes){
        d.elapsed += dt;
        const t = Math.min(1, d.elapsed / MAR_DASH_TIME);
        const dist = t * MAR_DASH_DIST;
        const cx = d.ox + d.ux*dist; const cy = d.oy + d.uy*dist; const ang = Math.atan2(d.uy, d.ux);
        // apply sweep hit (Danger)
        const pr = player.radius;
        // rect origin at current center, length along +X (local)
        if (circleIntersectsRotRect(player.x, player.y, pr, cx, cy, MAR_SWEEP_LEN, MAR_SWEEP_WID, ang)) {
          cfg.onDanger && cfg.onDanger();
        }
        if (d.follow){
          // update self position
          e.x = cx; e.y = cy; e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
        }
        if (d.marker === 'Debi' && e.placedDebi) { e.placedDebi.x = cx; e.placedDebi.y = cy; }
        if (d.elapsed < MAR_DASH_TIME) {
          remain.push(d);
        } else {
          // end
          if (d.marker === 'Debi') { e.placedDebi = null; }
        }
      }
      e.dashes = remain;
    }

    function updateProjs(dt){
      if (!e.projs.length) return;
      const keep = [];
      for (const p of e.projs){
        const step = DEB_PROJ_SPEED * dt; // speed stored in vx,vy; use range by dist from sx,sy
        p.x += p.vx * dt; p.y += p.vy * dt;
        // hit check
        const dx = p.x - player.x, dy = p.y - player.y;
        if (dx*dx + dy*dy <= (p.r + player.radius)*(p.r + player.radius)) {
          if (p.caution) cfg.onCaution && cfg.onCaution(); else cfg.onDanger && cfg.onDanger();
          continue; // remove projectile
        }
        // range check
        const ddx = p.x - p.sx, ddy = p.y - p.sy;
        if ((ddx*ddx + ddy*ddy) >= (p.range*p.range)) continue; // remove when exceeding
        keep.push(p);
      }
      e.projs = keep;
    }

    // Apply skills
    function applyDQ(){
      // main rectangle (Caution)
      const ang = e.dq_ang; const ox = e.x, oy = e.y;
      if (circleIntersectsRotRect(player.x, player.y, player.radius, ox, oy, Q_DEB_RECT_L, Q_DEB_RECT_W, ang)) {
        cfg.onCaution && cfg.onCaution();
      }
      // linked projectile from placed Marlene (Caution)
      if (e.placedMarlene){
        const ang2 = Math.atan2(player.y - e.placedMarlene.y, player.x - e.placedMarlene.x);
        e.projs.push({ x:e.placedMarlene.x, y:e.placedMarlene.y, vx:Math.cos(ang2)*DEB_PROJ_SPEED, vy:Math.sin(ang2)*DEB_PROJ_SPEED, r:DEB_PROJ_R, range:DEB_PROJ_RANGE, sx:e.placedMarlene.x, sy:e.placedMarlene.y, caution:true });
        // remove the placed Marlene marker after using it
        e.placedMarlene = null;
      }
    }
    function applyDE(){
      // fire Debi projectile from current position (Caution)
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.projs.push({ x:e.x, y:e.y, vx:Math.cos(ang)*DEB_PROJ_SPEED, vy:Math.sin(ang)*DEB_PROJ_SPEED, r:DEB_PROJ_R, range:DEB_PROJ_RANGE, sx:e.x, sy:e.y, caution: true });
      // place Debi and switch form to Marlene
      e.placedDebi = { x:e.x, y:e.y };
      e.form = 'Marlene';
      // retreat 2m backwards after firing
      const back = 2.0 * M;
      e.x -= Math.cos(ang) * back; e.y -= Math.sin(ang) * back;
      e.x = Math.max(0, Math.min(W, e.x)); e.y = Math.max(0, Math.min(H, e.y));
      e.postETime = 0.5; // move-only 0.5s after E
    }
    function applyMQ(){
      fireMarProj();
      if (e.placedDebi) triggerDebiDashFrom(e.placedDebi.x, e.placedDebi.y, { marker: 'Debi' });
    }
    function applyME(){
      // dash from current pos, place Marlene, then switch to Debi
      e.placedMarlene = { x:e.x, y:e.y };
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      triggerDebiDashFrom(e.x, e.y, { follow: true, ang });
      e.form = 'Debi';
      e.postETime = 0.5; // move-only 0.5s after E
    }
    function applyR(){
      const ang = e.r_ang; const ox = e.r_ox, oy = e.r_oy;
      if (circleIntersectsRotRect(player.x, player.y, player.radius, ox, oy, R_RECT_L, R_RECT_W, ang)) cfg.onDanger && cfg.onDanger();
      // move to opposite side (forward by rectangle length) from the snapshot origin
      e.x = ox + Math.cos(ang)*R_RECT_L; e.y = oy + Math.sin(ang)*R_RECT_L; e.facing = (Math.cos(ang) >= 0) ? 1 : -1;
    }

    function afterSkill(){
      e.queue.shift();
      if (e.queue.length===0){ e.dead = true; return; }
      e.state='move'; e.t=0;
    }

    function update(dt){
      if (e.dead) return;
      e.t += dt;
      dashUpdate(dt);
      updateProjs(dt);
      switch(e.state){
        case 'spawn_idle': if (e.t>=1.0){ e.state='move'; e.t=0; } break;
        case 'move': {
          // after E, spend 0.5s moving only. If a self-dash is active, let it drive position.
          if (e.postETime > 0) {
            e.postETime = Math.max(0, e.postETime - dt);
            const hasFollow = e.dashes && e.dashes.some(d => d.follow);
            if (!hasFollow) steerTowardsPlayer(dt);
            break;
          }
          // if a self-dash (follow) is in progress, let it finish before starting next skill
          if (e.dashes && e.dashes.some(d => d.follow)) { steerTowardsPlayer(dt); break; }
          steerTowardsPlayer(dt);
          const next = e.queue[0];
          if (next==='DQ' && inRangeDQ()) { e.dq_feint = Math.random() * 0.25; e.state='DQ_feint'; e.t=0; }
          else if (next==='DE' && inRangeDE()) { e.de_feint = Math.random() * 0.25; e.state='DE_feint'; e.t=0; }
          else if (next==='MQ' && inRangeMQ()) { e.mq_feint = Math.random() * 0.25; e.state='MQ_feint'; e.t=0; }
          else if (next==='ME' && inRangeME()) { e.me_feint = Math.random() * 0.25; e.state='ME_feint'; e.t=0; }
          else if (next==='R'  && inRangeR())  { e.r_feint  = Math.random() * 0.5;  e.state='R_feint';  e.t=0; }
          break;
        }
        case 'DQ_feint': { steerTowardsPlayer(dt); e.dq_feint -= dt; if (e.dq_feint <= 0) startDQ(); break; }
        case 'DE_feint': { steerTowardsPlayer(dt); e.de_feint -= dt; if (e.de_feint <= 0) startDE(); break; }
        case 'MQ_feint': { steerTowardsPlayer(dt); e.mq_feint -= dt; if (e.mq_feint <= 0) startMQ(); break; }
        case 'ME_feint': { steerTowardsPlayer(dt); e.me_feint -= dt; if (e.me_feint <= 0) startME(); break; }
        case 'R_feint':  { steerTowardsPlayer(dt); e.r_feint  -= dt; if (e.r_feint  <= 0) startR();  break; }
        case 'DQ_cast': if (e.t>=Q_DEB_CAST){ applyDQ(); e.state='DQ_wait'; e.t=0; } break;
        case 'DQ_wait': if (e.t>=Q_POST_WAIT){ afterSkill(); } break;
        case 'DE_cast': if (e.t>=E_DEB_CAST){ applyDE(); afterSkill(); } break;
        case 'MQ_cast': if (e.t>=Q_MAR_CAST){ applyMQ(); e.state='MQ_wait'; e.t=0; } break;
        case 'MQ_wait': if (e.t>=Q_POST_WAIT){ afterSkill(); } break;
        case 'ME_cast': if (e.t>=E_MAR_CAST){ applyME(); afterSkill(); } break;
        case 'R_cast': if (e.t>=R_CAST){ applyR(); e.state='R_wait'; e.t=0; } break;
        case 'R_wait': { if (e.t>=R_WAIT){ afterSkill(); } break; }
      }
    }

    function draw(ctx){
      if (e.dead) return;
      // draw projs (yellow for Caution, red for Danger)
      for (const p of e.projs){
        ctx.save();
        ctx.fillStyle = p.caution ? 'rgba(234,179,8,0.9)' : 'rgba(239,68,68,0.9)';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      // dash telegraph rectangle while active (Danger)
      if (e.dashes && e.dashes.length){
        for (const d of e.dashes){
          const t = Math.min(1, d.elapsed / MAR_DASH_TIME);
          const dist = t * MAR_DASH_DIST; const cx = d.ox + d.ux*dist; const cy = d.oy + d.uy*dist; const ang = Math.atan2(d.uy, d.ux);
          ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
          ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.rect(0,-MAR_SWEEP_WID/2,MAR_SWEEP_LEN,MAR_SWEEP_WID); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      // Debi Q telegraph (Caution): show only in the last 0.05s before hit
      if (e.state==='DQ_cast' && (Q_DEB_CAST - e.t) <= 0.05){
        const ang = e.dq_ang;
        ctx.save(); ctx.translate(e.x,e.y); ctx.rotate(ang);
        ctx.globalAlpha=0.35; ctx.fillStyle='rgba(234,179,8,0.25)'; ctx.strokeStyle='rgba(234,179,8,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.rect(0, -Q_DEB_RECT_W/2, Q_DEB_RECT_L, Q_DEB_RECT_W); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // R telegraph during cast (fixed at cast start position and angle)
      if (e.state==='R_cast'){
        ctx.save(); ctx.translate(e.r_ox, e.r_oy); ctx.rotate(e.r_ang);
        ctx.globalAlpha=0.35; ctx.fillStyle='rgba(239,68,68,0.25)'; ctx.strokeStyle='rgba(239,68,68,0.9)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.rect(0,-R_RECT_W/2,R_RECT_L,R_RECT_W); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // placed markers (use respective sprites if available)
      const sprDebi = cfg.sprites && cfg.sprites.debi;
      const sprMar = cfg.sprites && cfg.sprites.marlene;
      if (e.placedDebi){
        if (sprDebi){
          const iw = sprDebi.naturalWidth||sprDebi.width||55; const ih = sprDebi.naturalHeight||sprDebi.height||73;
          const scale = 1.0; const dw = iw*scale, dh = ih*scale;
          const dx = Math.round(e.placedDebi.x - dw/2); const dy = Math.round(e.placedDebi.y - dh + 10);
          ctx.save(); ctx.drawImage(sprDebi, dx, dy, dw, dh); ctx.restore();
        } else {
          ctx.save(); ctx.fillStyle='#ef4444'; ctx.fillRect(e.placedDebi.x-4,e.placedDebi.y-4,8,8); ctx.restore();
        }
      }
      if (e.placedMarlene){
        if (sprMar){
          const iw = sprMar.naturalWidth||sprMar.width||55; const ih = sprMar.naturalHeight||sprMar.height||73;
          const scale = 1.0; const dw = iw*scale, dh = ih*scale;
          const dx = Math.round(e.placedMarlene.x - dw/2); const dy = Math.round(e.placedMarlene.y - dh + 10);
          ctx.save(); ctx.drawImage(sprMar, dx, dy, dw, dh); ctx.restore();
        } else {
          ctx.save(); ctx.fillStyle='#60a5fa'; ctx.fillRect(e.placedMarlene.x-4,e.placedMarlene.y-4,8,8); ctx.restore();
        }
      }
      // body (use state-specific sprite if provided)
      const spr = (cfg.sprites && (e.form === 'Debi' ? cfg.sprites.debi : cfg.sprites.marlene)) || null;
      if (spr){
        const iw = spr.naturalWidth||spr.width||55; const ih = spr.naturalHeight||spr.height||73; const scale=1.3; const dw=iw*scale, dh=ih*scale; const dx=Math.round(e.x-dw/2), dy=Math.round(e.y-dh+10);
        ctx.save(); if (e.facing<0){ ctx.translate(Math.round(e.x),0); ctx.scale(-1,1); ctx.drawImage(spr,Math.round(-dw/2),dy,dw,dh); } else { ctx.drawImage(spr,dx,dy,dw,dh); } ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle=e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e:e };
  };
})();

