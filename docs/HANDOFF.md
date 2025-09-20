Dodgetia Handoff Notes

Version: v0.4.1


Current Focus (2025-09-20)
- Debugging Justyna: all skill hits are marked as Caution (yellow) and telegraphs use caution colors until testing is done. Remember to revert to Danger values once QA is satisfied.
- Key files for this debug pass: index.html (options checkbox), src/main.js (makeJustyna wiring), src/enemies/justyna.js (skill logic), docs/ENEMIES*.md (documented spec).
- Per user request: always update this HANDOFF.md so future sessions can sync by reading it (they will be told simply "HANDOFF.mdを見て").

Overview
- Units: 1m = 55px (fixed). Player speed 3.9 m/s. Grid tile = 55px.
- Hit rules: Danger (red) = instant end. Caution (yellow) = 3 hits end, optional ignore via overlay option.
- One enemy on screen. Despawn → immediate respawn from allowed options.

Quick Start
- Open `index.html` in a modern browser（ローカルサーバ不要、classic scripts）。
- Click Start. Right-click to set destination. Dodge enemy skills.
- HUD shows: version / right-click hint / Speed / Survival time / Danger and Caution counts.

Controls & UI
- Right-click: move to clicked world position（ページ全体でコンテキストメニューは抑止済み）。
- Overlay: Start/Restart, score, and options panel.
- Enemy Options: enable/disable spawn per enemy. “Uncheck all” button iterates `ENEMY_OPTIONS` で定義された敵リストを全解除（Justyna含む）。全OFF時はフォールバック候補のいずれかが出現。
- Other: “要注意を無視する” toggles whether Caution hits count/end the game.

Core Mechanics
- Player: `player.speed = 3.9 m/s`（表示は m/s、内部は px/s）。スプライト `img/touka_tia.png`。
- Grid: 55px per tile（=1m）。HiDPIスケーリング対応、見た目 960×540 固定。
- Hits: Danger→即終了、Caution→3回で終了（無視オプション有）。
- Respawn policy: 1画面に常にエネミー1体。退場後は即時（0ms）に補充。

Code Layout
- index.html: Canvas, overlay UI, Enemy Options, scripts (classic scripts).
- src/main.js: loop, input, HUD, spawner, images, VERSION.
- src/enemies.js: registry stub only（全敵は `src/enemies/*.js` に分離済み）。
- src/enemies/vanya.js: Vanya (Q/E/R) split, distance triggers Q 8.3m / E 7.0m / R 6.7m. Feint 0–0.75s. R two rectangles (front/back) fixed at cast.
- src/enemies/hisui.js: Hisui split. Local utils included to avoid cross-file deps.
- src/enemies/katja.js: Katja split. R is trapezoid (near 3m / far 6m / height 5m), center clamped within 0–23m with ±1.0m jitter, polygon hit.
- src/enemies/luku.js: Luku split. Q: 0.3s cast → 0.6m square projectile at 18 m/s, range 10m, Danger; 0.1s aftercast → despawn.
- src/enemies/abigail.js: Abigail split. W: 0.35s cast → 60° cone (radius 5.75m) Danger, 0.1s wait → despawn. Feint 0–0.2s.
- src/enemies/debimarlene.js: Debi & Marlene split. Local utils included. See details below.
- src/enemies/darko.js: Darko split. E: 0.6s cast → blink 4m toward player → 2.2m radius Danger at destination → 0.1s wait.
- src/enemies/justyna.js: Justyna debug build (skills follow caster, R pulses follow position; hits currently Caution).
- src/enemies/haze.js: Haze split. MS=3.98。Q/W/RQ を1回ずつ実行して退場（順序ランダム）。RQ弾に当たると1秒間プレイヤー速度0.7倍。
- docs/ENEMIES.md, docs/ENEMIES_SUMMARY.md: specs and summary (both at v0.4.1).

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

Haze (current spec highlights)
- MS: 3.98 m/s。画像: `img/Haze.png`。
- Q（Caution）: Trigger 7.0m（7m未満ならプレイヤーから離れる方向へ移動して7m確保→Feint 0–0.5s）→ Cast 0.2s → Telegraph 0.45s → 半径1.8mの円を7m先に判定 → Post 0.1s。
- W（Danger）: Trigger 4.0m → 後方1.5m移動 → Cast 0.3s（予告）→ 扇形 5.5m×55° 判定 → Post 0.1s。
- RQ（Caution）: Trigger 13.0m（Feint 0s）→ [Cast 0.33s → 1.0m正方形弾（17 m/s）→ CD 0.6s]×4 → Post 0.1s。弾命中でプレイヤーに1秒間 slow(0.7x)。

Notes
- Enemy Options: `ENEMY_OPTIONS` 配列（src/main.js）がスポーン候補とUIトグルを一元管理。全解除ボタンもここを参照するため、Justynaのような追加敵も自動で対象になる。全OFF時のフォールバック（Hisui〜Vanya）は `fallback: true` で区別。
- Images used: touka_tia.png, hisui_touka_55px.png, abigail.png, Luku.png, Katja.png, darko.png, Vanya.png, Debi.png, Marlene.png.
- New images: Haze.png（Haze）。

Next Steps (suggested)
- Optional: 共通ジオメトリを各キャラにローカルで持たせる方針維持（影響分離）。
- Optional: デバッグ用オーバーレイ（フェイント時間/距離の一時変更）。

Add a New Enemy（手順）
1) `src/enemies/_template.js` を `src/enemies/<Name>.js` にコピーし、名称・スキル・定数を調整。
2) `index.html` に `<script src="src/enemies/<Name>.js"></script>` を追加（`main.js` より前）。
3) `src/main.js`：
   - 画像ロード: `let <name>Image` と `loadImage('img/<Name>.png')` を追加。
   - 生成関数 `make<Name>()` を実装（`onDanger`/`onCaution` コールバック、`sprite` 付与）。
   - `ENEMY_OPTIONS` 配列に id/type/factory/fallback を追記（これで `allowedEnemyTypes()` / `makeRandomEnemyAllowed()` / 全解除ボタンが同期）。
   - オプションUI（Startパネル）にチェックボックスを追加（idは `opt-<name>`）。
4) 仕様ドキュメント: `docs/ENEMIES.md`/`docs/ENEMIES_SUMMARY.md` に追記（任意）。
詳細は `docs/ENEMY_TEMPLATE.md` 参照（パラメータ決定チェックリストあり）。

Version History (recent)
- v0.4.1: ドキュメント拡充（ハンドオフを単独参照で把握可能化）、Haze のQ距離再調整（7m）とリポジション導入。
- v0.4.0: 全エネミーを個別ファイルへ分離、Haze 追加、RQヒット時のスロー導入、レジストリをスタブ化。
