<h1 align="center">Genre Police Visualization</h1>

<p align="center">根据正在播放的音乐曲风切换视觉语言的 Windows 桌面音乐可视化</p>

<p align="center">
  简体中文 · <a href="README.en.md">English</a> · <a href="README.ja.md">日本語</a>
</p>

Genre Police Visualization 会读取 Windows 当前播放信息并分析系统回放音频，尝试判断正在播放的音乐属于什么曲风，再切换可视化结构、背景、字体和动态表现。它不只是为不同曲风更换配色，而是尽量让不同类型的音乐拥有不同的视觉语言。

当前为 `0.1.0` 测试版。设计现阶段以 EDM 为主，已经覆盖 20 多个主要曲风体系；其中一部分已经做了较细调整，其余内容仍会继续补充和修正。

## 下载

**[前往 Releases 下载 Windows 便携版](../../releases)**

- 系统要求：Windows 10 或 Windows 11，64 位（x64）。
- 下载 `Genre-Police-Visualization-0.1.0-portable.exe` 后直接运行，无需安装。
- 不需要另外安装 Node.js、Python、PyTorch 或 AI 运行环境。
- 建议同时下载 `SHA256SUMS.txt` 并核对文件校验值。

`0.1.0` 尚未进行 Authenticode 代码签名，因此 Windows SmartScreen 可能显示“无法识别的发布者”。请只从本项目的 GitHub Releases 页面下载。

## 界面预览

![Electro House 胶囊型界面](docs/screenshots/electro-house-capsule.png)

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/trance-poster.png" alt="Trance 海报型界面" /></td>
    <td align="center"><img src="docs/screenshots/dubstep-poster.png" alt="Dubstep 海报型界面" /></td>
  </tr>
  <tr>
    <td align="center">Trance · 海报型</td>
    <td align="center">Dubstep · 海报型</td>
  </tr>
</table>

![Neurofunk 胶囊型界面](docs/screenshots/neurofunk-capsule.png)

## 主要功能

- **曲风视觉**：根据识别结果切换可视化结构、背景设计、字体、粒子和动态表现，而不只更换颜色。
- **两种布局**：支持胶囊型与海报型；两种布局分别保存设置，并可使用曲风背景或与桌面壁纸融合的自适应背景。
- **实时音频响应**：频谱、节奏、BPM、能量和冲击反馈由系统回放音频驱动；内置本地 BeatNet ONNX 模型辅助节拍判断。
- **当前播放信息**：读取曲名、作者、专辑、封面、播放状态和进度，并提供上一首、播放/暂停、下一首控制。
- **同步歌词**：支持歌词同步显示、单词或字符高亮，以及歌词翻译（如数据源可用）；可调整延迟或完全关闭歌词查询。
- **桌面使用设置**：支持 70%–150% 等比缩放、标准/柔和动态、窗口位置记忆、媒体来源选择、鼠标穿透和无音乐时行为。
- **多语言界面**：软件界面支持简体中文、English、日本語和한국어。

## 支持范围

只要播放器向 Windows 发布系统媒体会话，Genre Police Visualization 就可以读取它。Apple Music、Spotify、QQ 音乐、网易云音乐、酷狗、YouTube Music 和 Amazon Music 等播放器均可使用，但不同版本提供的封面、进度或曲风信息可能不完全一致。

当前重点覆盖的曲风包括：

- Hardcore、Hardstyle、House、Future Bass、Dubstep、EDM Trap
- Drum & Bass、UK Garage、Breakbeat、Techno、Trance、Synthwave
- Pop、J-Pop、K-Pop、Rock、Metal、Hip-Hop、R&B
- Jazz、Classical、Soundtrack、Country、Folk、Latin、Reggae 等常见大类

曲风判断会综合播放器元数据、公开音乐目录、本地规则和用户修正。混合曲风、Remix、合集以及跨风格艺人仍可能判断不准，不能把显示结果视为绝对分类。

## 使用方法

1. 运行便携版 EXE。
2. 打开支持 Windows 系统媒体会话的播放器并开始播放音乐。
3. 可视化默认出现在主屏幕右下角，托盘区会显示 Genre Police 图标。
4. 通过顶部按钮切换布局；通过设置面板或托盘菜单调整背景、缩放、歌词和动态选项。

如果更换输出设备后画面没有响应，可在托盘菜单中选择“重新捕获系统音频”。

## 隐私与联网

- 系统音频只在本机用于频谱和节奏分析，不会被录制、写入文件或上传。
- 软件不包含遥测、广告 SDK、账号系统或自动崩溃上传。
- 在线曲风查询和同步歌词可以分别关闭；开启时只会向说明中列出的服务发送匹配所需的曲名、作者、专辑和时长等信息，不会发送音频。
- 自适应背景只在本机读取窗口周围的低分辨率颜色统计，不保存屏幕截图。

完整说明见 [隐私说明](docs/PRIVACY.md)。

## 当前限制

- 目前只提供 Windows 10/11 x64 版本。
- 播放器没有发布 Windows 媒体会话时，软件无法取得完整的当前播放信息。
- 逐字高亮通常根据逐行时间戳估算，不等同于数据源提供的真实逐音节时间轴。
- 透明置顶窗口在部分 HDR、多显卡、远程桌面或录屏环境中可能表现不同。
- 当前仍是测试版，部分曲风的识别和视觉设计会继续调整。

更多内容见 [已知问题](docs/KNOWN_ISSUES.md)。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [隐私说明](docs/PRIVACY.md)
- [已知问题](docs/KNOWN_ISSUES.md)
- [更新记录](CHANGELOG.md)
- [第三方组件与许可证](THIRD_PARTY_NOTICES.md)
- [安全政策](SECURITY.md)

## 从源码运行

开发环境要求：Windows 10/11 x64、Node.js 22.12 或更高版本。

```powershell
npm ci
npm start
```

运行测试或生成 Windows 便携版：

```powershell
npm test
npm run dist
```

## 反馈与许可

如果遇到问题或有改进建议，可以在 [Issues](../../issues) 中提交。问题报告可附带软件导出的脱敏诊断文件，但请不要公开 Last.fm Key、Discogs Token 或其他凭据。

项目代码采用 [MIT License](LICENSE)。第三方字体、运行库和本地节拍模型适用各自的许可证，详情见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
