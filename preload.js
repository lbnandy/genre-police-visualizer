'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('genrePolice', {
  close: () => ipcRenderer.invoke('window:close'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  setUiScale: (value) => ipcRenderer.invoke('window:set-ui-scale', value),
  setLayoutMode: (value) => ipcRenderer.invoke('window:set-layout-mode', value),
  mediaControl: (action) => ipcRenderer.invoke('media:control', action),
  recaptureAudio: () => ipcRenderer.invoke('media:recapture'),
  exportDiagnostics: (payload) => ipcRenderer.invoke('diagnostics:export', payload),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  setGenreCorrection: (genreId) => ipcRenderer.invoke('genre-correction:set', genreId),
  clearGenreCorrection: () => ipcRenderer.invoke('genre-correction:clear'),
  setDemo: (id) => ipcRenderer.invoke('demo:set', id),
  artworkFacePalette: (payload) => ipcRenderer.invoke('artwork:face-palette', payload),
  notifyAudioOutputDeviceChanged: (payload) => ipcRenderer.send('audio:output-device-changed', payload),
  submitRhythmAudio: (samples) => ipcRenderer.send('rhythm-model:audio', samples),
  onNowPlaying: (callback) => ipcRenderer.on('now-playing', (_event, payload) => callback(payload)),
  onPlaybackTick: (callback) => ipcRenderer.on('playback-tick', (_event, payload) => callback(payload)),
  onLyrics: (callback) => ipcRenderer.on('lyrics-update', (_event, payload) => callback(payload)),
  onInteractionState: (callback) => ipcRenderer.on('interaction-state', (_event, payload) => callback(payload)),
  onUiScale: (callback) => ipcRenderer.on('ui-scale', (_event, payload) => callback(payload)),
  onLayoutMode: (callback) => ipcRenderer.on('layout-mode', (_event, payload) => callback(payload)),
  onMediaSources: (callback) => ipcRenderer.on('media-sources', (_event, payload) => callback(payload)),
  onDemoTheme: (callback) => ipcRenderer.on('demo-theme', (_event, payload) => callback(payload)),
  onRestartAudio: (callback) => ipcRenderer.on('restart-audio', callback),
  onRhythmModel: (callback) => ipcRenderer.on('rhythm-model', (_event, payload) => callback(payload)),
  onBackdropProfile: (callback) => ipcRenderer.on('backdrop-profile', (_event, payload) => callback(payload)),
  onOpenSettings: (callback) => ipcRenderer.on('settings:open', callback),
  onOpenGenreCorrection: (callback) => ipcRenderer.on('genre-correction:open', callback)
});
