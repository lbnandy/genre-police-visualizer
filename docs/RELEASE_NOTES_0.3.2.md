# Genre Police Visualizer 0.3.2 Beta

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語)

## 简体中文

0.3.2 主要调整多种曲风的视觉效果，并改善 Big Room、Future Bass 等模型未直接支持的曲风在 AI 判断和历史记录中的处理。

### 下载

- `Genre-Police-Visualizer-0.3.2-portable.exe`
- `SHA256SUMS.txt`

本版适用于 Windows 10/11 x64。直接运行 EXE 即可，无需安装 Node.js、Python、PyTorch 或单独的 AI 环境。可沿用 0.3.1 的设置、手动修正、自定义曲风和已有 AI 记录。

### 改进与修复

- 调整多种曲风的配色、字体、外发光和动态强度，减少背景纹理、粒子与音浪之间的视觉干扰，让文字和可视化的主次更清楚。
- 重新调整 Classical、Folk、Country、Singer-Songwriter、Electro Swing、Jazz 和 Soundtrack 的线条与动态，减少通用霓虹圆环的使用，让画面更贴合各自的风格。
- 调整 Anime 的平涂与文字风格、City Pop 的背景与配色、Vocaloid 的数字节拍细节，并改善 Kawaii Bass 表情线条的清晰度。
- 加强部分 House、Trap 和 Metal 子曲风的视觉区别；细化 Colour Bass 与 Future Riddim 的折射效果、Midtempo Bass 的低频起伏、Moombahton 的错拍摆动，以及 Disco 系列的高光与粒子表现。
- 调整 Breakcore 的分段错位与碎片动态、部分 Trance 分支的旋涡形态，以及 Drum & Bass 系列隧道流线的远近层次。
- 降低 Synthwave 地平线的发光强度，柔和淡化曲名与作者后方的地面网格，减少背景对文字阅读的干扰。
- 补充 Big Room House 的 AI 兼容判断：已有曲目或作者信息指向 Big Room 时，不再仅因模型输出 Electro House、Progressive House 等相近结果就轻易替换；有持续且明确的其他曲风证据时仍可修正。
- 修复再次播放时，已保存的 AI 结果可能覆盖 Big Room、Future Bass、Phonk 等细分曲风的问题。历史记录现在同时保留相关兼容证据，并兼容旧版记录。
- 完善上述曲风在开启或关闭曲风变化检测时的处理，包括曲目信息晚于历史记录到达，以及动态切换后恢复原曲风的情况。
- 更新部分依赖，修复已知安全问题。

> 本次未更换 AI 模型，也未增加模型原生输出的曲风标签。兼容判断会结合已有曲目信息，不代表模型现在能单凭音频直接识别 Big Room、Future Bass 等曲风。

> 0.3.2 暂未进行 Authenticode 代码签名。请只从本项目的 GitHub Releases 下载，并使用 `SHA256SUMS.txt` 核对文件。

[完整说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.md) · [0.3.1 到 0.3.2 的改动](https://github.com/lbnandy/genre-police-visualizer/compare/v0.3.1...v0.3.2) · [反馈问题](https://github.com/lbnandy/genre-police-visualizer/issues)

## English

Version 0.3.2 refines the visuals for several genres and improves how AI decisions and saved results handle styles such as Big Room and Future Bass that the model does not directly support.

### Download

- `Genre-Police-Visualizer-0.3.2-portable.exe`
- `SHA256SUMS.txt`

This build supports 64-bit Windows 10 and Windows 11. Run the EXE directly; Node.js, Python, PyTorch, and a separate AI environment are not required. Settings, manual corrections, custom genres, and existing AI records from 0.3.1 remain compatible.

### Improvements and fixes

- Refined genre colors, typography, glow, and motion intensity. Reduced competition between background patterns, particles, and the spectrum to keep text and visuals clearer.
- Revised the lines and motion used by Classical, Folk, Country, Singer-Songwriter, Electro Swing, Jazz, and Soundtrack, reducing generic neon rings in favor of treatments suited to each style.
- Refined Anime's flat shading and lettering, City Pop's background and palette, and Vocaloid's digital rhythm details. Improved the clarity of Kawaii Bass facial lines.
- Strengthened visual distinctions between selected House, Trap, and Metal subgenres. Refined Colour Bass and Future Riddim refractions, Midtempo Bass low-frequency motion, Moombahton syncopation, and Disco-family highlights and particles.
- Adjusted Breakcore's displaced segments and fragments, vortex shapes for selected Trance styles, and the depth of Drum & Bass tunnel streaks.
- Reduced Synthwave horizon glow and softly faded the ground grid behind the track title and artist to improve readability.
- Added Big Room House compatibility handling. When track or artist information already points to Big Room, nearby model outputs such as Electro House or Progressive House no longer cause an easy replacement. Sustained, clearly different evidence can still correct the result.
- Fixed saved AI results potentially replacing Big Room, Future Bass, Phonk, and related substyles on replay. Records now retain compatibility evidence while remaining compatible with older records.
- Improved handling with genre-change detection both on and off, including track information arriving after a saved result and returning to the original genre after a dynamic change.
- Updated dependencies to address known security vulnerabilities.

> The AI model and its native output labels are unchanged. Compatibility handling uses existing track information; it does not add audio-only recognition of Big Room, Future Bass, or other unsupported labels.

> Version 0.3.2 is not Authenticode-signed. Download it only from this project's GitHub Releases and verify it with `SHA256SUMS.txt`.

[Full README](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.en.md) · [Changes since 0.3.1](https://github.com/lbnandy/genre-police-visualizer/compare/v0.3.1...v0.3.2) · [Report an issue](https://github.com/lbnandy/genre-police-visualizer/issues)

## 日本語

0.3.2 では、各ジャンルのビジュアルを調整し、Big Room や Future Bass など、モデルが直接判定できないジャンルの AI 判定と保存結果の扱いを改善しました。

### ダウンロード

- `Genre-Police-Visualizer-0.3.2-portable.exe`
- `SHA256SUMS.txt`

Windows 10/11 x64 に対応しています。EXE を直接実行でき、Node.js、Python、PyTorch、追加の AI 環境は必要ありません。0.3.1 の設定、手動修正、カスタムジャンル、既存の AI 記録はそのまま利用できます。

### 改善と修正

- 各ジャンルの配色、フォント、発光、動きの強さを調整しました。背景模様・パーティクル・スペクトラムの重なりを抑え、文字とビジュアルを見やすくしました。
- Classical、Folk、Country、Singer-Songwriter、Electro Swing、Jazz、Soundtrack の線や動きを見直しました。共通のネオンリング表現を減らし、それぞれの音楽に合った表現へ調整しました。
- Anime のフラットな色表現と文字、City Pop の背景と配色、Vocaloid のデジタルなリズム表現を調整しました。Kawaii Bass の表情の線も見やすくしました。
- House、Trap、Metal の一部のサブジャンルで見た目の違いを強めました。Colour Bass と Future Riddim の屈折表現、Midtempo Bass の低音に連動する動き、Moombahton のシンコペーション、Disco 系のハイライトとパーティクルも調整しました。
- Breakcore の断片がずれる動き、一部の Trance の渦の形状、Drum & Bass 系のトンネルを流れる光の遠近感を調整しました。
- Synthwave の地平線の発光を抑え、曲名とアーティスト名の後ろにある地面のグリッドを柔らかく薄めて、文字を読みやすくしました。
- Big Room House の互換判定を追加しました。曲やアーティストの情報が Big Room を示している場合、モデルが Electro House や Progressive House など近いジャンルを出しただけでは置き換わりにくくしました。明確に異なる判定が持続する場合は、引き続き修正できます。
- 再生し直したときに、保存済みの AI 結果が Big Room、Future Bass、Phonk などの細かいジャンルを上書きする場合がある問題を修正しました。関連する互換判定の情報も保存し、旧版の記録も引き続き利用できます。
- ジャンル変化の検出がオン・オフのどちらでも、保存結果より後に曲情報が届く場合や、途中でジャンルが変化したあとに元のジャンルへ戻る場合の処理を改善しました。
- 一部の依存ライブラリを更新し、既知のセキュリティ上の問題に対応しました。

> AI モデルや、モデルが直接出力できるジャンルは変更していません。互換判定は既存の曲情報も使う仕組みであり、Big Room や Future Bass などを音声だけで直接判定できるようになるものではありません。

> 0.3.2 は Authenticode 署名を行っていません。本プロジェクトの GitHub Releases からのみダウンロードし、`SHA256SUMS.txt` で確認してください。

[詳しい説明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.ja.md) · [0.3.1 からの変更](https://github.com/lbnandy/genre-police-visualizer/compare/v0.3.1...v0.3.2) · [問題を報告](https://github.com/lbnandy/genre-police-visualizer/issues)
