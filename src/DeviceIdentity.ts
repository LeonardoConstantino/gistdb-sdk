import { DeviceInfo } from './types.js';

const STORAGE_KEY = '__gdb_dev_id__';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function detectPlatform(): string {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edge')) return 'Edge';
    return 'Browser';
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return `Node.js (${process.version})`;
  }
  return 'Unknown Environment';
}

export class DeviceIdentity {
  static getOrCreateId(): string {
    try {
      if (typeof localStorage !== 'undefined') {
        let id = localStorage.getItem(STORAGE_KEY);
        if (!id) {
          id = generateUUID();
          localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
      }
    } catch {}
    return generateUUID();
  }

  static getDeviceInfo(customName?: string): DeviceInfo {
    const id = DeviceIdentity.getOrCreateId();
    const platform = detectPlatform();
    const defaultName = typeof navigator !== 'undefined'
      ? `${platform} Device`
      : `Node Client (${id.substring(0, 6)})`;

    return {
      id,
      name: customName || defaultName,
      platform,
      lastSeenAt: new Date().toISOString(),
    };
  }
}
