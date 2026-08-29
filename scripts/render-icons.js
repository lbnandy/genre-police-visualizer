'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const assets = path.join(__dirname, '..', 'assets');
  const outputs = [
    ['icon.svg', 'icon.png', 512],
    ['tray-icon.svg', 'tray-icon.png', 64]
  ];
  const window = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  });
  for (const [source, target, size] of outputs) {
    const svg = fs.readFileSync(path.join(assets, source), 'utf8');
    window.setContentSize(size, size);
    const html = `<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`;
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const image = await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
    fs.writeFileSync(path.join(assets, target), image.toPNG());
  }
  window.destroy();
  app.quit();
});
