// Darko (split file)
// Classic script: attaches to window.Enemies.Darko
(function(){
  if (!window.Enemies) window.Enemies = {};

  // Factory
  // cfg: { METER, player, bounds:{w,h}, onDanger?: ()=>void, sprite?: HTMLImageElement }
  window.Enemies.Darko = function(cfg){
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
      // jump to target and apply hit
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
        case 'E_cast': { if (e.t >= E_CAST) resolveE(); break; }
        case 'E_wait': { if (e.t >= E_WAIT) { e.dead = true; } break; }
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
      // Body
      if (cfg.sprite) {
        const iw = cfg.sprite.naturalWidth || cfg.sprite.width || 55;
        const ih = cfg.sprite.naturalHeight || cfg.sprite.height || 73;
        const scale = 1.3;
        const dw = iw * scale, dh = ih * scale;
        const dx = Math.round(e.x - dw/2);
        const dy = Math.round(e.y - dh + 10);
        ctx.save();
        if (e.facing < 0) { ctx.translate(Math.round(e.x), 0); ctx.scale(-1, 1); ctx.drawImage(cfg.sprite, Math.round(-dw/2), dy, dw, dh); }
        else { ctx.drawImage(cfg.sprite, dx, dy, dw, dh); }
        ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    return { get dead(){ return e.dead; }, update, draw, _e: e };
  };
})();

