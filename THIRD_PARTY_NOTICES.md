# Third-party notices

Genre Police Visualizer is licensed under the MIT License. The packaged application also contains third-party software and assets under their respective licenses.

## Fonts

The following Fontsource packages bundle fonts under the SIL Open Font License 1.1 (OFL-1.1):

- Barlow Condensed, BIZ UDPGothic, DM Sans, Gothic A1, Noto Sans JP, Noto Sans KR, Noto Sans SC, Roboto Condensed
- Audiowide, Bebas Neue, Black Ops One, Bungee, Chakra Petch, Fredoka
- Metal Mania, Orbitron, Oxanium, Righteous, Russo One, Space Grotesk, Teko

The complete OFL text and per-font metadata are included in each packaged `@fontsource` or `@fontsource-variable` package.

Smiley Sans (得意黑) is distributed under the SIL Open Font License 1.1. Its bundled license is included at `assets/fonts/smiley-sans/LICENSE`.

## Interface icons

The playback and window-control glyphs use SVG paths from Google Material Symbols Rounded. Material Symbols are provided by Google under the Apache License 2.0.

## Local rhythm model

The original BeatNet weights retained in the source tree for regression checks, and the beat-stage decoder adapted from BeatNet, are licensed under Creative Commons Attribution 4.0. The complete notice is included at `assets/models/BEATNET-CC-BY-4.0.txt`. The application uses BeatNet+ weights, whose provenance and license status are described below.

The application uses Microsoft ONNX Runtime for local CPU inference. ONNX Runtime is distributed under the MIT License; its package license and native runtime files are included with the packaged application.

## Local genre model

The bundled `discogs-effnet-bsdynamic-1.onnx` model and its metadata were created by the Music Technology Group at Universitat Pompeu Fabra and are distributed separately from the application source under the Essentia Models license for non-commercial use. The upstream license file is included at `assets/models/ESSENTIA-MODELS-LICENSE.txt`.

Model source: <https://essentia.upf.edu/models/feature-extractors/discogs-effnet/>

## Electron runtime

Electron and its MIT-licensed JavaScript tooling are redistributed under their upstream licenses. Chromium, Node.js, FFmpeg, and other components included by Electron retain their upstream licenses and notices. Electron's generated distribution contains its runtime license files.

## Network services

Apple iTunes Search, Deezer, Last.fm, Discogs, MusicBrainz, LRCLIB, NetEase Cloud Music, and QQ Music are external services, not bundled code. Their availability, metadata, and terms are controlled by their respective operators. NetEase and QQ Music lyrics are best-effort anonymous fallbacks rather than stability-guaranteed public developer APIs.

### BeatNet beat particle filter

The JavaScript beat-stage decoder is adapted from Mojtaba Heydari’s [BeatNet](https://github.com/mjhydri/BeatNet/blob/81cedd4beeb7235262db80969a0c9ce9a48a0ed4/src/BeatNet/particle_filtering_cascade.py), under CC BY 4.0. Changes include bounded particle buffers, posterior-frame decoding, broader tempo rejuvenation, an audio-frame clock, discontinuity resets, and omission of the downbeat/meter stage. The bundled BeatNet license text applies. This adaptation is not an upstream-endorsed implementation.

### BeatNet+ model

The bundled generic ONNX weights were exported from Mojtaba Heydari’s BeatNet-Plus at revision `bb90eb0a9065b101a4b4c4cb2b2061950266cb4b`. Source: https://github.com/mjhydri/BeatNet-Plus. Export provenance and hashes are in `assets/models/beatnet-plus/provenance.json`. This adaptation uses streaming ONNX inference and is not upstream-endorsed. The pinned repository does not contain a top-level license file; no additional license grant for these weights is asserted here.
