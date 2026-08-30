# Genre Police Visualizer 0.2.0 Beta

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語)

## 简体中文

本次更新加入了自定义曲风与哔哩哔哩可视化，重新整理设置界面，并继续改进曲风识别、节拍响应和现有视觉效果。

### 下载

- `Genre-Police-Visualizer-0.2.0-portable.exe`
- `SHA256SUMS.txt`

本版适用于 Windows 10/11 x64，下载 EXE 后即可运行，不需要另行安装 Node.js、Python、PyTorch 或 AI 运行环境。

### 新增功能

- 新增自定义曲风，可设置显示名称、识别别名、艺术家、基础视觉效果及三种自定义主题色。
- 新增艺术家补充规则，可将指定艺术家关联到现有曲风。
- 新增曲风数据导入与导出，支持迁移曲目修正、自定义曲风和艺术家规则。
- 新增哔哩哔哩兜底识别：仅在清理到哔哩哔哩播放器后缀，且其他识别结果仍未知时启用。
- 新增哔哩哔哩专属可视化，包括小电视、弹幕及粉蓝背景动态。
- 设置中新增鼠标穿透、本地节拍增强和空闲帧率限制开关。
- 界面缩放新增 `50%` 与 `60%`，完整范围调整为 `50%–150%`。
- 首次启动会根据 Windows 系统语言自动选择界面语言；不支持的语言默认使用英文。

### 改进与修复

- 重新设计设置界面，按界面、歌词、播放、曲风和应用五个分栏组织选项。
- 优化胶囊与海报布局下的设置面板尺寸、滚动和视觉一致性。
- 新安装的默认界面大小由 `120%` 调整为 `100%`。
- 没有艺术家的网页或本地曲目现在也可以保存曲风修正。
- 支持清理哔哩哔哩网页播放器的标题后缀。
- 网易云音乐未提供系统媒体会话时，会直接提示「开启SMTC」的勾选位置。
- 调整 BeatNet 与本地音频分析的配合，减少低置信度结果造成的误触发，同时保留 DSP 兜底。
- 空闲状态的限制帧率由 `15 FPS` 调整为 `30 FPS`，并允许在设置中关闭限制。
- 优化 Synthwave 的山峦与地平线、Trance 粒子冲击亮度及 Kawaii Bass 表情响应。
- 调整 Future Bass、Kawaii Bass、Pop、J-Pop 等曲风的背景明暗与中心区域形状。
- 优化长标题的往返滚动，减少抽动、端点截断和显示不全。
- 修复胶囊布局中歌词翻译扫词时，高亮文字偶尔显示为省略号的问题。
- 统一设置界面的术语和文字层级，并在非中文界面中隐藏仅适用于中文歌词翻译的选项。

> 0.2.0 暂未进行 Authenticode 代码签名，Windows SmartScreen 可能显示“无法识别的发布者”。请只从本项目的 GitHub Releases 下载，并使用 `SHA256SUMS.txt` 核对文件。

[完整说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.md) · [隐私说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/PRIVACY.md) · [已知限制](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [完整更新记录](https://github.com/lbnandy/genre-police-visualizer/compare/v0.1.0...v0.2.0) · [反馈问题](https://github.com/lbnandy/genre-police-visualizer/issues)

## English

This release adds custom genres and a dedicated Bilibili visual, reorganizes settings, and continues to refine genre recognition, rhythm response, and existing visual styles.

### Download

- `Genre-Police-Visualizer-0.2.0-portable.exe`
- `SHA256SUMS.txt`

This portable build supports Windows 10/11 x64. Download and run the EXE; Node.js, Python, PyTorch, and a separate AI runtime are not required.

### New features

- Added custom genres with a display name, recognition aliases, artists, a base visual, and optional overrides for all three theme colors.
- Added supplemental artist rules for associating a specific artist with an existing genre.
- Added genre data import and export for remembered track corrections, custom genres, and supplemental artist rules.
- Added a conservative Bilibili fallback that only applies after a Bilibili player suffix is removed and all other genre resolution remains unknown.
- Added a dedicated Bilibili visual with a TV signature, one-way danmaku, and pink-and-blue background motion.
- Added settings controls for mouse passthrough, local rhythm enhancement, and idle frame limiting.
- Added 50% and 60% interface scales, expanding the complete range to 50%-150%.
- First launch now follows the Windows system language, with English used when the locale is unsupported.

### Improvements and fixes

- Reorganized settings into Appearance, Lyrics, Playback, Genre, and App tabs.
- Improved settings sizing, scrolling, and visual consistency in both capsule and poster layouts.
- Changed the new-install interface scale from 120% to 100%.
- Allowed web and local tracks without artist metadata to save a remembered genre correction.
- Added cleanup for the Bilibili web player suffix in displayed titles.
- Added a direct notice pointing to the exact Enable SMTC checkbox when NetEase Cloud Music is running without a Windows media session.
- Retuned BeatNet and local audio analysis to reduce low-confidence false triggers while preserving the DSP fallback.
- Raised the idle render limit from 15 FPS to 30 FPS and made it optional.
- Refined Synthwave scenery and horizon depth, Trance particle impact brightness, and Kawaii Bass expression response.
- Adjusted the backdrop brightness and central shapes used by Future Bass, Kawaii Bass, Pop, and J-Pop.
- Improved overflowing title motion to avoid jitter, clipped endpoints, and incomplete text.
- Fixed highlighted lyric translations occasionally collapsing to an ellipsis during capsule lyric sweeps.
- Standardized settings terminology and type hierarchy, and hid Chinese-only lyric translation controls in other interface languages.

> Version 0.2.0 is not Authenticode-signed, so Windows SmartScreen may show an “Unknown publisher” warning. Download it only from this project's GitHub Releases and verify it with `SHA256SUMS.txt`.

[Full README](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.en.md) · [Privacy](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/PRIVACY.md) · [Known limitations](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [Full changelog](https://github.com/lbnandy/genre-police-visualizer/compare/v0.1.0...v0.2.0) · [Report an issue](https://github.com/lbnandy/genre-police-visualizer/issues)

## 日本語

このリリースでは、カスタムジャンルと Bilibili 専用ビジュアルを追加し、設定画面を再構成しました。ジャンル判定、リズム応答、既存ビジュアルの調整も行っています。

### ダウンロード

- `Genre-Police-Visualizer-0.2.0-portable.exe`
- `SHA256SUMS.txt`

Windows 10/11 x64 対応のポータブル版です。EXE をダウンロードしてそのまま実行でき、Node.js、Python、PyTorch、追加の AI 実行環境は必要ありません。

### 新機能

- 表示名、判定用の別名、アーティスト、ベースとなるビジュアル、3 つのテーマカラーを設定できるカスタムジャンルを追加しました。
- 特定のアーティストを既存ジャンルに関連付ける補助アーティストルールを追加しました。
- 保存済みの曲別修正、カスタムジャンル、補助アーティストルールを移行できるインポート／エクスポートを追加しました。
- Bilibili のプレイヤー接尾辞を削除し、他の判定結果が不明な場合にだけ使用する控えめな Bilibili フォールバックを追加しました。
- 小型テレビ、右から左へ流れる弾幕、ピンクとブルーの背景モーションを備えた Bilibili 専用ビジュアルを追加しました。
- マウス透過、ローカルリズム強化、アイドル時のフレーム制限を設定画面から切り替えられるようにしました。
- 50% と 60% の表示倍率を追加し、全体の範囲を 50%～150% に拡張しました。
- 初回起動時に Windows のシステム言語を使用し、未対応の言語では英語を選択するようにしました。

### 改善と修正

- 設定画面を「外観」「歌詞」「再生」「ジャンル」「アプリ」のタブに再構成しました。
- カプセル／ポスター両レイアウトで、設定画面のサイズ、スクロール、視覚的一貫性を改善しました。
- 新規インストール時の表示倍率を 120% から 100% に変更しました。
- アーティスト情報のないウェブ動画やローカル曲でも、ジャンル修正を保存できるようにしました。
- 表示タイトルから Bilibili ウェブプレイヤーの接尾辞を削除するようにしました。
- NetEase Cloud Music が Windows メディアセッションを公開していない場合、「开启SMTC」チェックボックスの場所を直接案内するようにしました。
- BeatNet とローカル音声解析の連携を調整し、DSP フォールバックを維持しながら低信頼度の誤反応を減らしました。
- アイドル時の描画上限を 15 FPS から 30 FPS に変更し、設定で無効化できるようにしました。
- Synthwave の山と地平線、Trance のインパクト時の粒子輝度、Kawaii Bass の表情応答を改善しました。
- Future Bass、Kawaii Bass、Pop、J-Pop の背景の明るさと中央形状を調整しました。
- 長いタイトルの往復スクロールを改善し、揺れ、端の欠け、表示不足を抑えました。
- カプセルレイアウトの歌詞スイープ中に、翻訳のハイライトが省略記号になることがある問題を修正しました。
- 設定の用語と文字階層を統一し、中国語以外の UI では中国語翻訳専用の歌詞設定を非表示にしました。

> バージョン 0.2.0 は Authenticode 署名を行っていないため、Windows SmartScreen に「不明な発行元」と表示される場合があります。本プロジェクトの GitHub Releases からのみダウンロードし、`SHA256SUMS.txt` でファイルを確認してください。

[詳しい説明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.ja.md) · [プライバシー](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/PRIVACY.md) · [既知の制限](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [完全な変更履歴](https://github.com/lbnandy/genre-police-visualizer/compare/v0.1.0...v0.2.0) · [問題を報告](https://github.com/lbnandy/genre-police-visualizer/issues)
