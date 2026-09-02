# Changelog

All notable changes to Genre Police Visualizer are documented here.

## Unreleased

## 0.3.0 - 2026-09-02

- Added a fullscreen mode with stacked and side-by-side compositions, layout-aware entry from capsule or poster mode, in-place settings, text controls, transport controls, snapshots, recording, and exit controls.
- Added real-time video recording of the visualization and system playback audio, with MP4 output, automatic WebM fallback, streamed file writing, and a recording-only stop state across layouts.
- Added transparent PNG snapshots and settings that control whether snapshot and recording shortcuts are shown; both shortcuts are enabled by default.
- Added a non-blocking GitHub Releases update reminder with daily automatic throttling, per-version dismissal, and manual checks in App settings.
- Added optional on-device Discogs-EffNet genre assistance with adaptive first-result timing, corroborated correction, optional sustained-change detection, and no audio upload.
- Added conservative artist-aware genre priors, bounded high-confidence local result memory, and an independent switch for built-in and supplemental artist references.
- Added a quick genre-candidate panel that combines metadata with cumulative and recent local-AI evidence, supports a track-scoped visual choice, and can remember a correction.
- Added desktop-layer mode that remains visible after Show Desktop, made it mutually exclusive with the existing always-on-top option, made transparent regions outside the visible surface pass pointer input through automatically, and kept the main window accessible from the taskbar.
- Added Gentle, Standard, and Strong visual-response presets and an optional live FPS diagnostic; reduced rendering overhead in complex themes with adaptive dynamic-canvas resolution under sustained performance pressure.
- Added 23 selectable genre visuals with Ambient, Downtempo, Chillout, Instrumental Hip-Hop, Lo-fi Hip-Hop, IDM, Glitch, Blues, and new R&B, Soul, Jazz, and Classical branches.
- Reviewed the taxonomy and visual distinctions across Hardcore and Hardstyle, Dubstep, House, Drum & Bass, Techno and Trance, J-Pop, UK Garage, Jazz, Classical, R&B, Soul, and Synthwave.
- Reorganized settings into Interface, Playback, Lyrics, Genre, and App sections, with context-sensitive fullscreen controls and revised localized copy in Simplified Chinese, English, Japanese, and Korean.
- Standardized interface icons and control sizing, refined centered capsule notices and genre-choice dialogs, and shortened overflowing genre headings without changing their canonical taxonomy names.
- Unified text-hidden fullscreen presentation across both structures and refined fullscreen placement, lyric width, condensed-English behavior, and soft glyph-only title shadows.
- Fixed clipped genre-title and lyric glows, Hip-Hop accent bars being obscured by the spectrum, and several overly busy circular theme treatments.
- Fixed play/pause transport so a session paused from Genre Police can be resumed even when the player temporarily stops being the freshest Windows media session.
- Kept broad local-AI `Electronic` results provisional, stopped inference after authoritative results when dynamic detection is off, and kept unresolved tracks in the identifying state until evidence is sufficient.

## 0.2.0 - 2026-08-30

- Added custom genres with user-defined labels, tag aliases, artists, inherited visual styles, and optional three-color theme overrides.
- Added supplemental artist rules for associating an artist with an existing genre.
- Added versioned JSON import and export for remembered track corrections, custom genres, and supplemental artist rules.
- Added a conservative Bilibili fallback that only applies after a Bilibili player suffix is removed and all other genre resolution remains unknown.
- Added a dedicated Bilibili visual with a speech-oriented TV signature, one-way danmaku, and pink-and-blue background motion.
- Reorganized settings into Appearance, Lyrics, Playback, Genre, and App tabs with stable capsule and poster sizing.
- Added settings controls for mouse passthrough, local rhythm enhancement, and the existing idle render limiter.
- Expanded interface scaling to 50%-150%, changed the new-install default from 120% to 100%, and added first-launch Windows locale detection with an English fallback.
- Allowed track corrections without an artist by using source, cleaned title, and duration as a fallback identity.
- Added a direct SMTC setup notice when NetEase Cloud Music is running without a Windows media session.
- Retuned BeatNet/DSP fusion to reduce low-confidence model influence while preserving local transient fallback behavior.
- Raised the idle render limit from 15 FPS to 30 FPS and made the limiter optional.
- Refined Synthwave scenery and horizon depth, Trance particle impact brightness, Kawaii Bass expression response, and the tonal backdrops used by several bright genre families.
- Improved overflowing title motion and fixed capsule lyric-translation sweep clipping.
- Kept Chinese-only lyric translation controls out of other interface languages and standardized music metadata terminology.

## 0.1.0 - 2026-08-29

- Added a transparent, borderless Windows now-playing visualizer with genre-aware typography, color, particles, spectrum geometry, and impact effects.
- Added Windows SMTC metadata and transport controls for Apple Music, Spotify, and other compatible desktop players.
- Added local loopback FFT, beat, kick, BPM, energy, and optional local BeatNet-assisted rhythm analysis.
- Added genre aggregation from player metadata, Apple catalog, Deezer, optional Last.fm, optional Discogs, MusicBrainz, local artist mappings, and remembered user corrections.
- Added aggregated synchronized lyrics from LRCLIB with strictly matched NetEase and QQ Music fallbacks, optional word-by-word highlighting, per-genre line transitions, and adjustable timing offset.
- Added Chinese, English, Japanese, and Korean settings UI, 70–150% interface scaling, mouse passthrough, tray controls, and automatic audio-output recapture.
- Separated Amapiano from Afro House and Breakcore from Drum & Bass, corrected immediate-parent relationships for Dubstep, House, Moombahton, and Deathcore branches, and expanded curated artist/localized-name coverage.
- Added master switches for synchronized lyrics and online genre lookup.
- Added automatic removal of retired Spotify Web API credential fields from older local settings; Spotify playback support remains available through Windows SMTC.
- Added automatic window-position persistence with multi-monitor clamping when a saved display is disconnected.
- Added release privacy, known-issues, third-party-notice, and verification documentation.
- Added Standard/Gentle motion intensity, idle keep/dim/hide behavior with paused rendering throttling, preferred/ignored Windows media sources, and a redacted status/diagnostics panel.
- Made ordinary settings apply immediately, separated API credential application, and changed the settings footer action to Close.
- Updated the packaged runtime to a supported Electron release and limited ONNX Runtime packaging to Windows x64.
