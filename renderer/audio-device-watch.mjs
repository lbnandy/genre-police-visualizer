export function outputDeviceSignature(devices = []) {
  return [...devices]
    .filter((device) => device?.kind === 'audiooutput')
    .map((device) => [
      String(device.deviceId || ''),
      String(device.groupId || ''),
      String(device.label || '').trim().toLowerCase()
    ].join('|'))
    .sort()
    .join('::');
}
