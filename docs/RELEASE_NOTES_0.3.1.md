# Genre Police Visualizer 0.3.1 Beta

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語)

## 简体中文

0.3.1 主要改进本地 AI 曲风识别的稳定性、完整播放结果的利用方式，以及运行环境异常时的恢复体验。

### 下载

- `Genre-Police-Visualizer-0.3.1-portable.exe`
- `SHA256SUMS.txt`

本版适用于 Windows 10/11 x64。直接运行 EXE 即可，无需安装 Node.js、Python、PyTorch 或单独的 AI 环境。

### 新增功能

- 新增默认开启的「记住 AI 识别结果」设置：从开头到结尾完整播放后，将稳定的全曲判断保存在本机，并在下次播放同一首歌时直接采用；可单独关闭或清除，不影响手动修正，也不会保存音频。
- 新增本地 AI 故障提示与恢复入口，可区分 Visual C++ 运行库不可用、程序组件缺失、被安全软件阻止或文件损坏等情况；其他功能仍可继续使用。

### 改进与修复

- 首次识别会等待更多稳定音频，减少前奏造成的误判；Ambient 开场需要更长的持续证据，已有的可靠艺术家信息仍可帮助更快得出结果。
- 关闭曲风变化检测时，以全曲累计结果判断一首歌；已有完整播放记录会在本次播放中保持采用，不会再被开场的局部结果覆盖。再次完整播放可以更新记录，但中途播放不会覆盖它。
- 开启曲风变化检测时，持续稳定的近期段落仍可切换曲风；识别会先稳定到大类，再细化到子类，并加入切换冷却与短暂停留，避免连续跳动，同时不再限制一首歌内可识别的变化次数。
- 重新调整本地模型的稳定度、置信度和相近曲风判断方式；相关子类会归入同一大类评估，但大类不会再因拥有更多子类而得到额外分数。长期稳定的低分结果也不再依赖过大的固定分差或倍数。
- 主界面和诊断信息现在会区分当前采用结果、候选结果与仍在进行的 AI 分析；静态模式在后台复核完整记录时不会错误显示为尚未得出结论。
- 切换系统音频输出设备时保留当前歌曲已经累计的曲风证据，避免无关的重新识别。
- 修正 Future Bounce 的曲风归属，并补充 Experimental Hip-Hop、Disco 等艺术家及多人合作署名的识别规则。
- 可直接沿用 0.3.0 的设置、曲风修正、补充艺术家、自定义曲风、导入导出文件和已有 AI 记录。

> 0.3.1 暂未进行 Authenticode 代码签名。请只从本项目的 GitHub Releases 下载，并使用 `SHA256SUMS.txt` 核对文件。

[完整说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.md) · [0.3.0 到 0.3.1 的改动](https://github.com/lbnandy/genre-police-visualizer/compare/v0.3.0...v0.3.1) · [反馈问题](https://github.com/lbnandy/genre-police-visualizer/issues)

## English

Version 0.3.1 improves local-AI genre stability, reuse of full-play results, and recovery from runtime failures.

### Download

- `Genre-Police-Visualizer-0.3.1-portable.exe`
- `SHA256SUMS.txt`

This build supports 64-bit Windows 10 and Windows 11. Run the EXE directly; Node.js, Python, PyTorch, and a separate AI environment are not required.

### New features

- Added a default-on **Remember AI recognition results** setting. After a track is played from beginning to end, its stable full-track result is stored locally and used immediately on the next play. The history can be disabled or cleared independently without affecting manual corrections, and audio is never saved.
- Added recoverable Local AI failure guidance for unavailable Visual C++ runtimes, missing components, security-software blocking, and damaged or incompatible files. The rest of the app remains usable.

### Improvements and fixes

- Initial recognition now waits for more stable audio to reduce intro-driven mistakes. Ambient intros require longer sustained evidence, while trusted artist information can still support a faster result.
- With genre-change detection off, one track is judged from cumulative full-track evidence. A saved full-play result remains active for that play instead of being replaced by a local intro; another complete play may update it, while partial playback cannot.
- With genre-change detection on, sustained recent sections may still change genre. Decisions stabilize the major family before refining to a child style, with cooldown and a short hold to prevent rapid consecutive changes. There is no longer a fixed limit on changes within one track.
- Retuned stability, confidence, and related-style evaluation. Related child styles map to the same major family without granting wider families a branch-count score bonus, and a persistent low-score result no longer depends on a large fixed gap or score ratio.
- The HUD and diagnostics now distinguish the adopted result, a challenger, and AI analysis still in progress. Background verification of a saved result in fixed-track mode no longer makes the result appear unsettled.
- Changing the system audio output device now preserves accumulated genre evidence for the current track.
- Corrected the placement of Future Bounce and expanded artist and collaboration handling for Experimental Hip-Hop, Disco, and other reviewed mappings.
- Settings, track corrections, supplemental artists, custom genres, imported or exported genre data, and existing AI records from 0.3.0 remain compatible.

> Version 0.3.1 is not Authenticode-signed. Download it only from this project's GitHub Releases and verify it with `SHA256SUMS.txt`.

[Full README](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.en.md) · [Changes since 0.3.0](https://github.com/lbnandy/genre-police-visualizer/compare/v0.3.0...v0.3.1) · [Report an issue](https://github.com/lbnandy/genre-police-visualizer/issues)

## 日本語

0.3.1 では、ローカル AI のジャンル判定、最後まで再生した結果の活用、実行環境エラーからの復旧を改善しました。

### ダウンロード

- `Genre-Police-Visualizer-0.3.1-portable.exe`
- `SHA256SUMS.txt`

Windows 10/11 x64 に対応しています。EXE を直接実行でき、Node.js、Python、PyTorch、追加の AI 環境は必要ありません。

### 新機能

- 初期状態でオンの「AIの判定結果を記憶」を追加しました。曲を最初から最後まで再生して得た安定した全曲判定を端末内に保存し、次回同じ曲を再生したときにすぐ採用します。手動修正に影響を与えず、個別に無効化・消去でき、音声は保存しません。
- Visual C++ ランタイムの不足、コンポーネントの欠落、セキュリティソフトによるブロック、ファイルの破損や非互換を区別する復旧案内を追加しました。ローカル AI が使えない場合も、ほかの機能は引き続き利用できます。

### 改善と修正

- イントロだけによる誤判定を減らすため、初回判定により長い安定した音声を使うようにしました。Ambient のイントロにはさらに長い継続証拠を求めつつ、信頼できるアーティスト情報による早い判定は維持します。
- ジャンル変化の検出がオフの場合は、曲全体の累積結果で一曲のジャンルを判断します。完全再生の記録がある場合、その再生中はイントロの局所的な結果で置き換えず、再度最後まで再生したときだけ記録を更新します。途中からの再生では上書きしません。
- ジャンル変化の検出がオンの場合は、直近の区間が安定して変化したときに引き続き切り替えます。まず大分類を安定させてから子ジャンルへ細分化し、クールダウンと短い待機時間で連続した切り替えを抑えました。一曲内の切り替え回数に固定上限はありません。
- 安定度、信頼度、近いジャンル同士の評価を調整しました。関連する子ジャンルを先に大分類としてまとめ、低スコアでも長く安定した結果に大きな固定差や倍率を求めないようにしました。
- 画面表示と診断情報で、現在採用中の結果、別の候補、進行中の AI 分析を区別できるようにしました。固定ジャンルモードで保存済み結果をバックグラウンド確認している間も、未確定のようには表示しません。
- システムの音声出力先を切り替えても、現在の曲で蓄積したジャンル判定を保持するようにしました。
- Future Bounce の分類先を修正し、Experimental Hip-Hop、Disco などのアーティストやコラボレーション表記の判定を追加・調整しました。
- 0.3.0 の設定、曲ごとの修正、補助アーティスト、カスタムジャンル、読み書きしたジャンルデータ、既存の AI 記録はそのまま利用できます。

> 0.3.1 は Authenticode 署名を行っていません。本プロジェクトの GitHub Releases からのみダウンロードし、`SHA256SUMS.txt` で確認してください。

[詳しい説明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.ja.md) · [0.3.0 からの変更](https://github.com/lbnandy/genre-police-visualizer/compare/v0.3.0...v0.3.1) · [問題を報告](https://github.com/lbnandy/genre-police-visualizer/issues)
