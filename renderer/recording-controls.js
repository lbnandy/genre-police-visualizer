'use strict';

const controls = document.querySelector('#recording-controls');
const stopButton = document.querySelector('#recording-stop');

function applyState(payload = {}) {
  const state = payload.state || 'preparing';
  const appearance = payload.appearance || {};
  const labels = payload.labels || {};
  const active = state === 'recording' || state === 'stopping';
  const busy = state === 'preparing' || state === 'stopping';

  document.documentElement.style.setProperty('--accent', appearance.accent || '#67f7ff');
  document.documentElement.style.setProperty('--ui-scale', appearance.scale || 1);
  document.documentElement.style.setProperty('--button-size', `${appearance.buttonSize || 30}px`);
  document.documentElement.style.setProperty('--icon-size', `${appearance.iconSize || 16}px`);
  document.documentElement.style.setProperty('--control-gap', `${appearance.gap || 6}px`);
  document.documentElement.style.setProperty('--window-padding', `${appearance.edgePadding || 18}px`);
  document.body.classList.toggle('controls-visible', payload.visible === true);
  controls.setAttribute('aria-label', labels.stop || 'Recording controls');
  stopButton.classList.toggle('is-recording', active);
  stopButton.disabled = busy;
  stopButton.title = state === 'stopping' ? (labels.finalizing || labels.stop || '') : (labels.stop || '');
  stopButton.setAttribute('aria-label', stopButton.title);
}

stopButton.addEventListener('click', () => window.recordingControls.command('stop'));
window.addEventListener('pointermove', () => window.recordingControls.activity('enter'), { passive: true });
window.addEventListener('pointerleave', () => window.recordingControls.activity('leave'));
window.recordingControls.onState(applyState);
