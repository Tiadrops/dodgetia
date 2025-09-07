# Enemies

## Hit Judgment Types

- Danger: Ends the run immediately on first hit. Color: red (#ef4444 series)
- Caution: Ends the run after 3 hits. Color: yellow (#eab308 series)

Current mapping
- W2, E, R-rectangle: Danger (red)
- R-semicircle: Caution (yellow)

Counters
- HUD shows Danger count and Caution count (x/3)

## Hisui (v0.2.4)

- Units: 1m = 55px (fixed)
- Movement: 4.11 m/s chasing the player
- Skills: Uses each exactly once in random order, then leaves
  - Feint: When target is in range for the chosen skill, Hisui keeps approaching for 0.0–0.5s before executing

### Skill W2 (formerly A)
- Telegraph: 0.5s (immobile)
- Hit: Forward rectangle 7.2m × 1.2m at the end of telegraph
 - Judgment: Danger (red)

### Skill E (formerly B)
- Sequence: 0.13s back 2m → 0.325s wait → 0.25s forward 6m → 0.25s wait
- Damage window: During the 0.25s forward dash, circular AoE of radius 1.2m centered on Hisui
 - Engage range for feint/trigger: 4m
 - Judgment: Danger (red)

### Skill R
- Cast1: 0.5s, then hit in a forward semicircle of radius 5.0m
- Cast2: 0.625s, then hit in a forward rectangle 5.5m × 2.0m
- Wait: 0.25s
- Judgment: Semicircle = Caution (yellow), Rectangle = Danger (red)

## Abigail (v0.2.4)

- Units: 1m = 55px (fixed)
- Movement: ~3.9 m/s chasing the player
- Skills: Only W, then leaves

### Skill W
- Telegraph: 0.35s (immobile) with preview
- Hit: Forward cone, radius 5.75m, angle 60° (Danger)
- Aftercast: 0.1s wait, then disappears

## Luku (v0.2.4)

- Units: 1m = 55px (fixed)
- Movement: 3.9 m/s chasing
- Skills: Only Q, then leaves

### Skill Q
- Telegraph: 0.3s (immobile)
- Projectile: square 0.6m side, speed 18 m/s, max range 10m (Danger)
- Aftercast: 0.1s wait, then disappears

## Katja (v0.2.4)

- Units: 1m = 55px (fixed)
- Movement: 3.85 m/s
- Skills: Q and R, each once, then leaves

### Skill Q (Danger)
- Telegraph: 0.25s with preview
- Projectile: square 1.2m side, speed 26 m/s, max range 11m
- Aftercast: 0.1s wait

### Skill R (Danger)
- Range: 23m
- Area: trapezoid forward (near width 3m, far width 6m, height 5m)
- Telegraph: 0.8s with preview
- Aftercast: 0.3s wait

## Options

- In the start overlay, select which enemies can spawn (Hisui, Abigail). Unchecked enemies will not appear.
 - Option: Ignore Caution hits (yellow). When enabled, Caution hits are not counted and do not lead to game over.

### Notes
- Facing: Snapshot of player-facing at skill start is used for hit shapes
- Respawn: Main loop respawns a new Hisui 1s after departure while game is running
## Vanya (v0.2.4)

- Units: 1m = 55px (fixed)
- Movement: 3.85 m/s
- Skills: Q, E, R — uses each once (Q/R allow acting while effect pending)

### Skill Q (Danger)
- Cast: 0.25s, no preview
- Projectile: circle r=0.8m, speed 10.6 m/s, out-and-back
- Path: Outbound 7.5m → reverse toward Vanya at 11 m/s for 7.5m → disappears
- Vanya can act immediately after launching; hit anytime causes Danger

### Skill E (Danger)
- Cast: 0.3s with preview (rectangle width 3.8m along a 7m dash path)
- Dash: 7m at 11.2 m/s; during dash, width 3.8m swept area deals Danger
- Aftercast: 0.01s then continues

### Skill R (Danger)
- Cast: 0.26s, no preview but small cast effect
- Telegraph: Trapezoid (near 0.5m, far 6.7m, length 5.4m) appears; 1.0s later it deals Damage
- Vanya can act while telegraph is pending

## Debi & Marlene (v0.2.4)

- States: Debi and Marlene (switch via E). Start state is random.
- Order:
- Start Debi: DQ → DE → MQ → ME → R
- Start Marlene: MQ → ME → DQ → DE → R

### Marlene Q (Caution + Debi dash)
- Cast: 0.166s (no preview)
- Projectile: circle r=0.5m, speed 20 m/s, range 6.25m (Caution)
- If Debi is placed: Debi dashes with a 1.5m × 1.2m sweep for 4.5m over 0.30s (Danger); Debi marker is removed after

### Marlene E (Danger)
- Cast: 0.2s (no preview)
- Self dash: 1.5m × 1.2m sweep for 4.5m over 0.30s
- Places Marlene marker, switches to Debi, then moves-only for 0.5s

### Debi Q (Caution)
- Cast: 0.15s (no preview)
- Front rectangle: 4.5m × 1.0m (Caution)
- If Marlene is placed: Debi projectile r=0.8m, 18 m/s, 6m (Caution), then remove Marlene marker

### Debi E (Danger)
- Cast: 0.15s (no preview)
- Projectile: r=0.8m, 18 m/s, 6m (Caution)
- Places Debi marker, switches to Marlene, then moves-only for 0.5s

### R (Danger)
- Cast: 0.67s with preview → Rectangle 8m × 2m, then blink to opposite edge and wait 0.6s

## Darko (v0.2.4)

- Units: 1m = 55px (fixed)
- Movement: 3.9 m/s
- Skills: Only E, then leaves

### Skill E (Danger)
- Feint: 0.0–0.5s when within trigger range
- Trigger range: 6.2m (from Darko to player)
- Cast: 0.6s with preview (shows destination AoE at cast start)
- Effect: Blinks/steps 4.0m forward toward the player and applies a circular AoE, radius 2.2m, at the arrival point (Danger)
- Aftercast: 0.1s, then leaves

Notes
- On spawn: 1.0s idle before acting (no skills during this time)
