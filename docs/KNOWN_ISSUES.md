# Known issues / 已知问题

- 系统要求：Windows 10 或 Windows 11 的 64 位版本。/ Requires 64-bit Windows 10 or Windows 11. macOS, Linux, 32-bit Windows, and Windows on ARM are not currently supported because metadata, media control, loopback capture, and the packaged ONNX Runtime target Windows x64 APIs.
- The portable executable is not code-signed yet. Windows SmartScreen may warn about an unrecognized publisher until a signed release has established reputation.
- Metadata availability depends on the active player exposing a Windows SMTC session. Browser tabs and some legacy players may expose incomplete data or no artwork.
- Genre classification combines imperfect public catalog metadata and heuristics. Remixes, compilations, aliases, localized artist names, and cross-genre artists can still require the local correction feature.
- Current providers commonly supply line timestamps rather than Apple Music-style per-syllable timing. Word/character highlighting is estimated within each line and can drift; use the lyric-delay control, disable word-by-word highlighting, or disable lyrics. NetEase and QQ Music are best-effort anonymous fallbacks and may change without notice.
- The first lookup for an uncached track can take a few seconds when several catalog services are slow. The visualizer keeps a local result or broad genre while optional sources finish or time out.
- System output-device changes are detected and trigger loopback recapture, but a driver that does not publish the change cleanly may require **Recapture system audio** from the tray.
- Transparent always-on-top Electron windows can render differently across GPU drivers, HDR modes, remote-desktop sessions, and screen-recording software. If animation freezes, restart the visualizer and update the GPU driver.
- The bundled local BeatNet ONNX model normally needs no external runtime. If ONNX Runtime cannot initialize or Chromium cannot create the AudioWorklet feed on a particular machine, the app automatically falls back to the built-in DSP rhythm detector.
