'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recordingControls', {
  command: (command) => ipcRenderer.send('recording-controls:command', command),
  activity: (phase) => ipcRenderer.send('recording-controls:activity', phase),
  onState: (callback) => ipcRenderer.on('recording-controls:state', (_event, payload) => callback(payload))
});
