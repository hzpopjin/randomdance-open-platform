import request from '../utils/request';
import type { ApiResponse } from '../types/api';

export function getClientConfigs() {
  return request.get<ApiResponse<Array<{ config_key: string; config_value: any }>>>('/admin/client-config');
}

export function setClientConfig(config_key: string, config_value: any) {
  return request.put<ApiResponse<{ config_key: string; config_value: any }>>('/admin/client-config', { config_key, config_value });
}
