# Enemies

## Hit Judgment Types

- Danger: Ends the run immediately on first hit. Color: red (#ef4444 series)
- Caution: Ends the run after 3 hits. Color: yellow (#eab308 series)

Current mapping
- W2, E, R-rectangle: Danger (red)
- R-semicircle: Caution (yellow)

Counters
- HUD shows Danger count and Caution count (x/3)

## Hisui (v0.10)

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

### Notes
- Facing: Snapshot of player-facing at skill start is used for hit shapes
- Respawn: Main loop respawns a new Hisui 1s after departure while game is running
