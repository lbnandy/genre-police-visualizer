# Genre Police Visualization 0.1.0 测试版

[简体中文](https://github.com/lbnandy/genre-police-visualization/blob/main/README.md) · [English](https://github.com/lbnandy/genre-police-visualization/blob/main/README.en.md) · [日本語](https://github.com/lbnandy/genre-police-visualization/blob/main/README.ja.md)

Genre Police Visualization 会读取 Windows 当前播放的音乐，尝试识别曲风，并随之切换可视化结构、背景和动态表现。当前设计以 EDM 为主，部分曲风已做较细调整，其余内容仍会继续补充和修正。

## 下载

请下载同一 Release 中的：

- `Genre-Police-Visualization-0.1.0-portable.exe`
- `SHA256SUMS.txt`

本版为 Windows x64 便携版，不需要安装 Node.js、Python、PyTorch 或额外的 AI 运行环境。

## 主要内容

- 自动跟随 Windows 媒体会话，读取曲名、作者、封面、播放状态和进度。
- 根据曲风切换可视化、背景、字体与动态表现，支持胶囊型与海报型两种布局。
- 支持同步歌词、逐字高亮和歌词翻译（如可用）。
- 内置本地 BeatNet ONNX 节奏分析；音频不会被录制、保存或上传。
- 支持 70%–150% 等比缩放、鼠标穿透、开机自启、播放器选择、动态强度与无音乐时行为设置。

## SmartScreen 提示

0.1.0 暂未进行 Authenticode 代码签名，Windows SmartScreen 可能显示“无法识别的发布者”。请只从本项目的 GitHub Releases 下载，并使用 `SHA256SUMS.txt` 核对文件。

## 隐私与联网

系统音频与 AI 节奏分析完全在本机进行。开启在线曲风查询或同步歌词时，软件会把曲名、作者、专辑和时长发送给文档中列出的元数据或歌词服务；这两类查询可分别关闭。详细说明见 [`PRIVACY.md`](https://github.com/lbnandy/genre-police-visualization/blob/main/docs/PRIVACY.md)。

## 已知限制

- 只支持 Windows 10/11 x64。
- 播放器必须向 Windows 发布系统媒体会话；一些浏览器标签页或旧版播放器可能缺少封面或进度。
- 曲风判断依赖公开目录元数据和本地规则，跨曲风艺人、合集、Remix 或本地化艺名仍可能需要用户手动修正。

更完整的限制见 [`KNOWN_ISSUES.md`](https://github.com/lbnandy/genre-police-visualization/blob/main/docs/KNOWN_ISSUES.md)。如果遇到问题，请在项目的 [Issues](https://github.com/lbnandy/genre-police-visualization/issues) 页面提交，并可附上软件导出的脱敏诊断文件；不要粘贴 Last.fm Key 或 Discogs Token。
