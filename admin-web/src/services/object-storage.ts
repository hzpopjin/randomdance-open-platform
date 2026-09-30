import request from '../utils/request';
import type { ApiResponse } from '../types/api';
import type {
  AdminObjectStorageConfig,
  ObjectStorageReadAccess,
  ObjectStorageTestResult,
  UpdateObjectStorageConfigInput,
} from '../types/object-storage';

export function getObjectStorageConfig() {
  return request.get<ApiResponse<AdminObjectStorageConfig>>('/admin/object-storage');
}

export function updateObjectStorageConfig(data: UpdateObjectStorageConfigInput) {
  return request.put<ApiResponse<AdminObjectStorageConfig>>('/admin/object-storage', data);
}

export function testObjectStorageConnection() {
  return request.post<ApiResponse<ObjectStorageTestResult>>('/admin/object-storage/test');
}

export function getObjectStorageReadAccess(url: string) {
  return request.get<ApiResponse<ObjectStorageReadAccess>>('/admin/object-storage/access', {
    params: { url },
  });
}
