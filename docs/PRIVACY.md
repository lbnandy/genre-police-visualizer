# Privacy / 隐私说明

Genre Police Visualizer is designed as a local desktop visualizer. It contains no telemetry, analytics, advertising SDK, account system, or automatic crash uploader.

Genre Police Visualizer 以本地桌面可视化为目标，不包含遥测、使用统计、广告 SDK、账号系统或自动崩溃上传。

## Data processed locally / 本机处理的数据

- Windows SMTC now-playing metadata: title, artist, album, artwork, playback state, duration, and position.
- Windows loopback audio for FFT, rhythm, kick, BPM, energy analysis, the bundled local BeatNet ONNX model, and optional local Discogs-EffNet genre assistance. It is not written to disk unless the user explicitly starts a video recording and chooses a destination. Audio and video are never uploaded; AI inference does not call a cloud service.
- Interface preferences, preferred/ignored media-source identifiers, optional API credentials, user genre corrections, and high-confidence local-AI genre memories in Electron's per-user application-data directory.
- A low-resolution sample of pixels immediately behind the overlay for contrast adaptation. The sample is reduced to color statistics, is not saved, and is not sent to the renderer or a network service.

- Windows SMTC 当前播放信息：曲名、艺术家、专辑、封面、播放状态、时长和进度。
- Windows 系统回放音频，仅用于 FFT、节奏、Kick、BPM、能量分析、内置 BeatNet ONNX 模型和可选的本地 Discogs-EffNet 曲风辅助识别；只有用户主动开始视频录制并选择保存位置时才会写入该视频。音频和视频都不会上传，AI 推理不调用云端服务。
- 界面偏好、首选/忽略的媒体来源标识、可选 API 凭据、用户曲风修正和高置信度的本地 AI 曲风记录，保存在 Electron 的当前用户应用数据目录。
- 为自适应对比度读取覆盖层后方的低分辨率屏幕采样；只保留颜色统计，不保存图片，也不发送给渲染器或联网服务。

## Optional network requests / 可选联网请求

When **Online genre lookup** is enabled, the app may send title, artist, album, duration, and storefront/language hints to Apple iTunes Search, Deezer, Last.fm (when a key is configured), Discogs (when a token is configured), and MusicBrainz. Artwork URLs returned by matched catalog records may be loaded. Audio is never transmitted.

At startup, the same option permits one short request to Cloudflare's public `/cdn-cgi/trace` endpoint. No track metadata is included; only the returned two-letter country code is read and cached in memory to choose catalog order. A failure silently keeps the international strategy.

开启**在线曲风查询**时，软件可能向 Apple iTunes Search、Deezer、Last.fm（配置 Key 时）、Discogs（配置 Token 时）和 MusicBrainz 发送曲名、艺术家、专辑、时长与地区/语言提示，并可能加载匹配目录返回的封面链接；绝不会发送音频。

同一开关还允许软件在启动时向 Cloudflare 公开的 `/cdn-cgi/trace` 端点发送一次短请求；请求不包含任何曲目信息，软件只读取两位国家代码并缓存在内存中，用于调整目录查询顺序。请求失败时会静默沿用国际策略。

When **Show synced lyrics** is enabled, title, artist, album, and duration are sent to LRCLIB, NetEase Cloud Music, and QQ Music. Audio, player cookies, and account credentials are never sent. Only strictly matched, time-synchronized results are displayed. Turning the switch off hides lyrics and stops new lyrics-provider requests.

开启**显示同步歌词**时，曲名、艺术家、专辑和时长会发送给 LRCLIB、网易云音乐和 QQ 音乐；不会发送音频、播放器 Cookie 或账户凭据。软件只显示严格匹配且带时间戳的结果；关闭开关会隐藏歌词并停止新的歌词源请求。

The app checks this project's public GitHub Releases list at most once every 24 hours and after a short startup delay. The request contains no track metadata, audio, settings, or account information. Network failures are silent. Manual checks use the same endpoint.

软件会在启动一段时间后检查本项目公开的 GitHub Releases，且每 24 小时最多自动检查一次。请求不包含曲目信息、音频、设置或账户信息；联网失败时不会打扰用户。手动检查使用同一端点。

## Local files / 本地文件

Video is written only after the user starts **Video recording** and selects a destination. The app records its own visualizer output together with the local loopback audio, writes only to that destination, and does not upload the result. Canceling or failing a recording removes its temporary partial file.

只有用户主动开始**视频录制**并选择保存位置后，软件才会把自身可视化画面和本机系统回放音频写入该位置；成片不会上传。取消或失败的录制会清理临时未完成文件。

- `settings.json`: language, scale, window position, motion/idle/media-source preferences, lyric options, online/local genre-analysis preferences, the last update-check time and dismissed release version, optional Last.fm key, and optional Discogs token.
- `genre-corrections.json`: artist/title keys and the genre explicitly chosen by the user.
- `audio-genre-memory.json`: a bounded set of one-way hashed track identities, duration guards, concrete AI genre results, and confidence statistics. It contains no audio or readable title/artist fields and is not a chronological listening log.
- No unmapped-artist log is created.
- Settings left by the retired Spotify Web API integration are removed automatically on the first launch of this version. Spotify playback continues through Windows SMTC and needs no Spotify credential.

- `settings.json`：语言、缩放、窗口位置、动态/闲置/媒体来源偏好、歌词选项、在线/本地曲风分析偏好、上次更新检查时间、暂不提醒的版本，以及可选 Last.fm Key 与 Discogs Token。
- `genre-corrections.json`：艺术家/曲名键与用户明确选择的曲风。
- `audio-genre-memory.json`：数量受限的单向哈希曲目标识、时长校验、具体 AI 曲风结果和置信统计；不包含音频或可直接阅读的曲名/艺术家字段，也不是按时间排列的播放历史。
- 软件不会创建未映射艺术家日志。
- 旧版 Spotify Web API 联动留下的设置字段会在本版本首次启动时自动删除；Spotify 播放联动继续通过 Windows SMTC 工作，不需要 Spotify 凭据。

Deleting the application's per-user data directory removes these settings, corrections, and local-AI memories. Portable packaging does not make this data portable; Electron still uses the current Windows user's application-data directory.

删除本软件的当前用户应用数据目录即可移除这些设置、修正和本地 AI 记录。便携版只表示程序无需安装，Electron 仍把用户数据写入当前 Windows 用户的应用数据目录。

## Diagnostics export / 诊断导出

Diagnostics are written only when the user explicitly chooses **Export diagnostics** and selects a destination. The JSON contains application/system versions, non-secret settings, component status, and SMTC source identifiers. It excludes API credentials, title, artist, album, artwork, lyric text, and listening history. The file is not uploaded automatically.

只有用户主动选择**导出诊断**并指定位置时才会写入诊断 JSON。文件包含应用/系统版本、非敏感设置、组件状态和 SMTC 来源标识；不包含 API 凭据、曲名、艺术家、专辑、封面、歌词正文或收听历史，也不会自动上传。
