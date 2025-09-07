# Enemies Summary (v0.2.4)

- Units: 1m = 55px (fixed)
- Judgments: Danger = red (instant KO), Caution = yellow (3 hits to KO; can be ignored via option)
- Spawn: 1 enemy at a time; many have 1.0s spawn idle (see details)

## Hisui
- Move: 4.11 m/s
- Feint: 0.0–0.5s (next skill), but after using E the next feint is 0.0–0.25s
- W2 (A): Telegraph 0.5s → rectangle 7.2m × 1.2m (Danger)
- E: 0.13s back 2m → 0.325s wait → 0.25s forward 6m with AoE r=1.2m (Danger)
- R: 0.5s semicircle r=5.0m (Caution) → 0.625s rectangle 5.5m × 2.0m (Danger) → 0.25s wait

## Abigail
- Move: ~3.9 m/s
- Spawn idle: 1.0s
- Feint: W = 0.0–0.2s
- W: Telegraph 0.35s → cone (r=5.75m, 60°) (Danger) → 0.1s wait → leaves

## Luku
- Move: 3.9 m/s
- Feint: Q = 0.0–1.0s
- Q: Cast 0.3s → square projectile (0.6m), 18 m/s, out 10m; then reverse toward Luku 11 m/s back 10m; hit = Danger

## Katja
- Move: 3.85 m/s
- Feint: Q = 0.0–0.5s; R = 0.0–0.5s
- Q: Telegraph 0.25s → square 1.2m, 26 m/s, 11m (Danger)
- R: Cast 0.26s (no preview, small ring) → telegraph trapezoid (near 0.5m, far 6.7m, length 5.4m), fixed at cast start; 1.0s later hit (Danger)

## Vanya
- Move: 3.85 m/s
- Feint: Q/E/R = 0.0–0.5s
- Q (non-blocking): Cast 0.25s → circle r=0.8m, 10.6 m/s out 7.5m, then 11 m/s back 7.5m (Danger)
- E: 0.3s telegraph (rect width 3.8m, length 7m path) → dash 7m at 11.2 m/s (Danger) → 0.01s wait
- R (non-blocking): Cast 0.26s (no preview, ring) → telegraph trapezoid (0.5m–6.7m, L=5.4m), fixed; 1.0s later hit

## Darko
- Move: 3.9 m/s; Spawn idle: 1.0s
- Feint: E = 0.0–0.5s (when within 6.2m)
- E: Cast 0.6s (preview) → blink/step 4.0m forward → apply circle AoE r=2.2m at arrival (Danger) → 0.1s wait → leaves

## Debi & Marlene
- Forms: Debi / Marlene (switch via E). Start form random.
- Base order by start form; R is inserted at a random position: Debi start base [DQ, DE, MQ, ME], Marlene start base [MQ, ME, DQ, DE]
- Feint duration: DQ/DE/MQ/ME = 0.0–0.25s, R = 0.0–0.5s
- Feint trigger distance:
  - DQ: body 4.5m / placed Marlene 6.0m
  - DE: body 6.0m
  - MQ: body 5.5m / placed Debi 5.5m
  - ME: body 5.5m
  - R: body 8.0m
- Post-E: move-only 0.5s after DE/ME
- DQ (Caution): Cast 0.15s; front rectangle 4.5m × 1.0m (Caution). If Marlene placed: fire Debi projectile (r=0.8m, 18 m/s, 6m, Caution), then remove Marlene marker; post-wait 0.15s
- DE (Caution): Cast 0.15s; fire Debi projectile (r=0.8m, 18 m/s, 6m, Caution); then retreat 2.0m backward; place Debi marker; switch to Marlene
- MQ (Caution + Debi dash): Cast 0.166s; fire Marlene projectile (r=0.5m, 20 m/s, 6.25m, Caution). If Debi placed: Debi dashes 4.5m over 0.30s (sweep 1.5m × 1.2m, Danger), then remove Debi marker; post-wait 0.15s
- ME (Danger, self dash): Cast 0.2s; self dash 4.5m over 0.30s (sweep 1.5m × 1.2m); place Marlene marker; switch to Debi
- R (Danger, telegraph fixed): Cast 0.67s (preview rectangle 8m × 2m), then hit; blink to opposite edge (+8m), wait 0.6s; continues if skills remain

Notes
- Colors: Danger = red, Caution = yellow (both telegraph and projectiles follow this)
- Markers: Debi/Marlene markers render with their sprites if available; they are explicitly removed by the skills that consume them
