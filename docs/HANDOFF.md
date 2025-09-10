Dodgetia Handoff Notes

Version: v0.3.3

Overview
- Units: 1m = 55px (fixed). Player speed 3.9 m/s. Grid tile = 55px.
- Hit rules: Danger (red) = instant end. Caution (yellow) = 3 hits end, optional ignore via overlay option.
- One enemy on screen. Despawn → immediate respawn from allowed options.

Code Layout
- index.html: Canvas, overlay UI, Enemy Options, scripts (classic scripts).
- src/main.js: loop, input, HUD, spawner, images, VERSION.
- src/enemies.js: monolithic enemies + shared helpers (still contains all except Vanya/Hisui/DebiMarlene are now provided by split files which override).
- src/enemies/vanya.js: Vanya (Q/E/R) split, distance triggers Q 8.3m / E 7.0m / R 6.7m. Feint 0–0.75s. R two rectangles (front/back) fixed at cast.
- src/enemies/hisui.js: Hisui split. Local utils included to avoid cross-file deps.
- src/enemies/katja.js: Katja split. R is trapezoid (near 3m / far 6m / height 5m), center clamped within 0–23m with ±1.0m jitter, polygon hit.
- src/enemies/debimarlene.js: Debi & Marlene split. Local utils included. See details below.
- docs/ENEMIES.md, docs/ENEMIES_SUMMARY.md: specs and summary (both at v0.3.3).

Debi & Marlene (current spec highlights)
- Feint: DQ/DE/MQ/ME = 0.0–0.25s. R = 0.0–0.5s.
- Triggers:
  - DQ: 4.5m (body) / 6.0m (placed Marlene)
  - DE: 6.0m
  - MQ: 5.5m (body or placed Debi)
  - ME: 5.5m
  - R: 8.0m
- DQ: 4.5m×1.0m (Caution) + if placed Marlene: Caution orb (0.8m, 18 m/s, 6m), then remove placed Marlene.
- DE: Caution orb (0.8m, 18 m/s, 6m), place Debi, then retreat 2.0m back; switch to Marlene; post-E move-only 0.5s.
- MQ: Caution orb (0.5m, 20 m/s, 6.25m) + if placed Debi: Debi marker charges (1.5m×1.2m sweep, 0.30s/4.5m, Danger), then remove placed Debi.
- ME: self dash (1.5m×1.2m sweep, 0.30s/4.5m, Danger), place Marlene, switch to Debi; post-E move-only 0.5s.
- R: 0.67s cast (fixed preview) → 8m×2m rectangle hit → blink to far side (+8m) → 0.6s wait. R can appear anywhere in queue. Does not clear markers.

Notes
- Enemy Options: “Uncheck all” button exists, but full-off fallback still spawns from default set (intentional per user).
- Images used: touka_tia.png, hisui_touka_55px.png, abigail.png, Luku.png, Katja.png, darko.png, Vanya.png, Debi.png, Marlene.png.

Next Steps (suggested)
- Split remaining enemies: Katja, Darko, Luku, Abigail into src/enemies/<name>.js.
- Optionally extract common geometry helpers into src/enemies/_utils.js and load before enemy files.
- If desired, add quick in-game debug overlay to toggle per-enemy feint ranges/lengths.
