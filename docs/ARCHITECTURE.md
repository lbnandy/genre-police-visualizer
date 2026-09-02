# Architecture

Genre Police Visualizer is a Windows-focused Electron application. The runtime is split into a privileged main process, a context-isolated renderer, Windows media helpers, and a local audio-analysis pipeline.

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
| `assets/models/discogs-effnet-bsdynamic-1.onnx` | Bundled local music-style model used for optional audio genre assistance |

The renderer does not receive unrestricted Node.js access. Filesystem, process, and native operations remain in the main process or the dedicated Windows helpers.

## Data flow

1. **Now playing** — the active Windows media session supplies title, artist, album, artwork, playback state, duration, and position when available.
2. **Genre resolution** — player metadata is combined with local rules and, when enabled, public catalog metadata. Explicit user corrections take priority and are stored locally. Unknown, generic Electronic, and artist-only results can be refined by the local audio model.
3. **Audio capture** — Electron captures the Windows loopback stream. Audio frames remain in memory and feed the FFT, energy envelopes, onset detector, tempo tracker, local rhythm model, and local genre model.
4. **Rhythm fusion** — deterministic DSP handles strong transients immediately. The local ONNX model can confirm weaker beat candidates; it cannot create a visual impact without supporting audio evidence.
5. **Theme selection** — a resolved genre maps to a visual family. Theme parameters control spectrum geometry, type, palette, particles, background layers, and impact behavior.
6. **Rendering** — the Canvas 2D visual engine receives continuous audio metrics and discrete rhythm events. Interface transitions and lyrics are rendered separately from the audio detector.
7. **Lyrics** — when enabled, synchronized lyrics are queried by metadata, strictly matched, parsed, and aligned to the reconciled playback clock.
8. **Updates** — after a startup delay, the main process checks the public GitHub Releases API at most once per day. Semantic-version comparison, throttling, dismissal state, and allowlisted external navigation stay outside the renderer.

## Genre resolution

Genre resolution is conservative by design. A specific provider label is not replaced by a broad artist fallback. The independently configurable built-in and supplemental artist mappings refine missing or generic catalog buckets, while hybrid releases and cross-genre artists can be corrected from the interface.

The main implementation is divided between:

- `src/genre-resolver.js` for provider aggregation and candidate validation;
- `src/genre-classifier.js` for taxonomy rules and local fallbacks;
- `src/themes.js` for genre-to-visual mappings;
- `src/genre-corrections.js` for remembered user choices.

The optional local genre path analyzes overlapping 2.048-second, 16 kHz log-mel patches about once per second. A three-patch median suppresses isolated spikes, while a running mean represents track-level evidence. The first specific candidate is selected only from the cumulative result and requires minimum score, margin, and cumulative temporal-agreement gates. An artist mapping can accelerate a compatible model Top 1 but cannot force a conflicting candidate. Once the six-window recent segment becomes independent of the cumulative mean, matching recent evidence can also accelerate a compatible cumulative candidate, while a sustained concrete conflict delays publication until the two time scales converge. Recent evidence can still refine a broad baseline, correct an early result, and drive the optional dynamic-change path.

When provider evidence remains unknown, broad, or artist-only, a track that reaches its final portion can persist a concrete cumulative AI result after at least 60 accepted windows, strict score and margin gates, and a stable twelve-window cumulative-winner history. The entry uses a hashed normalized track identity, duration guard, model revision, bounded 500-entry store, and no saved audio. On a later play it is displayed as provisional local evidence while fresh inference validates it; matching evidence shortens static revalidation, conflicting evidence restores the full analysis horizon, and concrete catalog metadata or an explicit user correction still wins.

## Audio and rhythm

The visualizer uses three complementary paths:

- a real-time DSP path for FFT bands, relative energy, spectral flux, onset peaks, kick evidence, and tempo candidates;
- a bundled causal BeatNet ONNX path for beat/downbeat context and phase confidence.
- a bundled Discogs-EffNet ONNX path for optional local genre evidence.

Broad local-model results such as `Electronic` remain provisional: they can make an otherwise unknown track less empty, but cannot replace a concrete catalog or artist result and cannot trigger a dynamic switch. While an enabled and available local model is still seeking its first usable result, an otherwise unknown track remains in the identifying state instead of publishing `Unknown`. Once the cumulative path establishes a broad baseline, a stable short-window majority can refine it without being treated as the first track-level decision. Early concrete-to-concrete correction is driven by recent evidence, with cumulative evidence acting as an adaptive guard: agreement can accelerate a correction, ambiguity keeps the normal threshold, and strong opposition requires a longer recent majority unless the recent evidence is decisive. When dynamic detection starts from a concrete catalog result, that displayed genre becomes the tracker's initial baseline; the AI must satisfy the recent-majority, score, advantage, and cooldown gates before replacing it with a true dynamic-change event. A large playback seek resets accumulated audio evidence so the selected section is judged on its own. With dynamic genre-change detection disabled, inference pauses as soon as concrete metadata makes further audio evidence irrelevant. When metadata remains broad, inference keeps a roughly 100-second evidence horizon so common 48-bar mid-tempo and 64-bar fast arrangements can reach their first high-energy section plus the six-window confirmation span. If the first concrete result arrives near or beyond that horizon, at least twelve further accepted windows remain available for correction.

All three paths process the same local loopback stream. If ONNX Runtime or the AudioWorklet model feed is unavailable, the application continues with the DSP path.

## Privacy and network access

System audio is written to disk only when the user explicitly starts a video recording and chooses a destination; the application captures its own visualizer frame and never uploads the result. Outside that action, audio remains an in-memory analysis stream. The project contains no telemetry, advertising SDK, account system, or automatic crash uploader.

Online genre lookup and synchronized lyrics are independent settings. When enabled, they send only the metadata required for matching to the services listed in [PRIVACY.md](PRIVACY.md). The daily GitHub Releases check contains no track metadata and fails silently. The diagnostics exporter removes credentials, track metadata, artwork, lyrics, and listening history.

## Packaging

The portable Windows build is produced with Electron Builder:

```powershell
npm ci
npm test
npm run dist
```

The packaged application includes the Windows x64 ONNX Runtime and the two production ONNX models. Development weights, Python export utilities, tests, repository documentation, screenshots, and local QA output are excluded from the executable.

## Verification

The Node test suite covers classification, localization, lyrics matching, timing, window behavior, privacy-oriented configuration cleanup, audio feature logic, rhythm fusion, visual-family invariants, packaging rules, and public-documentation links. The GitHub Actions workflow reproduces dependency installation, tests, dependency audit, and the Windows portable build.
