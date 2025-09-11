Enemy Template (v0.4.1)

Purpose
- 新しいエネミーを追加するための実装テンプレートと手順のまとめ。
- 実装は各ファイル内で完結（ローカルユーティリティ可）。既存キャラへ影響しない方針。

Parameter Checklist（設計時に決める項目）
- アイデンティティ: 表示名、`fileName`、オプションUI表示名
- 単位と基準: 1m=55px 使用、内部は m で定義→`const M = cfg.METER`でpx換算
- 移動:
  - `speedMps`: 地上移動速度[m/s]
  - スポーン位置（端/ランダム/座標）、`spawn_idle` 時間
- ライフサイクル/退場:
  - 退場条件（全スキル使用/単発使用後/タイムアウト）
  - リスポーンポリシーはゲーム側（main.js）準拠
- スキル共通:
  - 使用順（固定/ランダム/条件付）、各スキルの blocking か非 blocking か
  - フェイント: 最大時間[s]、開始距離[m]
  - キャスト: 時間[s]、キャスト中の挙動（停止/移動）
  - 予告: 形状/色（Danger=赤, Caution=黄）/アルファ/固定化の有無（角度・位置のスナップ）
  - ダメージ種別: Danger or Caution（HUD/ゲームオーバー条件に影響）
  - Post-wait: 発動後硬直[s]、E後の move-only 時間など
  - クールダウン/一度だけ使用/並列可否（非 blocking の場合）
- 形状別パラメータ:
  - 投射体（Projectile）: 形（円/正方形）、サイズ[m]、速度[m/s]、射程[m]、命中/消滅条件
  - 矩形（回転）: 長さ[m]、幅[m]、向き、基準点（原点から+X）
  - 扇形: 半径[m]、角度[rad/°]、前方判定
  - 半円/円: 半径[m]
  - 台形/多角形: 近側/遠側幅[m]、高さ[m]、配置オフセット/ジッター
  - ダッシュ/ブリンク: 距離[m]、速度[m/s] or 所要時間[s]、スイープ幅[m]
- トリガー条件:
  - 射程[m]（中心間距離の二乗比較で実装）
  - 追加条件（設置物の有無、使用済みフラグ、順番制約）
- 付随要素:
  - 設置物（マーカー）: 生成/消費タイミング、表示（画像/色）
  - 画像: `img/<Name>.png`、スケール、足元補正、左右反転の基準
  - 表示色: Danger/Caution の塗り/枠の RGBA 推奨値

Recommended Constants（命名と単位の目安）
- 速度: `SPEED = <mps> * M`
- 投射体: `Q_SPEED`, `Q_RANGE`, `Q_SIZE`（m→px）、`Q_CAST`, `Q_WAIT`
- 矩形: `RECT_LEN`, `RECT_WID`（m→px）、`CAST`, `WAIT`
- 扇形: `W_RADIUS`, `W_THETA`
- ダッシュ: `E_DIST`, `E_SPEED` or `E_TIME`, `E_WIDTH`
- 予告: `*_CAST`, `*_T_DELAY`（予告から発生までの遅延）
- フェイント: `*_feint = Math.random() * <maxSec>`、開始距離は `<NAME>_TRIG = <m> * M`

Config Snippet（冒頭に置くと見通しが良い例）
```
// Tunables (m で定義して最後に *M)
const SPEC = {
  speedMps: 3.9,
  spawnIdleS: 1.0,
  skills: {
    Q: {
      triggerM: 8.0, feintMaxS: 0.5, castS: 0.25, postWaitS: 0.10, blocking: true,
      type: 'projectile', hit: 'danger',
      projectile: { shape: 'square', sizeM: 0.8, speedMps: 12.0, rangeM: 8.0 }
    },
    // E/R ...
  }
};
// px換算
const SPEED = SPEC.speedMps * M;
```

File Layout
- 追加先: `src/enemies/<Name>.js`（classic script、ES Modules 不使用）
- 参照: `window.Enemies.<Name> = function(cfg) { ... }` 工場関数を定義
- 返り値: `{ get dead(){...}, update(dt), draw(ctx), _e: e }`

Conventions
- 単位: 1m = 55px（`cfg.METER`）
- 速度: `<m/s> * M` で px/s に換算
- 状態: `spawn_idle` → `move` → `...`（`*_feint`, `*_cast`, `*_dash`, `*_wait` など）
- フェイント: `0..X s` ランダム（`feintVar = Math.random()*X`）
- 予告: cast 中や delay 中に色を薄く（α≈0.25–0.35）、実当たりは濃く（α≈0.45–1.0）
- 判定色: Danger=赤、Caution=黄（描画と当たりのコールバックを一致）
  - Danger: `rgba(239,68,68,*)`
  - Caution: `rgba(234,179,8,*)`

Integration Steps
1) ファイル追加: `src/enemies/<Name>.js` にテンプレートをコピーして改名
2) HTML読込: `index.html` に `<script src="src/enemies/<Name>.js"></script>` を `main.js` より前に追加
3) オプションUI: Startパネルにチェックボックスを追加（id例: `opt-<name>`）
4) スポーン: `src/main.js`
   - `make<Name>()` 関数を追加
   - `allowedEnemyTypes()` でチェックを読み取り、`makeRandomEnemyAllowed()` で生成分岐を追加
5) 画像: `img/` に追加し、`make<Name>()` で `sprite` を渡す
6) ドキュメント: `docs/ENEMIES.md`/`docs/ENEMIES_SUMMARY.md` に仕様追記（任意）

Tips
- 当たり判定はプレイヤー円（`player.x/y`, `player.radius`）との交差で実装
- 射程/条件は `move` ステートで判定、成立時にフェイント → キャストへ遷移
- マーカー/投射体/ダッシュ等の非ブロッキング効果はエネミー本体の `update` 内で毎フレーム更新

Check Before Done（実装後の確認）
- フェイントの開始距離・時間が要件どおりか
- キャスト→予告→ダメージの順が一致し、見た目と判定がズレないか
- Danger/Caution の色と当たりが一致（HUDカウントの期待どおり）
- 非ブロッキングスキルの並行更新（投射体や予告の update）が継続されているか
- 退場条件（使用済み/タイムアウト）が満たされるか
