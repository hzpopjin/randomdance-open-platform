import request from '../utils/request';
import type { ApiResponse, PaginatedData, RegistrationStatus } from '../types/api';
import type {
  Registration,
  RegistrationDetail,
  RoadshowArrangement,
  RoadshowMediaState,
  RoadshowMediaType,
  RoadshowMediaUploadTicket,
  RoadshowPositionSection,
} from '../types/roadshow';

export function getRegistrations(params?: {
  page?: number; page_size?: number; session_id?: number; status?: string;
  keyword?: string; sort_by?: string; sort_order?: 'ASC' | 'DESC';
}) {
  return request.get<ApiResponse<PaginatedData<Registration>>>('/admin/roadshow/registrations', { params });
}

export function getRegistrationDetail(id: number) {
  return request.get<ApiResponse<RegistrationDetail>>(`/admin/roadshow/registrations/${id}`);
}

export function reviewRegistration(id: number, data: { status: RegistrationStatus; review_comment?: string }) {
  return request.put<ApiResponse<{ id: number; status: RegistrationStatus; review_comment?: string }>>(`/admin/roadshow/registrations/${id}/status`, data);
}

export function batchReviewRegistrations(data: { ids: number[]; status: RegistrationStatus; review_comment?: string }) {
  return request.post<ApiResponse<null>>('/admin/roadshow/registrations/batch', data);
}

export function deleteRegistration(id: number) {
  return request.delete<ApiResponse<{ id: number }>>(`/admin/roadshow/registrations/${id}`);
}

export function batchDeleteRegistrations(ids: number[]) {
  return request.delete<ApiResponse<{ affected: number }>>('/admin/roadshow/registrations/batch', { data: { ids } });
}

export function exportRegistrations(params?: Record<string, any>) {
  return request.get('/admin/roadshow/registrations/export', { params, responseType: 'blob' });
}

// ==================== 管理端路演编排 ====================

export function getRoadshowArrangement(sessionId: number) {
  return request.get<ApiResponse<RoadshowArrangement>>(
    `/admin/roadshow/registrations/arrangement/${sessionId}`,
  );
}

export function saveRoadshowArrangement(
  sessionId: number,
  data: {
    expected_version?: string;
    items: {
      registration_id: number;
      section: RoadshowPositionSection;
      position_no: number;
      locked: boolean;
    }[];
  },
) {
  return request.put<ApiResponse<RoadshowArrangement>>(
    `/admin/roadshow/registrations/arrangement/${sessionId}`,
    data,
  );
}

// ==================== 路演素材直传（TOS 预签名） ====================

function fallbackMediaType(name: string, type: RoadshowMediaType) {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', flac: 'audio/flac',
    aac: 'audio/aac', ogg: 'audio/ogg', mp4: 'video/mp4', mov: 'video/quicktime',
    m4v: 'video/x-m4v', webm: 'video/webm',
  };
  return (ext && map[ext]) || `${type === 'audio' ? 'audio' : 'video'}/octet-stream`;
}

/** 申请预签名直传票据（返回 upload_url / object_key / headers）。 */
export function createRoadshowMediaUpload(
  registrationId: number,
  type: RoadshowMediaType,
  file: File,
) {
  return request.post<ApiResponse<RoadshowMediaUploadTicket>>(
    `/roadshow/registrations/${registrationId}/media/${type}/upload-url`,
    {
      file_name: file.name,
      content_type: file.type || fallbackMediaType(file.name, type),
      file_size: file.size,
    },
  );
}

/** 直传完成后回调后端 HeadObject 复核并落库。 */
export function completeRoadshowMediaUpload(
  registrationId: number,
  type: RoadshowMediaType,
  objectKey: string,
) {
  return request.post<ApiResponse<RoadshowMediaState>>(
    `/roadshow/registrations/${registrationId}/media/${type}/complete`,
    { object_key: objectKey },
  );
}

/** 查询报名的音频与审核视频素材状态。 */
export function getRoadshowMedia(registrationId: number) {
  return request.get<ApiResponse<RoadshowMediaState>>(
    `/roadshow/registrations/${registrationId}/media`,
  );
}

/**
 * TOS 未启用时的本地回退上传：multipart POST 到 `.../media/:type`（字段名 `file`），
 * 服务端写入本地存储后直接返回 mediaState（与 GET media 一致）。
 * 走后端转发，故放宽超时并透传上传进度。
 */
export function uploadRoadshowMediaLocal(
  registrationId: number,
  type: RoadshowMediaType,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const formData = new FormData();
  formData.append('file', file);
  return request.post<ApiResponse<RoadshowMediaState>>(
    `/roadshow/registrations/${registrationId}/media/${type}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30 * 60 * 1000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    },
  );
}

/** 直传句柄：promise 用于 await，abort 用于组件卸载或用户取消时中断 XHR。 */
export interface SignedUrlUploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

/**
 * 通过 XHR 直传到预签名 URL，带上传进度回调（不受后端 SDK 超时限制）。
 * 增加 30 分钟超时与 abort 能力，返回 { promise, abort } 以便组件卸载时中断，
 * 避免对已卸载组件 setState。
 */
export function uploadFileToSignedUrl(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
  timeoutMs = 30 * 60 * 1000,
): SignedUrlUploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`存储桶上传失败（HTTP ${xhr.status}）`)));
    xhr.onerror = () => reject(new Error('无法连接对象存储，请检查网络或桶 CORS 配置'));
    xhr.ontimeout = () => reject(new Error('上传超时，请检查网络后重试'));
    xhr.onabort = () => reject(new Error('上传已中断'));
    xhr.send(file);
  });
  const abort = () => {
    try { xhr.abort(); } catch { /* 已结束的请求忽略 */ }
  };
  return { promise, abort };
}
