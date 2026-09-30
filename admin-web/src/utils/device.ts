export function getDeviceHeaders(): Record<string, string> {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'dev_' + (crypto.randomUUID?.() || Date.now().toString(36));
    localStorage.setItem('device_id', deviceId);
  }
  return {
    'X-Device-Id': deviceId,
    'X-Platform': 'web',
  };
}
