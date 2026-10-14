# Genre Police Visualizer 0.3.3 Beta

[简体中文](#简体中文) · [English](#english) · [日本語](#日本語)

## 简体中文

0.3.3 新增节拍驱动冲击，更新本地节拍识别，并整理设置面板，让音乐响应与动态效果更容易调整。

### 下载

- `Genre-Police-Visualizer-0.3.3-portable.exe`
- `SHA256SUMS.txt`

本版适用于 Windows 10/11 x64。直接运行 EXE 即可，无需安装 Node.js、Python、PyTorch 或单独的 AI 环境。可沿用 0.3.2 的设置、手动修正、自定义曲风和已有 AI 记录。

### 改进与修复

- 新增「音乐响应／节拍驱动」冲击模式：音乐响应跟随音乐事件，节拍驱动只在识别到的拍点触发。
- 节拍驱动支持「随音乐变化／固定强度」。默认仍为音乐响应，节拍强度默认随音乐变化。
- 本地节拍识别更新为 BeatNet+，配合节拍跟踪、静音抑制和音频中断后的状态重置。
- 整理设置分类与顺序，将音乐响应、冲击和动态效果集中分组；增大标签与说明文字，提高对比度，并同步调整中英日韩文案。
- 减少曲风识别和节拍分析中的重复计算与内存分配。

> 节拍识别仍可能漏拍或多拍，效果会随音乐内容与音频输入变化。

> 0.3.3 暂未进行 Authenticode 代码签名。请只从本项目的 GitHub Releases 下载，并使用 `SHA256SUMS.txt` 核对文件。

[完整说明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.md) · [已知问题](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [反馈问题](https://github.com/lbnandy/genre-police-visualizer/issues)

## English

Version 0.3.3 adds beat-driven impacts, updates local beat detection, and reorganizes settings to make music response and motion easier to adjust.

### Download

- `Genre-Police-Visualizer-0.3.3-portable.exe`
- `SHA256SUMS.txt`

This build supports 64-bit Windows 10 and Windows 11. Run the EXE directly; Node.js, Python, PyTorch, and a separate AI environment are not required. Settings, manual corrections, custom genres, and existing AI records from 0.3.2 remain compatible.

### Improvements and fixes

- Added music-responsive and beat-driven impact modes. Music response follows musical events; beat-driven mode triggers impacts only on detected beats.
- Beat-driven mode offers music-dependent or fixed strength. Defaults remain music-responsive impacts and music-dependent beat strength.
- Updated local beat detection to BeatNet+, with beat tracking, silence gating, and state resets after audio interruptions.
- Reorganized settings, grouping music response, impacts, and motion together. Increased label and help-text sizes and contrast, with matching wording updates in Chinese, English, Japanese, and Korean.
- Reduced repeated computation and memory allocation in genre recognition and beat analysis.

> Beat detection can still miss beats or produce extra detections. Results depend on the music and audio input.

> Version 0.3.3 is not Authenticode-signed. Download it only from this project's GitHub Releases and verify it with `SHA256SUMS.txt`.

[Full README](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.en.md) · [Known issues](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [Report an issue](https://github.com/lbnandy/genre-police-visualizer/issues)

## 日本語

0.3.3 では、ビート駆動のインパクトを追加し、ローカルのビート検出を更新しました。設定も整理し、音楽への反応や動きを調整しやすくしました。

### ダウンロード

- `Genre-Police-Visualizer-0.3.3-portable.exe`
- `SHA256SUMS.txt`

Windows 10/11 x64 に対応しています。EXE を直接実行でき、Node.js、Python、PyTorch、追加の AI 環境は必要ありません。0.3.2 の設定、手動修正、カスタムジャンル、既存の AI 記録はそのまま利用できます。

### 改善と修正

- インパクトモードに「音楽反応／ビート駆動」を追加しました。音楽反応は音楽の変化に追従し、ビート駆動は検出した拍でのみ反応します。
- ビート駆動では、強さを「音楽に追従／固定」から選べます。初期値は引き続き音楽反応で、ビートの強さは音楽に追従します。
- ローカルのビート検出を BeatNet+ に更新し、拍の追跡、無音時の抑制、音声中断後の状態リセットに対応しました。
- 設定の分類と順序を見直し、音楽への反応、インパクト、モーションを同じグループにまとめました。項目名と説明文の文字サイズ・コントラストを改善し、中英日韓の表現も合わせて調整しました。
- ジャンル認識とビート解析の重複計算やメモリー割り当てを削減しました。

> 拍の見逃しや余分な検出が発生する場合があります。検出結果は音楽の内容や音声入力によって変わります。

> 0.3.3 は Authenticode 署名を行っていません。本プロジェクトの GitHub Releases からのみダウンロードし、`SHA256SUMS.txt` で確認してください。

[詳しい説明](https://github.com/lbnandy/genre-police-visualizer/blob/main/README.ja.md) · [既知の問題](https://github.com/lbnandy/genre-police-visualizer/blob/main/docs/KNOWN_ISSUES.md) · [問題を報告](https://github.com/lbnandy/genre-police-visualizer/issues)
