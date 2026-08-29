# Architecture

Genre Police Visualization is a Windows-focused Electron application. The runtime is split into a privileged main process, a context-isolated renderer, Windows media helpers, and a local audio-analysis pipeline.

## Runtime boundaries

| Component | Responsibility |
| --- | --- |
| `main.js` | Window and tray lifecycle, settings, Windows media-session selection, optional metadata lookup, diagnostics, and IPC validation |
| `preload.js` | Narrow context bridge between the renderer and the main process |
| `renderer/` | Interface state, Canvas 2D rendering, audio feature extraction, rhythm tracking, lyrics, and transitions |
| `scripts/now-playing.ps1` | Reads Windows System Media Transport Controls (SMTC) metadata |
| `scripts/media-control.ps1` | Sends previous, play/pause, and next commands to the active SMTC session |
| `src/` | Genre resolution, classification, localization, configuration, privacy filters, and shared application logic |
| `assets/models/beatnet-model-1.onnx` | Bundled local causal rhythm model used through ONNX Runtime |

The renderer does not receive unrestricted Node.js access. Filesystem, process, and native operations remain in the main process or the dedicated Windows helpers.

## Data flow

1. **Now playing** — the active Windows media session supplies title, artist, album, artwork, playback state, duration, and position when available.
2. **Genre resolution** — player metadata is combined with local rules and, when enabled, public catalog metadata. Explicit user corrections take priority and are stored locally.
3. **Audio capture** — Electron captures the Windows loopback stream. Audio frames remain in memory and feed the FFT, energy envelopes, onset detector, tempo tracker, and local rhythm model.
4. **Rhythm fusion** — deterministic DSP handles strong transients immediately. The local ONNX model can confirm weaker beat candidates; it cannot create a visual impact without supporting audio evidence.
5. **Theme selection** — a resolved genre maps to a visual family. Theme parameters control spectrum geometry, type, palette, particles, background layers, and impact behavior.
6. **Rendering** — the Canvas 2D visual engine receives continuous audio metrics and discrete rhythm events. Interface transitions and lyrics are rendered separately from the audio detector.
7. **Lyrics** — when enabled, synchronized lyrics are queried by metadata, strictly matched, parsed, and aligned to the reconciled playback clock.

## Genre resolution

Genre resolution is conservative by design. A specific provider label is not replaced by a broad artist fallback. Local artist mappings refine missing or generic catalog buckets, while hybrid releases and cross-genre artists can be corrected from the interface.

The main implementation is divided between:

- `src/genre-resolver.js` for provider aggregation and candidate validation;
- `src/genre-classifier.js` for taxonomy rules and local fallbacks;
- `src/themes.js` for genre-to-visual mappings;
- `src/genre-corrections.js` for remembered user choices.

## Audio and rhythm

The visualizer uses two complementary paths:

- a real-time DSP path for FFT bands, relative energy, spectral flux, onset peaks, kick evidence, and tempo candidates;
- a bundled causal BeatNet ONNX path for beat/downbeat context and phase confidence.

Both paths process the same local loopback stream. If ONNX Runtime or the AudioWorklet model feed is unavailable, the application continues with the DSP path.

## Privacy and network access

System audio is not recorded, written to disk, or transmitted. The project contains no telemetry, advertising SDK, account system, or automatic crash uploader.

Online genre lookup and synchronized lyrics are independent settings. When enabled, they send only the metadata required for matching to the services listed in [PRIVACY.md](PRIVACY.md). The diagnostics exporter removes credentials, track metadata, artwork, lyrics, and listening history.

## Packaging

The portable Windows build is produced with Electron Builder:

```powershell
npm ci
npm test
npm run dist
```

The packaged application includes the Windows x64 ONNX Runtime and the ONNX model. Development weights, Python export utilities, tests, repository documentation, screenshots, and local QA output are excluded from the executable.

## Verification

The Node test suite covers classification, localization, lyrics matching, timing, window behavior, privacy-oriented configuration cleanup, audio feature logic, rhythm fusion, visual-family invariants, packaging rules, and public-documentation links. The GitHub Actions workflow reproduces dependency installation, tests, dependency audit, and the Windows portable build.
