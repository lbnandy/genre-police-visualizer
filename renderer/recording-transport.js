'use strict';

const controls = document.querySelector('#recording-controls');
const previousButton = document.querySelector('#recording-previous');
const playPauseButton = document.querySelector('#recording-play-pause');
const nextButton = document.querySelector('#recording-next');

function setPlaying(playing) {
  playPauseButton.classList.toggle('is-playing', Boolean(playing));
}

function applyState(payload = {}) {
  const appearance = payload.appearance || {};
  const labels = payload.labels || {};
  document.documentElement.style.setProperty('--accent', appearance.accent || '#67f7ff');
  document.documentElement.style.setProperty('--ui-scale', appearance.scale || 1);
  document.documentElement.style.setProperty('--button-size', `${appearance.transportButtonSize || 30}px`);
  document.documentElement.style.setProperty('--icon-size', `${appearance.transportIconSize || 16}px`);
  document.documentElement.style.setProperty('--control-gap', `${appearance.transportGap || 6}px`);
  document.documentElement.style.setProperty('--window-padding', `${appearance.edgePadding || 18}px`);
  document.body.classList.toggle('controls-visible', payload.visible === true);
  controls.setAttribute('aria-label', labels.play || 'Music controls');
  setPlaying(payload.playing);
  previousButton.title = labels.previous || '';
  previousButton.setAttribute('aria-label', labels.previous || '');
  playPauseButton.title = payload.playing ? (labels.pause || '') : (labels.play || '');
  playPauseButton.setAttribute('aria-label', playPauseButton.title);
  nextButton.title = labels.next || '';
  nextButton.setAttribute('aria-label', labels.next || '');
}

previousButton.addEventListener('click', () => window.recordingControls.command('previous'));
playPauseButton.addEventListener('click', () => {
  setPlaying(!playPauseButton.classList.contains('is-playing'));
  window.recordingControls.command('toggle');
});
nextButton.addEventListener('click', () => window.recordingControls.command('next'));
window.addEventListener('pointermove', () => window.recordingControls.activity('enter'), { passive: true });
window.addEventListener('pointerleave', () => window.recordingControls.activity('leave'));
window.recordingControls.onState(applyState);
