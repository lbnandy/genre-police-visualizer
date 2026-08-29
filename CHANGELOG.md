# Changelog

All notable changes to Genre Police Visualizer are documented here.

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
