import { Request } from 'express';
import { DeviceInfoDto } from '../dto/device-info.dto';

export interface DeviceInfo {
  platform?: string;
  device_id?: string;
  device_model?: string;
  os_version?: string;
  app_version?: string;
  client_ip?: string;
  user_agent?: string;
  request_id?: string;
  timestamp?: string;
}

export function extractDeviceInfo(req: Request, dto?: DeviceInfoDto): DeviceInfo {
  const getClientIp = (): string | undefined => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return (req.headers['x-real-ip'] as string) || req.ip;
  };

  return {
    platform: dto?.platform || (req.headers['x-platform'] as string),
    device_id: dto?.device_id || (req.headers['x-device-id'] as string),
    device_model: dto?.device_model || (req.headers['x-device-model'] as string),
    os_version: dto?.os_version || (req.headers['x-os-version'] as string),
    app_version: dto?.app_version || (req.headers['x-app-version'] as string),
    client_ip: dto?.client_ip || getClientIp(),
    user_agent: dto?.user_agent || req.headers['user-agent'],
    request_id: dto?.request_id || (req.headers['x-request-id'] as string),
    timestamp: dto?.timestamp || new Date().toISOString(),
  };
}

export function serializeDeviceInfo(info: DeviceInfo): string | null {
  const hasData = Object.values(info).some((v) => v !== undefined && v !== null);
  if (!hasData) return null;
  return JSON.stringify(info);
}

export function deserializeDeviceInfo(json: string | null): DeviceInfo | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
