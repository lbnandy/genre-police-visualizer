# Genre Police Visualizer 0.3.0 Beta

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語)

## 简体中文

0.3.0 加入了全屏模式、本地 AI 曲风辅助、视频录制与透明截图，并对曲风树、视觉表现、设置结构和渲染性能做了一次较完整的扩展与整理。

### 下载

- `Genre-Police-Visualizer-0.3.0-portable.exe`
- `SHA256SUMS.txt`

本版适用于 Windows 10/11 x64。下载 EXE 后即可运行，不需要另行安装 Node.js、Python、PyTorch 或 AI 运行环境。

### 新增功能

- 新增全屏模式，支持上下与左右结构；可以在全屏内切换结构、显示文字、控制播放、保存画面、录制视频、打开设置和退出全屏。
- 新增视频录制，将可视化与系统播放声音实时保存为 MP4；系统不支持时自动使用 WebM。
- 新增透明 PNG 画面保存，并可在设置中决定是否显示画面保存和录制按钮。
- 新增本地 Discogs-EffNet 曲风辅助识别及可选的播放中曲风变化检测；为已有的艺术家曲风参考增加独立开关，并加入保守的本地高置信结果记忆。音频不会上传。
- 新增曲风候选面板，可临时选择本曲视觉或永久记住修正。
- 新增更新提醒：启动后每天最多自动检查一次 GitHub Releases，也可在设置中手动检查，并可暂不提醒当前版本。
- 新增桌面层模式，使用“显示桌面”后仍可见，并与已有的始终置顶选项互斥。
- 新增柔和、标准、强烈三档画面响应和实时 FPS 诊断。
- 新增播放帧率上限，可跟随显示器，或选择 120、90、60、30 FPS；高刷新率显示器下也会保持稳定的调度节奏。
- 新增 23 种可选择的曲风视觉，包括 Ambient、Downtempo、Chillout、Instrumental Hip-Hop、Lo-fi Hip-Hop、IDM、Glitch、Blues，以及更细的 R&B、Soul、Jazz 和 Classical 分支。

### 改进与修复

- 重新梳理曲风树主干和子类位置，并细化 Hardcore 与 Hardstyle、Dubstep、House、Drum & Bass、Techno、Trance、J-Pop、UK Garage、R&B、Jazz 和 Classical 等体系的视觉区分。
- 透明窗口外缘现在会自动放行鼠标；主窗口会在任务栏保留入口，方便被其他窗口遮挡后找回。
- 重新整理设置页、四种界面语言的文字及 Material 风格图标，并让全屏设置只显示与当前模式相关的选项。
- 重做胶囊、海报和全屏模式的动态画布分辨率策略：按画面实际占用的屏幕像素和 Windows 显示缩放进行渲染，避免小尺寸界面继续承担大画布开销，并仅在持续性能压力下自适应降低分辨率。
- 复用频谱轮廓的逐帧计算空间、跳过未变化的动态样式，并分别控制大面积主题背景与轻量前景效果的更新频率，减少复杂曲风的内存波动和重绘开销；歌词逐字动画与轻量前景反馈最高以 60 FPS 更新。
- 主窗口隐藏或最小化后会自动暂停画面渲染、音频分析、本地模型采样、鼠标命中检测和自适应背景采样；恢复显示时会重新连接系统音频并清理旧的渲染计时，播放器在隐藏期间重启也能正常恢复。正在录制时仍保持完整运行。
- 修复部分曲风标题与歌词发光被裁切、Hip-Hop 装饰条被音浪遮挡，以及暂停后无法继续播放等既有问题。

> 0.3.0 暂未进行 Authenticode 代码签名，Windows SmartScreen 可能显示“无法识别的发布者”。请只从本项目的 GitHub Releases 下载，并使用 `SHA256SUMS.txt` 核对文件。

[完整说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.md) · [隐私说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/PRIVACY.md) · [已知限制](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [完整更新记录](https://github.com/lbnandy/genre-police-visualizer/compare/v0.2.0...v0.3.0) · [反馈问题](https://github.com/lbnandy/genre-police-visualizer/issues)

## English

Version 0.3.0 adds fullscreen presentation, on-device genre assistance, video recording, and transparent snapshots, alongside a substantial expansion of the genre taxonomy, visual catalog, settings structure, and rendering performance.

### Download

- `Genre-Police-Visualizer-0.3.0-portable.exe`
- `SHA256SUMS.txt`

This portable build supports Windows 10/11 x64. Download and run the EXE; Node.js, Python, PyTorch, and a separate AI runtime are not required.

### New features

- Added fullscreen presentation with stacked and side-by-side structures plus in-place layout, text, transport, snapshot, recording, settings, and exit controls.
- Added real-time MP4 recording of the visualization and system playback audio, with automatic WebM fallback.
- Added transparent PNG snapshots and settings for showing or hiding the snapshot and recording shortcuts.
- Added optional on-device Discogs-EffNet genre assistance and sustained genre-change detection, plus an independent switch for the existing artist references and conservative local high-confidence result memory. Audio is never uploaded.
- Added a genre-candidate panel for choosing a visual for the current track or permanently remembering a correction.
- Added update reminders with at most one automatic GitHub Releases check per day, manual checks in settings, and per-version dismissal.
- Added desktop-layer mode that remains visible after Show Desktop and is mutually exclusive with the existing always-on-top option.
- Added Gentle, Standard, and Strong visual-response presets plus a live FPS diagnostic.
- Added playback frame-rate limits with Follow display, 120, 90, 60, and 30 FPS choices, using stable deadline scheduling on high-refresh displays.
- Added 23 selectable genre visuals, including Ambient, Downtempo, Chillout, Instrumental Hip-Hop, Lo-fi Hip-Hop, IDM, Glitch, Blues, and more detailed R&B, Soul, Jazz, and Classical branches.

### Improvements and fixes

- Reorganized taxonomy roots and subgenre placement, and refined the visual distinctions across Hardcore and Hardstyle, Dubstep, House, Drum & Bass, Techno, Trance, J-Pop, UK Garage, R&B, Jazz, and Classical families.
- Transparent outer regions now pass pointer input through automatically, and the main window keeps a taskbar entry so it can be recovered when covered by other windows.
- Reorganized settings, revised all four interface languages, standardized Material-style icons, and made fullscreen settings context-sensitive.
- Reworked dynamic-canvas resolution across capsule, poster, and fullscreen modes so rendering follows the scene's actual on-screen pixel footprint and Windows display scaling, avoiding oversized backing stores for smaller layouts while retaining adaptive reduction under sustained performance pressure.
- Reused per-frame spectrum geometry storage, skipped unchanged dynamic-style writes, and separated the update rates of broad themed backdrops from lightweight foreground effects to reduce memory churn and repaint cost in complex themes; word-by-word lyrics and lightweight foreground feedback now update at up to 60 FPS.
- The main window now suspends rendering, audio analysis, local-model feeds, pointer hit testing, and adaptive backdrop sampling while hidden or minimized. When shown again, it refreshes system-audio capture and render timing so playback can recover even if the player restarted while hidden; active recording continues at full priority.
- Fixed existing issues including clipped genre-title and lyric glows, Hip-Hop accent bars being obscured by the spectrum, and playback failing to resume after pausing.

> Version 0.3.0 is not Authenticode-signed, so Windows SmartScreen may show an “Unknown publisher” warning. Download it only from this project's GitHub Releases and verify it with `SHA256SUMS.txt`.

[Full README](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.en.md) · [Privacy](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/PRIVACY.md) · [Known limitations](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [Full changelog](https://github.com/lbnandy/genre-police-visualizer/compare/v0.2.0...v0.3.0) · [Report an issue](https://github.com/lbnandy/genre-police-visualizer/issues)

## 日本語

0.3.0 では、フルスクリーン表示、ローカル AI によるジャンル補助、動画録画、透明 PNG 保存を追加し、ジャンル分類、ビジュアル、設定構成、描画性能を大幅に拡張・整理しました。

### ダウンロード

- `Genre-Police-Visualizer-0.3.0-portable.exe`
- `SHA256SUMS.txt`

Windows 10/11 x64 対応のポータブル版です。EXE をダウンロードしてそのまま実行でき、Node.js、Python、PyTorch、追加の AI 実行環境は必要ありません。

### 新機能

- 上下／左右構成を切り替えられるフルスクリーン表示を追加し、文字、再生、画像保存、録画、設定、終了を画面内で操作できるようにしました。
- ビジュアルとシステム再生音声を MP4 へ保存するリアルタイム録画を追加し、非対応環境では WebM を使用します。
- 透明 PNG の画像保存と、画像保存／録画ボタンの表示設定を追加しました。
- ローカル Discogs-EffNet によるジャンル補助と、任意で有効にできる持続的なジャンル変化の検出を追加しました。既存のアーティスト参照には独立したスイッチを追加し、慎重な高信頼結果メモリーも導入しました。音声はアップロードされません。
- 現在の曲だけにビジュアルを適用するか、修正を記憶できるジャンル候補パネルを追加しました。
- 更新通知を追加しました。起動後の GitHub Releases 自動確認は 1 日 1 回までで、設定からの手動確認とバージョン単位の通知停止にも対応します。
- 「デスクトップの表示」後も残るデスクトップレイヤーモードを追加し、既存の「常に手前に表示」と排他的に動作するようにしました。
- 穏やか／標準／強いの 3 段階の画面応答プリセットと、リアルタイム FPS 診断を追加しました。
- 再生中のフレームレート上限を追加し、ディスプレイ連動、120、90、60、30 FPS を選択できるようにしました。高リフレッシュレート環境でも安定したタイミングで描画します。
- Ambient、Downtempo、Chillout、Instrumental Hip-Hop、Lo-fi Hip-Hop、IDM、Glitch、Blues、細分化した R&B、Soul、Jazz、Classical を含む、選択可能な 23 種類のジャンルビジュアルを追加しました。

### 改善と修正

- ジャンルツリーのルートとサブジャンル配置を整理し、Hardcore／Hardstyle、Dubstep、House、Drum & Bass、Techno、Trance、J-Pop、UK Garage、R&B、Jazz、Classical などの視覚的な違いを細かく調整しました。
- 透明な外周部分ではマウス入力を自動的に背後へ通し、ほかのウィンドウに隠れた場合でも戻せるよう、メインウィンドウをタスクバーにも表示するようにしました。
- 設定画面と 4 言語の文言を整理し、Material 系アイコンを統一して、フルスクリーン中は関連する設定だけを表示するようにしました。
- カプセル、ポスター、フルスクリーンの動的キャンバス解像度を見直し、実際の画面占有ピクセル数と Windows の表示スケールに合わせて描画するようにしました。小さい表示で過大なキャンバスを保持せず、継続的な性能低下時にのみ解像度を段階的に調整します。
- スペクトラム形状のフレーム内作業領域を再利用し、変化のない動的スタイル更新を省略しました。広いテーマ背景と軽量な前景効果の更新頻度も分離し、複雑なジャンルでのメモリ変動と再描画負荷を抑えています。歌詞の文字単位アニメーションと軽量な前景フィードバックは最大 60 FPS で更新します。
- メインウィンドウを非表示または最小化すると、描画、音声解析、ローカルモデルへの入力、マウス判定、背景サンプリングを自動的に休止します。再表示時にはシステム音声キャプチャと描画タイミングを更新するため、非表示中にプレイヤーを再起動しても正常に復帰します。録画中は通常どおり動作を継続します。
- ジャンル名と歌詞の発光が切れる問題、Hip-Hop の装飾バーがスペクトラムに隠れる問題、一時停止後に再生を再開できない問題など、既存機能の不具合を修正しました。

> バージョン 0.3.0 は Authenticode 署名を行っていないため、Windows SmartScreen に「不明な発行元」と表示される場合があります。本プロジェクトの GitHub Releases からのみダウンロードし、`SHA256SUMS.txt` でファイルを確認してください。

[詳しい説明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.ja.md) · [プライバシー](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/PRIVACY.md) · [既知の制限](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [完全な変更履歴](https://github.com/lbnandy/genre-police-visualizer/compare/v0.2.0...v0.3.0) · [問題を報告](https://github.com/lbnandy/genre-police-visualizer/issues)
