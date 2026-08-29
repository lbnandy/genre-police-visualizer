const test = require('node:test');
const assert = require('node:assert/strict');

test('output device signature changes when the Windows default endpoint changes', async () => {
  const { outputDeviceSignature } = await import('../renderer/audio-device-watch.mjs');
  const speakers = [
    { kind: 'audiooutput', deviceId: 'default', groupId: 'speaker-group', label: 'Default - Speakers' },
    { kind: 'audiooutput', deviceId: 'communications', groupId: 'headset-group', label: 'Headset' },
    { kind: 'audioinput', deviceId: 'mic', groupId: 'mic-group', label: 'Microphone' }
  ];
  const headset = [
    { kind: 'audiooutput', deviceId: 'default', groupId: 'headset-group', label: 'Default - Headset' },
    { kind: 'audiooutput', deviceId: 'communications', groupId: 'speaker-group', label: 'Speakers' },
    { kind: 'audioinput', deviceId: 'mic', groupId: 'mic-group', label: 'Microphone' }
  ];
  assert.notEqual(outputDeviceSignature(speakers), outputDeviceSignature(headset));
});

test('output device signature ignores microphone-only changes', async () => {
  const { outputDeviceSignature } = await import('../renderer/audio-device-watch.mjs');
  const before = [
    { kind: 'audiooutput', deviceId: 'default', groupId: 'speaker-group', label: 'Default - Speakers' },
    { kind: 'audioinput', deviceId: 'mic-a', groupId: 'mic-a', label: 'Microphone A' }
  ];
  const after = [
    { kind: 'audiooutput', deviceId: 'default', groupId: 'speaker-group', label: 'Default - Speakers' },
    { kind: 'audioinput', deviceId: 'mic-b', groupId: 'mic-b', label: 'Microphone B' }
  ];
  assert.equal(outputDeviceSignature(before), outputDeviceSignature(after));
});
