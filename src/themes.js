'use strict';

const THEMES = {
  asmr: {
    family: 'asmr', parent: 'NON-MUSIC', label: 'ASMR',
    font: '"Fredoka"', accent: '#8fd8ff', accent2: '#c6b6ff', hot: '#effcff',
    mode: 'asmr', energy: 0.48, textFx: 0.48, textBaseGlow: 10
  },
  bilibili: {
    family: 'bilibili', parent: 'NON-MUSIC', label: 'bilibili',
    font: '"Righteous"', accent: '#fb7299', accent2: '#23ade5', hot: '#f4f4f4',
    genreInk: '#fb7299', genreInk2: '#fb7299', genreInkEdge: '#fb7299',
    mode: 'bilibili', energy: 0.58, textFx: 0, textBaseGlow: 0
  },
  edm: {
    family: 'electronic', parent: 'ELECTRONIC', label: 'EDM',
    font: '"Orbitron"', accent: '#00e5ff', accent2: '#8c55ff', hot: '#ffffff',
    mode: 'electronic', energy: 1.02
  },
  'hard-dance': {
    family: 'hardcore', parent: 'EDM', label: 'HARD DANCE',
    font: '"Black Ops One"', accent: '#ff284f', accent2: '#20dfff', hot: '#ffffff',
    mode: 'hardcore', energy: 1.16, fontWeight: 600
  },
  'happy-hardcore': {
    family: 'hardcore', parent: 'HARDCORE', label: 'HAPPY HARDCORE',
    font: '"Righteous"', accent: '#ff2bd6', accent2: '#00f6ff', hot: '#fff56b',
    mode: 'hardcore', energy: 1.08, textFx: 0.72, textBaseGlow: 14
  },
  'uk-hardcore': {
    family: 'hardcore', parent: 'HARDCORE', label: 'UK HARDCORE',
    font: '"Righteous"', accent: '#ff3fa7', accent2: '#27e7ff', hot: '#ffffff',
    mode: 'hardcore', energy: 1.1, textFx: 0.76, textBaseGlow: 15
  },
  gabber: {
    family: 'hardcore', parent: 'HARDCORE', label: 'GABBER',
    font: '"Black Ops One"', accent: '#ff1744', accent2: '#f5f5f5', hot: '#ff6b00',
    mode: 'hardcore', energy: 1.22, fontWeight: 600
  },
  frenchcore: {
    family: 'hardcore', parent: 'HARDCORE', label: 'FRENCHCORE',
    font: '"Black Ops One"', accent: '#ff244f', accent2: '#3366ff', hot: '#ffffff',
    mode: 'hardcore', energy: 1.2, fontWeight: 600
  },
  'uptempo-hardcore': {
    family: 'hardcore', parent: 'HARDCORE', label: 'UPTEMPO HARDCORE',
    font: '"Black Ops One"', accent: '#ff003c', accent2: '#b6ff00', hot: '#ffffff',
    mode: 'hardcore', energy: 1.34, fontWeight: 600
  },
  puzzycore: {
    family: 'hardcore', parent: 'UPTEMPO HARDCORE', label: 'PUZZYCORE',
    font: '"Bungee"', accent: '#ff1493', accent2: '#ff78d1', hot: '#fff2fb',
    mode: 'hardcore', energy: 1.4, textFx: 1.08, textBaseGlow: 19
  },
  'industrial-hardcore': {
    family: 'hardcore', parent: 'HARDCORE', label: 'INDUSTRIAL HARDCORE', hudLabel: 'INDUSTRIAL',
    font: '"Black Ops One"', accent: '#ff4b2b', accent2: '#9fa6ad', hot: '#ffe9c8',
    mode: 'hardcore', energy: 1.18, fontWeight: 600
  },
  hardcore: {
    family: 'hardcore', parent: 'HARD DANCE', label: 'HARDCORE',
    font: '"Black Ops One"', accent: '#ff1748', accent2: '#725cff', hot: '#fff4ee',
    mode: 'hardcore', energy: 1.2, fontWeight: 600
  },
  rawstyle: {
    family: 'hardstyle', parent: 'HARDSTYLE', label: 'RAWSTYLE',
    font: '"Teko"', accent: '#ff3518', accent2: '#c7ff00', hot: '#ffffff',
    mode: 'hardstyle', energy: 1.26
  },
  'euphoric-hardstyle': {
    family: 'hardstyle', parent: 'HARDSTYLE', label: 'EUPHORIC HARDSTYLE', hudLabel: 'EUPHORIC',
    font: '"Teko"', accent: '#ff9d00', accent2: '#00ddff', hot: '#ffffff',
    mode: 'hardstyle', energy: 1.12
  },
  hardstyle: {
    family: 'hardstyle', parent: 'HARD DANCE', label: 'HARDSTYLE',
    font: '"Teko"', accent: '#ff6500', accent2: '#00d9ff', hot: '#ffffff',
    mode: 'hardstyle', energy: 1.2
  },
  complextro: {
    family: 'house', parent: 'ELECTRO HOUSE', label: 'COMPLEXTRO',
    font: '"Bungee"', accent: '#a8ff00', accent2: '#7c32ff', hot: '#ffffff',
    mode: 'house', energy: 1.18
  },
  'big-room-house': {
    family: 'house', parent: 'HOUSE', label: 'BIG ROOM HOUSE',
    font: '"Bebas Neue"', accent: '#ffb000', accent2: '#00d9ff', hot: '#ffffff',
    mode: 'house', energy: 1.14
  },
  'dutch-house': {
    family: 'house', parent: 'ELECTRO HOUSE', label: 'DUTCH HOUSE',
    font: '"Oxanium"', accent: '#ff4b18', accent2: '#00e6ff', hot: '#ffffff',
    mode: 'house', energy: 1.08
  },
  'fidget-house': {
    family: 'house', parent: 'ELECTRO HOUSE', label: 'FIDGET HOUSE',
    font: '"Bungee"', accent: '#d6ff00', accent2: '#ff3f8f', hot: '#ffffff',
    mode: 'house', energy: 1.1
  },
  'melbourne-bounce': {
    family: 'house', parent: 'ELECTRO HOUSE', label: 'MELBOURNE BOUNCE',
    font: '"Righteous"', accent: '#00f5ff', accent2: '#ff4da6', hot: '#fff36a',
    mode: 'house', energy: 1.12
  },
  'electro-house': {
    family: 'house', parent: 'HOUSE', label: 'ELECTRO HOUSE',
    font: '"Oxanium"', accent: '#b7ff00', accent2: '#7454ff', hot: '#ffffff',
    mode: 'house', energy: 1.1
  },
  'acid-house': {
    family: 'house', parent: 'HOUSE', label: 'ACID HOUSE',
    font: '"Chakra Petch"', accent: '#d7ff00', accent2: '#7c2cff', hot: '#ffffff',
    mode: 'house', energy: 1.0
  },
  'tropical-house': {
    family: 'house', parent: 'HOUSE', label: 'TROPICAL HOUSE',
    font: '"Space Grotesk"', accent: '#00dfb2', accent2: '#ff9a4d', hot: '#fff2b5',
    mode: 'house', energy: 0.84
  },
  'french-house': {
    family: 'house', parent: 'HOUSE', label: 'FRENCH HOUSE',
    font: '"Audiowide"', accent: '#ff4ca8', accent2: '#30dcff', hot: '#ffe96d',
    mode: 'house', energy: 0.98
  },
  'disco-house': {
    family: 'house', parent: 'HOUSE', label: 'DISCO HOUSE',
    font: '"Audiowide"', accent: '#ff4fc3', accent2: '#ffb000', hot: '#7dfff2',
    mode: 'house', energy: 0.96
  },
  'hard-house': {
    family: 'house', parent: 'HOUSE', label: 'HARD HOUSE',
    font: '"Teko"', accent: '#ff304f', accent2: '#d8ff00', hot: '#ffffff',
    mode: 'house', energy: 1.16
  },
  'deep-house': {
    family: 'house', parent: 'HOUSE', label: 'DEEP HOUSE',
    font: '"Space Grotesk"', accent: '#00e5c8', accent2: '#6b5cff', hot: '#d8fff7',
    mode: 'house', energy: 0.82
  },
  'tech-house': {
    family: 'house', parent: 'HOUSE', label: 'TECH HOUSE',
    font: '"Space Grotesk"', accent: '#a8ff00', accent2: '#00d5ff', hot: '#ffffff',
    mode: 'house', energy: 0.96
  },
  'progressive-house': {
    family: 'house', parent: 'HOUSE', label: 'PROGRESSIVE HOUSE', hudLabel: 'PROGRESSIVE',
    font: '"Space Grotesk"', accent: '#705cff', accent2: '#00e1ff', hot: '#ff8bea',
    mode: 'house', energy: 0.9
  },
  'bass-house': {
    family: 'house', parent: 'HOUSE', label: 'BASS HOUSE',
    font: '"Russo One"', accent: '#b7ff25', accent2: '#ff397b', hot: '#f7ffe9',
    mode: 'house', energy: 1.12
  },
  'future-house': {
    family: 'house', parent: 'HOUSE', label: 'FUTURE HOUSE',
    font: '"Space Grotesk"', accent: '#00f0ff', accent2: '#765cff', hot: '#c8fffb',
    mode: 'house', energy: 1.0
  },
  'afro-house': {
    family: 'house', parent: 'HOUSE', label: 'AFRO HOUSE',
    font: '"Space Grotesk"', accent: '#ffb000', accent2: '#00df8f', hot: '#fff2bd',
    mode: 'house', energy: 0.94
  },
  amapiano: {
    family: 'house', parent: 'HOUSE', label: 'AMAPIANO',
    font: '"Righteous"', accent: '#d6b24c', accent2: '#42d7b1', hot: '#fff1ad',
    mode: 'house', energy: 0.9
  },
  'melodic-house': {
    family: 'house', parent: 'HOUSE', label: 'MELODIC HOUSE',
    font: '"Space Grotesk"', accent: '#6c63ff', accent2: '#ff59be', hot: '#aefbff',
    mode: 'house', energy: 0.88
  },
  house: {
    family: 'house', parent: 'EDM', label: 'HOUSE',
    font: '"Space Grotesk"', accent: '#00efc8', accent2: '#875cff', hot: '#ffffff',
    mode: 'house', energy: 0.92
  },
  'bass-music': {
    family: 'bass-music', parent: 'EDM', label: 'BASS MUSIC',
    font: '"Oxanium"', accent: '#68ff8d', accent2: '#7860ff', hot: '#f4ffff',
    mode: 'dubstep', energy: 1.08
  },
  'future-bass': {
    family: 'future-bass', parent: 'EDM', label: 'FUTURE BASS',
    font: '"Righteous"', accent: '#ff65c3', accent2: '#55dfff', hot: '#fff39a',
    mode: 'future-bass', energy: 0.98
  },
  'kawaii-bass': {
    family: 'future-bass', parent: 'FUTURE BASS', label: 'KAWAII BASS',
    font: '"Fredoka"', accent: '#ff79bd', accent2: '#62e5d3', hot: '#fff1a8',
    genreInk: '#ffd0e6', genreInk2: '#fff1ba', genreInkEdge: '#72e8dc',
    mode: 'kawaii-bass', energy: 1.0, textFx: 0.88, textBaseGlow: 15
  },
  'melodic-dubstep': {
    family: 'dubstep', parent: 'DUBSTEP', label: 'MELODIC DUBSTEP',
    font: '"Chakra Petch"', accent: '#7a6cff', accent2: '#52f6ff', hot: '#ff75c8',
    mode: 'dubstep', energy: 1.04
  },
  riddim: {
    family: 'dubstep', parent: 'DUBSTEP', label: 'RIDDIM',
    font: '"Bungee"', accent: '#b7ff00', accent2: '#8f35ff', hot: '#ffffff',
    mode: 'dubstep', energy: 1.24
  },
  brostep: {
    family: 'dubstep', parent: 'DUBSTEP', label: 'BROSTEP',
    font: '"Bungee"', accent: '#00ff91', accent2: '#ff305d', hot: '#efffff',
    mode: 'dubstep', energy: 1.2
  },
  deathstep: {
    family: 'dubstep', parent: 'DUBSTEP', label: 'DEATHSTEP',
    font: '"Metal Mania"', accent: '#ff1e35', accent2: '#7b20ff', hot: '#e7ff00',
    mode: 'dubstep', energy: 1.3
  },
  dubstep: {
    family: 'dubstep', parent: 'BASS MUSIC', label: 'DUBSTEP',
    font: '"Oxanium"', accent: '#76ff00', accent2: '#8c36ff', hot: '#ffffff',
    mode: 'dubstep', energy: 1.16
  },
  moombahcore: {
    family: 'dubstep', parent: 'MOOMBAHTON', label: 'MOOMBAHCORE',
    font: '"Bungee"', accent: '#ff6a24', accent2: '#8b3dff', hot: '#fff3a8',
    mode: 'dubstep', energy: 1.18
  },
  'future-riddim': {
    family: 'dubstep', parent: 'RIDDIM', label: 'FUTURE RIDDIM',
    font: '"Chakra Petch"', accent: '#62e8ff', accent2: '#ff66cf', hot: '#ffffff',
    mode: 'dubstep', energy: 1.08
  },
  'colour-bass': {
    family: 'dubstep', parent: 'DUBSTEP', label: 'COLOUR BASS',
    font: '"Righteous"', accent: '#55f4ff', accent2: '#ff58c8', hot: '#fff08a',
    mode: 'dubstep', energy: 1.08
  },
  'trap-edm': {
    family: 'trap', parent: 'BASS MUSIC', label: 'EDM TRAP',
    font: '"Oxanium"', accent: '#ffb000', accent2: '#704cff', hot: '#eefdff',
    genreInk: '#fff0b2', genreInk2: '#eafaff', genreInkEdge: '#785cff',
    mode: 'trap', energy: 1.1, fontWeight: 700, letterSpacing: '-0.82px',
    textFx: 0.72, textBaseGlow: 12
  },
  'festival-trap': {
    family: 'trap', parent: 'EDM TRAP', label: 'FESTIVAL TRAP',
    font: '"Black Ops One"', accent: '#ff9d00', accent2: '#ff315d', hot: '#ffffff',
    mode: 'trap', energy: 1.18
  },
  'hybrid-trap': {
    family: 'trap', parent: 'EDM TRAP', label: 'HYBRID TRAP',
    font: '"Oxanium"', accent: '#b6ff00', accent2: '#7a35ff', hot: '#ffffff',
    mode: 'trap', energy: 1.2
  },
  'hard-trap': {
    family: 'trap', parent: 'EDM TRAP', label: 'HARD TRAP',
    font: '"Black Ops One"', accent: '#ff284f', accent2: '#c5ff00', hot: '#ffffff',
    mode: 'trap', energy: 1.24
  },
  'midtempo-bass': {
    family: 'trap', parent: 'BASS MUSIC', label: 'MIDTEMPO BASS',
    font: '"Oxanium"', accent: '#ff315c', accent2: '#633dff', hot: '#b8fff3',
    mode: 'trap', energy: 1.12
  },
  'glitch-hop': {
    family: 'trap', parent: 'BASS MUSIC', label: 'GLITCH HOP',
    font: '"Oxanium"', accent: '#a8ff00', accent2: '#00d9ff', hot: '#ffffff',
    mode: 'trap', energy: 1.06
  },
  moombahton: {
    family: 'trap', parent: 'EDM', label: 'MOOMBAHTON',
    font: '"Audiowide"', accent: '#ff5b21', accent2: '#ff3fa8', hot: '#ffe45c',
    mode: 'trap', energy: 1.03
  },
  neurofunk: {
    family: 'drum-bass', parent: 'DRUM & BASS', label: 'NEUROFUNK',
    font: '"Oxanium"', accent: '#9dff20', accent2: '#ff245f', hot: '#efffe8',
    genreInk: '#e7ffd2', genreInk2: '#ffffff', genreInkEdge: '#9dff20',
    mode: 'drum-bass', energy: 1.22, fontWeight: 700, letterSpacing: '-0.72px'
  },
  'liquid-dnb': {
    family: 'drum-bass', parent: 'DRUM & BASS', label: 'LIQUID DNB',
    font: '"Chakra Petch"', accent: '#00e8ff', accent2: '#ff66cb', hot: '#d7fff4',
    mode: 'drum-bass', energy: 0.94
  },
  'dancefloor-dnb': {
    family: 'drum-bass', parent: 'DRUM & BASS', label: 'DANCEFLOOR DNB',
    font: '"Russo One"', accent: '#aaff00', accent2: '#00c8ff', hot: '#ffffff',
    mode: 'drum-bass', energy: 1.14
  },
  'jump-up-dnb': {
    family: 'drum-bass', parent: 'DRUM & BASS', label: 'JUMP UP DNB',
    font: '"Russo One"', accent: '#e2ff00', accent2: '#ff315c', hot: '#ffffff',
    mode: 'drum-bass', energy: 1.2
  },
  drumstep: {
    family: 'drum-bass', parent: 'DRUM & BASS', label: 'DRUMSTEP',
    font: '"Russo One"', accent: '#89ff00', accent2: '#7b3dff', hot: '#ffffff',
    mode: 'drum-bass', energy: 1.18
  },
  jungle: {
    family: 'drum-bass', parent: 'DRUM & BASS', label: 'JUNGLE',
    font: '"Russo One"', accent: '#f5dc36', accent2: '#17de8a', hot: '#ffffff',
    mode: 'drum-bass', energy: 1.12
  },
  'drum-bass': {
    family: 'drum-bass', parent: 'BASS MUSIC', label: 'DRUM & BASS',
    font: '"Russo One"', accent: '#aaff00', accent2: '#00bbff', hot: '#ffffff',
    mode: 'drum-bass', energy: 1.12
  },
  techno: {
    family: 'techno', parent: 'EDM', label: 'TECHNO',
    font: '"Chakra Petch"', accent: '#ff315c', accent2: '#00d9ff', hot: '#ffffff',
    mode: 'techno', energy: 1.02
  },
  'hard-techno': {
    family: 'techno', parent: 'TECHNO', label: 'HARD TECHNO',
    font: '"Bebas Neue"', accent: '#ff2349', accent2: '#d8ff00', hot: '#ffffff',
    mode: 'techno', energy: 1.17
  },
  'acid-techno': {
    family: 'techno', parent: 'TECHNO', label: 'ACID TECHNO',
    font: '"Chakra Petch"', accent: '#cfff00', accent2: '#7c2fff', hot: '#ffffff',
    mode: 'techno', energy: 1.08
  },
  'melodic-techno': {
    family: 'techno', parent: 'TECHNO', label: 'MELODIC TECHNO',
    font: '"Chakra Petch"', accent: '#7366ff', accent2: '#ff5ac8', hot: '#a9f8ff',
    mode: 'techno', energy: 0.94
  },
  'industrial-techno': {
    family: 'techno', parent: 'TECHNO', label: 'INDUSTRIAL TECHNO',
    font: '"Teko"', accent: '#ff382f', accent2: '#8f9aa1', hot: '#ffffff',
    mode: 'techno', energy: 1.16
  },
  'minimal-techno': {
    family: 'techno', parent: 'TECHNO', label: 'MINIMAL TECHNO',
    font: '"Chakra Petch"', accent: '#d7dde2', accent2: '#28b8ff', hot: '#ffffff',
    mode: 'techno', energy: 0.84
  },
  trance: {
    family: 'trance', parent: 'EDM', label: 'TRANCE',
    font: '"Orbitron"', accent: '#4c7dff', accent2: '#f35cff', hot: '#9ffbff',
    mode: 'trance', energy: 0.94
  },
  psytrance: {
    family: 'trance', parent: 'TRANCE', label: 'PSYTRANCE',
    font: '"Chakra Petch"', accent: '#b9ff00', accent2: '#8a2fff', hot: '#ffffff',
    mode: 'trance', energy: 1.12
  },
  'uplifting-trance': {
    family: 'trance', parent: 'TRANCE', label: 'UPLIFTING TRANCE',
    font: '"Righteous"', accent: '#36d7ff', accent2: '#ff68d1', hot: '#ffffff',
    mode: 'trance', energy: 0.98
  },
  'progressive-trance': {
    family: 'trance', parent: 'TRANCE', label: 'PROGRESSIVE TRANCE',
    font: '"Chakra Petch"', accent: '#616dff', accent2: '#45e7ff', hot: '#f8d8ff',
    mode: 'trance', energy: 0.92
  },
  'tech-trance': {
    family: 'trance', parent: 'TRANCE', label: 'TECH TRANCE',
    font: '"Chakra Petch"', accent: '#00e3ff', accent2: '#ff334f', hot: '#ffffff',
    mode: 'trance', energy: 1.08
  },
  'hard-trance': {
    family: 'trance', parent: 'TRANCE', label: 'HARD TRANCE',
    font: '"Bebas Neue"', accent: '#ff4a20', accent2: '#42dfff', hot: '#ffffff',
    mode: 'trance', energy: 1.14
  },
  'uk-garage': {
    family: 'garage', parent: 'EDM', label: 'UK GARAGE',
    font: '"Space Grotesk"', accent: '#28f0c9', accent2: '#8b5cff', hot: '#ecff72',
    genreInk: '#eafff8', genreInk2: '#edff83', genreInkEdge: '#8b68ff',
    mode: 'garage', energy: 0.98, fontWeight: 720, letterSpacing: '-0.9px'
  },
  'future-garage': {
    family: 'garage', parent: 'UK GARAGE', label: 'FUTURE GARAGE',
    font: '"Space Grotesk"', accent: '#5dcfff', accent2: '#ad67ff', hot: '#dffcff',
    genreInk: '#e5f9ff', genreInk2: '#e4d5ff', genreInkEdge: '#7b8dff',
    mode: 'garage', energy: 0.84, fontWeight: 670, letterSpacing: '-0.8px'
  },
  'speed-garage': {
    family: 'garage', parent: 'UK GARAGE', label: 'SPEED GARAGE',
    font: '"Russo One"', accent: '#d3ff00', accent2: '#00cfff', hot: '#ffffff',
    genreInk: '#f4ffb3', genreInk2: '#d8fbff', genreInkEdge: '#19d9ff',
    mode: 'garage', energy: 1.1
  },
  'two-step-garage': {
    family: 'garage', parent: 'UK GARAGE', label: '2-STEP GARAGE',
    font: '"Space Grotesk"', accent: '#ffca36', accent2: '#3fe0ff', hot: '#ffffff',
    genreInk: '#fff2b4', genreInk2: '#d9fbff', genreInkEdge: '#55bfff',
    mode: 'garage', energy: 0.96, fontWeight: 700, letterSpacing: '-0.85px'
  },
  bassline: {
    family: 'garage', parent: 'UK GARAGE', label: 'BASSLINE',
    font: '"Russo One"', accent: '#adff00', accent2: '#ff3e8f', hot: '#ffffff',
    genreInk: '#eeffb4', genreInk2: '#ffd1e3', genreInkEdge: '#ff4a9a',
    mode: 'garage', energy: 1.13
  },
  breakbeat: {
    family: 'breakbeat', parent: 'EDM', label: 'BREAKBEAT',
    font: '"Russo One"', accent: '#ffb000', accent2: '#00d9ff', hot: '#ffffff',
    mode: 'breakbeat', energy: 1.03
  },
  'big-beat': {
    family: 'breakbeat', parent: 'BREAKBEAT', label: 'BIG BEAT',
    font: '"Black Ops One"', accent: '#ff542e', accent2: '#d7ff00', hot: '#ffffff',
    mode: 'breakbeat', energy: 1.13
  },
  breakcore: {
    family: 'breakbeat', parent: 'BREAKBEAT', label: 'BREAKCORE',
    font: '"Bungee"', accent: '#ff3b58', accent2: '#885dff', hot: '#fff2dc',
    mode: 'breakbeat', energy: 1.2
  },
  'nu-disco': {
    family: 'house', parent: 'DISCO', label: 'NU-DISCO',
    font: '"Audiowide"', accent: '#ff4fc3', accent2: '#ffb000', hot: '#75fff1',
    mode: 'house', energy: 0.92
  },
  'electro-swing': {
    family: 'breakbeat', parent: 'EDM', label: 'ELECTRO SWING',
    font: '"Space Grotesk"', accent: '#efb34d', accent2: '#ff425d', hot: '#fff5d5',
    mode: 'breakbeat', energy: 0.98
  },
  synthwave: {
    family: 'synthwave', parent: 'ELECTRONIC', label: 'SYNTHWAVE',
    font: '"Audiowide"', accent: '#ff2ba6', accent2: '#44e7ff', hot: '#ffb35f',
    mode: 'trance', energy: 0.9, fontWeight: 400, letterSpacing: '0.7px'
  },
  'dance-pop': {
    family: 'pop', parent: 'POP', label: 'DANCE POP',
    font: '"Audiowide"', accent: '#ff3cac', accent2: '#39e7ff', hot: '#fff27a',
    mode: 'pop', energy: 0.98
  },
  'indie-pop': {
    family: 'pop', parent: 'POP', label: 'INDIE POP',
    font: '"Space Grotesk"', accent: '#ff8eb8', accent2: '#8c7bff', hot: '#fff1d6',
    mode: 'pop', energy: 0.84
  },
  pop: {
    family: 'pop', parent: 'POPULAR MUSIC', treeParent: 'POP', label: 'POP',
    font: '"Audiowide"', accent: '#ff4fa3', accent2: '#5edbff', hot: '#ffe6f3',
    mode: 'pop', energy: 0.92
  },
  'j-pop': {
    family: 'j-pop', parent: 'POP', label: 'J-POP',
    font: '"Audiowide"', accent: '#ff5e9c', accent2: '#42d8ff', hot: '#fff05a',
    mode: 'j-pop', energy: 0.98
  },
  'city-pop': {
    family: 'j-pop', parent: 'J-POP', label: 'CITY POP',
    font: '"Space Grotesk"', accent: '#ff7a59', accent2: '#39d6d0', hot: '#ffe7a8',
    mode: 'j-pop', energy: 0.86
  },
  anime: {
    family: 'j-pop', parent: 'JAPANESE MUSIC', label: 'ANIME',
    font: '"Audiowide"', accent: '#ff477e', accent2: '#00dcff', hot: '#fff55c',
    mode: 'j-pop', energy: 1.04
  },
  vocaloid: {
    family: 'j-pop', parent: 'JAPANESE MUSIC', label: 'VOCALOID',
    font: '"Oxanium"', accent: '#39c5bb', accent2: '#ff4fbd', hot: '#eaffff',
    mode: 'j-pop', energy: 1.02
  },
  'k-pop': {
    family: 'pop', parent: 'POP', label: 'K-POP',
    font: '"Righteous"', accent: '#ff43c8', accent2: '#655cff', hot: '#8cfff2',
    genreInk: '#fff0fb', genreInk2: '#a8fff5', genreInkEdge: '#8c72ff',
    mode: 'pop', energy: 1.06, textFx: 0.7, textBaseGlow: 14
  },
  'pop-rock': {
    family: 'rock', parent: 'ROCK', label: 'POP ROCK',
    font: '"Russo One"', accent: '#ff4b45', accent2: '#36b8ff', hot: '#ff756b',
    genreInk: '#ff625c', genreInk2: '#ffd08a', genreInkEdge: '#55c8ff',
    mode: 'rock', energy: 1.0, textFx: 0.56, textBaseGlow: 12
  },
  alternative: {
    family: 'rock', parent: 'ROCK', label: 'ALTERNATIVE ROCK',
    font: '"Russo One"', accent: '#ff9f43', accent2: '#45d6b5', hot: '#f7f0dd',
    mode: 'rock', energy: 0.92
  },
  rock: {
    family: 'rock', parent: 'ROCK / METAL', treeParent: 'ROCK & METAL', label: 'ROCK',
    font: '"Russo One"', accent: '#ff553d', accent2: '#789cac', hot: '#bbc8ce',
    genreInk: '#bdcbd1', genreInk2: '#e0e5e7', genreInkEdge: '#7896a4',
    mode: 'rock', energy: 1.06, textFx: 0.48, textBaseGlow: 8
  },
  'hip-hop': {
    family: 'hip-hop', parent: 'POPULAR MUSIC', treeParent: 'HIP-HOP', label: 'HIP-HOP',
    font: '"Bungee"', accent: '#ffb100', accent2: '#8456ff', hot: '#fff0bf',
    genreInk: '#ffe09a', genreInk2: '#fff6dc', genreInkEdge: '#8d65ff',
    mode: 'hip-hop', energy: 0.98, fontWeight: 400, letterSpacing: '-0.72px',
    textFx: 0.54, textBaseGlow: 10
  },
  'experimental-hip-hop': {
    family: 'hip-hop', parent: 'HIP-HOP', label: 'EXPERIMENTAL HIP-HOP', hudLabel: 'EXPERIMENTAL',
    font: '"Oxanium"', accent: '#ff9f43', accent2: '#7b61ff', hot: '#c8fff4',
    genreInk: '#ffe4ad', genreInk2: '#d9d0ff', genreInkEdge: '#57e0cf',
    mode: 'hip-hop', energy: 1.02, fontWeight: 700, letterSpacing: '-0.72px',
    textFx: 0.62, textBaseGlow: 11
  },
  phonk: {
    family: 'hip-hop', parent: 'HIP-HOP', label: 'PHONK',
    font: '"Black Ops One"', accent: '#c7ff31', accent2: '#6f42d9', hot: '#ff4e78',
    genreInk: '#eaffb5', genreInk2: '#ffd1dc', genreInkEdge: '#8157e8',
    mode: 'phonk', energy: 1.04, textFx: 0.69, textBaseGlow: 12
  },
  'drift-phonk': {
    family: 'phonk', parent: 'PHONK', label: 'DRIFT PHONK',
    font: '"Black Ops One"', accent: '#d4ff28', accent2: '#713cff', hot: '#ff315f',
    genreInk: '#f0ffb8', genreInk2: '#ffb5c8', genreInkEdge: '#875cff',
    mode: 'phonk', energy: 1.18, textFx: 0.78, textBaseGlow: 14
  },
  rnb: {
    family: 'rnb', parent: 'FUNK / SOUL', label: 'R&B',
    font: '"Space Grotesk"', accent: '#c96cff', accent2: '#ff709f', hot: '#ffe0c2',
    genreInk: '#f2c8ff', genreInk2: '#ffd1d8', genreInkEdge: '#9e78ff',
    mode: 'rnb', energy: 0.88, fontWeight: 680, letterSpacing: '-0.35px',
    textFx: 0.54, textBaseGlow: 11
  },
  'contemporary-rnb': {
    family: 'rnb', parent: 'R&B', label: 'CONTEMPORARY R&B',
    font: '"Space Grotesk"', accent: '#e56fb7', accent2: '#6e9dff', hot: '#ffe3cc',
    genreInk: '#ffd2eb', genreInk2: '#d8e3ff', genreInkEdge: '#9f79ff',
    mode: 'rnb', energy: 0.9, fontWeight: 680, letterSpacing: '-0.55px'
  },
  'alternative-rnb': {
    family: 'rnb', parent: 'R&B', label: 'ALT R&B',
    font: '"Oxanium"', accent: '#8e6cff', accent2: '#4bd1c2', hot: '#f0c7df',
    genreInk: '#d8ceff', genreInk2: '#bdeee5', genreInkEdge: '#725fd1',
    mode: 'rnb', energy: 0.82, fontWeight: 700, letterSpacing: '-0.45px'
  },
  soul: {
    family: 'rnb', parent: 'FUNK / SOUL', label: 'SOUL',
    font: '"Righteous"', accent: '#e58a47', accent2: '#9d405d', hot: '#fff0c7',
    genreInk: '#ffd5a7', genreInk2: '#f0b5c5', genreInkEdge: '#b65764',
    mode: 'rnb', energy: 0.78
  },
  'neo-soul': {
    family: 'rnb', parent: 'SOUL', label: 'NEO SOUL',
    font: '"Space Grotesk"', accent: '#d49b52', accent2: '#5ba98e', hot: '#f8e8c5',
    genreInk: '#f3d5a5', genreInk2: '#bde0cf', genreInkEdge: '#8b7950',
    mode: 'rnb', energy: 0.72, fontWeight: 680, letterSpacing: '-0.45px'
  },
  'new-jack-swing': {
    family: 'rnb', parent: 'R&B', label: 'NEW JACK SWING',
    font: '"Righteous"', accent: '#ff4f9b', accent2: '#39d8dc', hot: '#ffe35a',
    genreInk: '#ffb5d3', genreInk2: '#a9f4ef', genreInkEdge: '#ffbd42',
    mode: 'rnb', energy: 1.02
  },
  gospel: {
    family: 'rnb', parent: 'FUNK / SOUL', label: 'GOSPEL',
    font: '"Space Grotesk"', accent: '#e8b95d', accent2: '#68aee8', hot: '#fff7dc',
    genreInk: '#ffebb9', genreInk2: '#c8e5ff', genreInkEdge: '#b78c43',
    mode: 'rnb', energy: 0.82, fontWeight: 700
  },
  funk: {
    family: 'rnb', parent: 'FUNK / SOUL', label: 'FUNK',
    font: '"Righteous"', accent: '#c8e84f', accent2: '#f36b47', hot: '#fff2a8',
    genreInk: '#efffb1', genreInk2: '#ffc5a9', genreInkEdge: '#89a73e',
    mode: 'rnb', energy: 0.98
  },
  'disco-funk': {
    family: 'pop', parent: 'FUNK / SOUL', label: 'DISCO',
    font: '"Audiowide"', accent: '#ff4fbd', accent2: '#ffb000', hot: '#7dfff2',
    mode: 'house', energy: 0.94
  },
  'singer-songwriter': {
    family: 'rnb', parent: 'FOLK / COUNTRY', treeParent: 'FOLK / COUNTRY', label: 'SINGER-SONGWRITER',
    font: '"Space Grotesk"', accent: '#f1ae62', accent2: '#6faeff', hot: '#fff4df',
    mode: 'rnb', energy: 0.72
  },
  country: {
    family: 'rock', parent: 'FOLK / COUNTRY', treeParent: 'FOLK / COUNTRY', label: 'COUNTRY',
    font: '"Space Grotesk"', accent: '#ff9a3c', accent2: '#4fb8ff', hot: '#fff3d7',
    mode: 'rock', energy: 0.82
  },
  folk: {
    family: 'rnb', parent: 'FOLK / COUNTRY', treeParent: 'FOLK / COUNTRY', label: 'FOLK',
    font: '"Space Grotesk"', accent: '#e6b85c', accent2: '#63c38b', hot: '#fff5dc',
    mode: 'rnb', energy: 0.72
  },
  bebop: {
    family: 'jazz', parent: 'JAZZ', label: 'BEBOP',
    font: '"Space Grotesk"', accent: '#ffbf4f', accent2: '#b76cff', hot: '#fff4d6',
    mode: 'rnb', energy: 0.9
  },
  'swing-jazz': {
    family: 'jazz', parent: 'JAZZ', label: 'SWING',
    font: '"Righteous"', accent: '#f0b64a', accent2: '#46c9bd', hot: '#fff1c7',
    mode: 'rnb', energy: 0.86
  },
  'bossa-nova': {
    family: 'jazz', parent: 'LATIN', label: 'BOSSA NOVA',
    font: '"Space Grotesk"', accent: '#56d6bd', accent2: '#ff8f70', hot: '#fff3c9',
    mode: 'rnb', energy: 0.7
  },
  'jazz-fusion': {
    family: 'jazz', parent: 'JAZZ', label: 'JAZZ FUSION',
    font: '"Chakra Petch"', accent: '#bc73ff', accent2: '#d7ed50', hot: '#fff2cf',
    mode: 'rnb', energy: 0.98
  },
  jazz: {
    family: 'jazz', parent: 'JAZZ / IMPROVISED', treeParent: 'JAZZ', label: 'JAZZ',
    font: '"Space Grotesk"', accent: '#bd75ff', accent2: '#f4ba55', hot: '#fff0ce',
    mode: 'rnb', energy: 0.76
  },
  baroque: {
    family: 'classical', parent: 'CLASSICAL', label: 'BAROQUE',
    font: '"Space Grotesk"', accent: '#d9b45f', accent2: '#76a8dd', hot: '#fff4d8',
    mode: 'trance', energy: 0.68
  },
  'romantic-classical': {
    family: 'classical', parent: 'CLASSICAL', label: 'ROMANTIC',
    font: '"Space Grotesk"', accent: '#cf7f9f', accent2: '#769fe8', hot: '#fff0dc',
    mode: 'trance', energy: 0.74
  },
  opera: {
    family: 'classical', parent: 'CLASSICAL', label: 'OPERA',
    font: '"Space Grotesk"', accent: '#d85f70', accent2: '#d7ae55', hot: '#fff3df',
    mode: 'trance', energy: 0.78
  },
  'modern-classical': {
    family: 'classical', parent: 'CLASSICAL', label: 'MODERN CLASSICAL',
    font: '"Chakra Petch"', accent: '#77b9db', accent2: '#a98bd7', hot: '#eef8f4',
    mode: 'trance', energy: 0.62
  },
  classical: {
    family: 'classical', parent: 'CLASSICAL MUSIC', treeParent: 'CLASSICAL', label: 'CLASSICAL',
    font: '"Space Grotesk"', accent: '#7aa7ff', accent2: '#d8b96a', hot: '#f4ead7',
    mode: 'trance', energy: 0.64
  },
  soundtrack: {
    family: 'trance', parent: 'STAGE & SCREEN', treeParent: 'STAGE & SCREEN', label: 'SOUNDTRACK',
    font: '"Orbitron"', accent: '#866cff', accent2: '#e2b65a', hot: '#eaf5ff',
    mode: 'trance', energy: 0.8
  },
  latin: {
    family: 'latin', parent: 'LATIN MUSIC', treeParent: 'LATIN', label: 'LATIN',
    font: '"Righteous"', accent: '#ff5d35', accent2: '#24d5b4', hot: '#ffd45c',
    genreInk: '#fff3c7', genreInk2: '#ffd56a', genreInkEdge: '#ff7650',
    mode: 'latin', energy: 1.0
  },
  reggae: {
    family: 'rnb', parent: 'CARIBBEAN', treeParent: 'REGGAE', label: 'REGGAE',
    font: '"Russo One"', accent: '#32d75b', accent2: '#ffd43b', hot: '#ff4a3d',
    mode: 'rnb', energy: 0.86
  },
  punk: {
    family: 'rock', parent: 'ROCK', label: 'PUNK',
    font: '"Russo One"', accent: '#ff304f', accent2: '#b6ff2e', hot: '#ffffff',
    mode: 'rock', energy: 1.12
  },
  metalcore: {
    family: 'metal', parent: 'METAL', label: 'METALCORE',
    font: '"Teko"', accent: '#ff233f', accent2: '#d5d8dc', hot: '#ffffff',
    mode: 'metal', energy: 1.16
  },
  deathcore: {
    family: 'metal', parent: 'METALCORE', label: 'DEATHCORE',
    font: '"Metal Mania"', accent: '#ff142b', accent2: '#7b000d', hot: '#f1f1e8',
    mode: 'metal', energy: 1.28
  },
  'industrial-metal': {
    family: 'metal', parent: 'METAL', label: 'INDUSTRIAL METAL',
    font: '"Teko"', accent: '#ff5b22', accent2: '#8e969d', hot: '#fff4dc',
    mode: 'metal', energy: 1.16
  },
  'progressive-metal': {
    family: 'metal', parent: 'METAL', label: 'PROGRESSIVE METAL', hudLabel: 'PROGRESSIVE',
    font: '"Oxanium"', accent: '#9b61ff', accent2: '#00d8c8', hot: '#ffffff',
    mode: 'metal', energy: 1.08
  },
  'death-metal': {
    family: 'metal', parent: 'METAL', label: 'DEATH METAL',
    font: '"Metal Mania"', accent: '#e00024', accent2: '#5c000a', hot: '#ece8dc',
    mode: 'metal', energy: 1.22
  },
  'black-metal': {
    family: 'metal', parent: 'METAL', label: 'BLACK METAL',
    font: '"Metal Mania"', accent: '#dfe5ea', accent2: '#52606b', hot: '#ffffff',
    mode: 'metal', energy: 1.16
  },
  'nu-metal': {
    family: 'metal', parent: 'METAL', label: 'NU METAL',
    font: '"Teko"', accent: '#ff3f21', accent2: '#98ff00', hot: '#ffffff',
    mode: 'metal', energy: 1.12
  },
  metal: {
    family: 'metal', parent: 'ROCK / METAL', treeParent: 'ROCK & METAL', label: 'METAL',
    font: '"Teko"', accent: '#ef233c', accent2: '#aab2b9', hot: '#ffffff',
    mode: 'metal', energy: 1.16
  },
  ambient: {
    family: 'ambient', parent: 'ELECTRONIC', label: 'AMBIENT',
    font: '"Space Grotesk"', accent: '#79d8d0', accent2: '#788be8', hot: '#e8fff8',
    genreInk: '#c8f5ea', genreInk2: '#cbd4ff', genreInkEdge: '#6aa8ba',
    mode: 'ambient', energy: 0.58, fontWeight: 650, letterSpacing: '-0.35px',
    textFx: 0.34, textBaseGlow: 8
  },
  downtempo: {
    family: 'downtempo', parent: 'ELECTRONIC', label: 'DOWNTEMPO',
    font: '"Space Grotesk"', accent: '#db8f68', accent2: '#4eb9b2', hot: '#f4e4b8',
    genreInk: '#f2c5ad', genreInk2: '#bce7dd', genreInkEdge: '#aa766d',
    mode: 'ambient', energy: 0.7, fontWeight: 680, letterSpacing: '-0.45px',
    textFx: 0.4, textBaseGlow: 9
  },
  chillout: {
    family: 'downtempo', parent: 'DOWNTEMPO', label: 'CHILLOUT',
    font: '"Righteous"', accent: '#62d9c2', accent2: '#ef8fa5', hot: '#fff0c7',
    genreInk: '#c9faee', genreInk2: '#ffd2dc', genreInkEdge: '#72aeb1',
    mode: 'ambient', energy: 0.64, textFx: 0.36, textBaseGlow: 8
  },
  'instrumental-hip-hop': {
    family: 'hip-hop', parent: 'HIP-HOP', label: 'INSTRUMENTAL HIP-HOP',
    font: '"Bungee"', accent: '#d9a441', accent2: '#4f91a8', hot: '#f5e7bd',
    genreInk: '#f0cf86', genreInk2: '#b9dce4', genreInkEdge: '#8a744e',
    mode: 'hip-hop', energy: 0.82, fontWeight: 400, letterSpacing: '-0.82px',
    textFx: 0.42, textBaseGlow: 8
  },
  'lo-fi-hip-hop': {
    family: 'hip-hop', parent: 'INSTRUMENTAL HIP-HOP', label: 'LO-FI HIP-HOP',
    font: '"Space Grotesk"', accent: '#8faf8d', accent2: '#c97f91', hot: '#d7dfc8',
    genreInk: '#d3e1c7', genreInk2: '#e7bcc7', genreInkEdge: '#778d83',
    mode: 'hip-hop', energy: 0.68, fontWeight: 680, letterSpacing: '-0.5px',
    textFx: 0.32, textBaseGlow: 7
  },
  idm: {
    family: 'experimental-electronic', parent: 'ELECTRONIC', label: 'IDM',
    font: '"Oxanium"', accent: '#58e1c1', accent2: '#8d70ff', hot: '#effff7',
    genreInk: '#baffed', genreInk2: '#d3c9ff', genreInkEdge: '#5aa5a6',
    mode: 'experimental', energy: 0.9, fontWeight: 700, letterSpacing: '-0.35px',
    textFx: 0.52, textBaseGlow: 10
  },
  glitch: {
    family: 'experimental-electronic', parent: 'ELECTRONIC', label: 'GLITCH',
    font: '"Chakra Petch"', accent: '#42ddeb', accent2: '#f064a4', hot: '#dfff69',
    genreInk: '#b8f8ff', genreInk2: '#ffb4d5', genreInkEdge: '#9fb84e',
    mode: 'experimental', energy: 0.98, fontWeight: 700, letterSpacing: '-0.25px',
    textFx: 0.64, textBaseGlow: 11
  },
  blues: {
    family: 'blues', parent: 'ROOTS MUSIC', treeParent: 'BLUES', label: 'BLUES',
    font: '"Space Grotesk"', accent: '#408bd6', accent2: '#d69a48', hot: '#e8f2ff',
    genreInk: '#b9dcff', genreInk2: '#f0d3a5', genreInkEdge: '#4c72a0',
    mode: 'rnb', energy: 0.76, fontWeight: 700, letterSpacing: '-0.25px',
    textFx: 0.46, textBaseGlow: 9
  },
  electronic: {
    family: 'electronic', parent: 'GENRE POLICE', treeParent: 'ELECTRONIC', label: 'ELECTRONIC',
    font: '"Orbitron"', accent: '#00e5ff', accent2: '#8c55ff', hot: '#ffffff',
    mode: 'electronic', energy: 1.0
  },
  unknown: {
    family: 'unknown', parent: 'ANALYZING', label: 'UNKNOWN',
    font: '"Orbitron"', accent: '#67f7ff', accent2: '#8d76ff', hot: '#ffffff',
    mode: 'electronic', energy: 0.86
  }
};

// Every concrete visual is previewable. Structural nodes exist only to keep
// the taxonomy readable and therefore stay out of the radio-item list.
const PREVIEW_EXCLUDED_THEME_IDS = new Set(['edm', 'unknown']);
const DEMO_THEME_IDS = Object.keys(THEMES)
  .filter((id) => !PREVIEW_EXCLUDED_THEME_IDS.has(id));

const FONT_TYPOGRAPHY = Object.freeze({
  'Black Ops One': { fontWeight: 400, letterSpacing: '0.15px' },
  Fredoka: { fontWeight: 700, letterSpacing: '-0.45px' },
  Orbitron: { fontWeight: 800, letterSpacing: '-0.8px' },
  Oxanium: { fontWeight: 700, letterSpacing: '-0.65px' },
  Audiowide: { fontWeight: 400, letterSpacing: '-0.55px' },
  'Metal Mania': { fontWeight: 400, letterSpacing: '0.65px' },
  Teko: { fontWeight: 700, letterSpacing: '0.75px' },
  'Russo One': { fontWeight: 400, letterSpacing: '-0.4px' },
  'Space Grotesk': { fontWeight: 700, letterSpacing: '-1.2px' },
  Bungee: { fontWeight: 400, letterSpacing: '-0.85px' },
  'Chakra Petch': { fontWeight: 700, letterSpacing: '-0.2px' },
  Righteous: { fontWeight: 400, letterSpacing: '-0.55px' },
  'Bebas Neue': { fontWeight: 400, letterSpacing: '1.15px' }
});

const MODE_TEXT_FX = Object.freeze({
  asmr: { textFx: 0.48, textBaseGlow: 10 },
  bilibili: { textFx: 0, textBaseGlow: 0 },
  hardcore: { textFx: 0.84, textBaseGlow: 15 },
  hardstyle: { textFx: 0.8, textBaseGlow: 14 },
  house: { textFx: 0.67, textBaseGlow: 12 },
  'future-bass': { textFx: 0.75, textBaseGlow: 14 },
  'kawaii-bass': { textFx: 0.82, textBaseGlow: 15 },
  dubstep: { textFx: 0.8, textBaseGlow: 14 },
  trap: { textFx: 0.74, textBaseGlow: 13 },
  garage: { textFx: 0.63, textBaseGlow: 11 },
  breakbeat: { textFx: 0.69, textBaseGlow: 12 },
  'drum-bass': { textFx: 0.7, textBaseGlow: 12 },
  techno: { textFx: 0.62, textBaseGlow: 11 },
  trance: { textFx: 0.6, textBaseGlow: 13 },
  pop: { textFx: 0.58, textBaseGlow: 11 },
  'j-pop': { textFx: 0.64, textBaseGlow: 12 },
  rock: { textFx: 0.6, textBaseGlow: 11 },
  metal: { textFx: 0.72, textBaseGlow: 13 },
  'hip-hop': { textFx: 0.58, textBaseGlow: 11 },
  phonk: { textFx: 0.7, textBaseGlow: 12 },
  rnb: { textFx: 0.5, textBaseGlow: 10 },
  ambient: { textFx: 0.38, textBaseGlow: 8 },
  experimental: { textFx: 0.58, textBaseGlow: 10 },
  latin: { textFx: 0.64, textBaseGlow: 12 },
  electronic: { textFx: 0.6, textBaseGlow: 11 }
});

function themeFor(id) {
  const theme = THEMES[id] || THEMES.unknown;
  const fontName = String(theme.font || '').replace(/["']/g, '');
  const typography = FONT_TYPOGRAPHY[fontName] || { fontWeight: 700, letterSpacing: '-0.5px' };
  const motionText = MODE_TEXT_FX[theme.mode] || MODE_TEXT_FX.electronic;
  return {
    ...theme,
    fontWeight: theme.fontWeight ?? typography.fontWeight,
    letterSpacing: theme.letterSpacing || typography.letterSpacing,
    textFx: theme.textFx ?? motionText.textFx,
    textBaseGlow: theme.textBaseGlow ?? motionText.textBaseGlow
  };
}

function themeWithId(id) {
  const resolvedId = Object.hasOwn(THEMES, id) ? id : 'unknown';
  return { id: resolvedId, ...themeFor(resolvedId) };
}

module.exports = { THEMES, DEMO_THEME_IDS, themeFor, themeWithId };
