# Enemies Summary (v0.4.1)

- Units: 1m = 55px (fixed)
- Judgments: Danger = red (instant KO), Caution = yellow (3 hits to KO; can be ignored via option)
- Spawn: 1 enemy at a time; many have 1.0s spawn idle (see details)

## Hisui
- Move: 4.11 m/s
- Feint: 0.0 E.5s (next skill), but after using E the next feint is 0.0 E.25s
- W2 (A): Telegraph 0.5s ↁErectangle 7.2m ÁE1.2m (Danger)
- E: 0.13s back 2m ↁE0.325s wait ↁE0.25s forward 6m with AoE r=1.2m (Danger)
- R: 0.5s semicircle r=5.0m (Caution) ↁE0.625s rectangle 5.5m ÁE2.0m (Danger) ↁE0.25s wait

## Abigail
- Move: ~3.9 m/s
- Spawn idle: 1.0s
- Feint: W = 0.0 E.2s
- W: Telegraph 0.35s ↁEcone (r=5.75m, 60°) (Danger) ↁE0.1s wait ↁEleaves

## Luku
- Move: 3.9 m/s
- Feint: Q = 0.0 E.0s
- Q: Cast 0.3s ↁEsquare projectile (0.6m), 18 m/s, out 10m; then reverse toward Luku 11 m/s back 10m; hit = Danger

## Katja
- Move: 3.85 m/s
- Feint: Q = 0.0 E.5s; R = 0.0 E.5s
- Q: Telegraph 0.25s ↁEsquare 1.2m, 26 m/s, 11m (Danger)
- R: Cast 0.26s (no preview, small ring) ↁEtelegraph trapezoid (near 0.5m, far 6.7m, length 5.4m), fixed at cast start; 1.0s later hit (Danger)

## Vanya
- Move: 3.85 m/s
- Feint: Q/E/R = 0.0 E.75s
- Feint trigger distance: Q 8.3m / E 7.0m / R 6.7m
- Q (non-blocking): Cast 0.25s ↁEcircle r=0.8m, 10.6 m/s out 7.5m, then 11 m/s back 7.5m (Danger)
- E: 0.3s telegraph (rect width 3.8m, length 7m path) ↁEdash 7m at 11.2 m/s (Danger) ↁE0.01s wait
- R (non-blocking): Cast 0.26s (no preview, ring) ↁEtelegraph trapezoid (0.5m E.7m, L=5.4m), fixed; 1.0s later hit

## Darko
- Move: 3.9 m/s; Spawn idle: 1.0s
- Feint: E = 0.0 E.5s (when within 6.2m)
- E: Cast 0.6s (preview) ↁEblink/step 4.0m forward ↁEapply circle AoE r=2.2m at arrival (Danger) ↁE0.1s wait ↁEleaves

## Debi & Marlene
- Forms: Debi / Marlene (switch via E). Start form random.
- Base order by start form; R is inserted at a random position: Debi start base [DQ, DE, MQ, ME], Marlene start base [MQ, ME, DQ, DE]
- Feint duration: DQ/DE/MQ/ME = 0.0 E.25s, R = 0.0 E.5s
- Feint trigger distance:
  - DQ: body 4.5m / placed Marlene 6.0m
  - DE: body 6.0m
  - MQ: body 5.5m / placed Debi 5.5m
  - ME: body 5.5m
  - R: body 8.0m
- Post-E: move-only 0.5s after DE/ME
- DQ (Caution): Cast 0.15s; front rectangle 4.5m ÁE1.0m (Caution). If Marlene placed: fire Debi projectile (r=0.8m, 18 m/s, 6m, Caution), then remove Marlene marker; post-wait 0.15s
- DE (Caution): Cast 0.15s; fire Debi projectile (r=0.8m, 18 m/s, 6m, Caution); then retreat 2.0m backward; place Debi marker; switch to Marlene
- MQ (Caution + Debi dash): Cast 0.166s; fire Marlene projectile (r=0.5m, 20 m/s, 6.25m, Caution). If Debi placed: Debi dashes 4.5m over 0.30s (sweep 1.5m ÁE1.2m, Danger), then remove Debi marker; post-wait 0.15s
- ME (Danger, self dash): Cast 0.2s; self dash 4.5m over 0.30s (sweep 1.5m ÁE1.2m); place Marlene marker; switch to Debi
- R (Danger, telegraph fixed): Cast 0.67s (preview rectangle 8m ÁE2m), then hit; blink to opposite edge (+8m), wait 0.6s; continues if skills remain

## Isaac\r\n- Move: 3.9 m/s\r\n- Order: E combo (E1 -> E2) then R, then despawn\r\n- Triggers: E combo engages at 7.0m with 0.0-0.5s feint; R engages at 7.5m with 0.0-0.5s feint\r\n- E1: Dash 3.0m in 0.2s (no hit) and immediately chains into E2\r\n- E2: Cast 0.4s -> rectangle 5.0m x 2.0m (Danger), post 0.35s\r\n- R: Cast 0.5s -> circle r=2.5m at target within 4.0m (Caution), Isaac blinks on hit, post 0.35s\r\n\r\n## Justyna
- Move: 3.94 m/s; uses E (2.5m dash over 0.26s, 2.0s cooldown) to realign during Q casts
- Debug mode: all skill hits are currently tagged as Caution (yellow) to simplify testing
- W: Cast 0.4s; Caution circle radius 2.0m at a point up to 6.5m away (anchored in world)
- Q1: Two Caution sweeps; each cast 0.4s for a rectangle 6.25m x 1.8m that follows her position while the angle is locked; unlocks Q2 for 3.0s but Q2 stays locked for 0.4s after Q1 completes; skipped if the window expires
- Q2: Cast 0.7s; Caution rectangle 7.0m x 1.5m, only usable inside the Q1 window
- R: Cast 0.5s then 8 Caution pulses every 0.125s in a circle radius 3.0m offset up to 6.0m; area follows her and movement is at 60% with other skills disabled; each pulse removes 0.25 from the player's 3-point Caution life, so the full channel becomes lethal without requiring paired hits

Notes
- Colors: Danger = red, Caution = yellow (both telegraph and projectiles follow this)
- Markers: Debi/Marlene markers render with their sprites if available; they are explicitly removed by the skills that consume them

