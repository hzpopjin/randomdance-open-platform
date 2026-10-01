import request from '../utils/request';
import type { ApiResponse } from '../types/api';
import type { NotificationDraft, NotificationDraftInput, NotificationPreview, PreviewValues } from '../types/notification-draft';
const base = '/admin/notification-drafts';
export const getNotificationDrafts = () => request.get<ApiResponse<NotificationDraft[]>>(base);
export const createNotificationDraft = (data: NotificationDraftInput) => request.post<ApiResponse<NotificationDraft>>(base, data);
export const updateNotificationDraft = (id: number, data: NotificationDraftInput, revision: number) =>
  request.put<ApiResponse<NotificationDraft>>(`${base}/${id}`, { ...data, revision });
export const archiveNotificationDraft = (id: number, revision: number) =>
  request.post<ApiResponse<NotificationDraft>>(`${base}/${id}/archive`, { revision });
export const restoreNotificationDraft = (id: number, revision: number) =>
  request.post<ApiResponse<NotificationDraft>>(`${base}/${id}/restore`, { revision });
export const previewNotificationDraft = (id: number, revision: number, values: PreviewValues) =>
  request.post<ApiResponse<NotificationPreview>>(`${base}/${id}/preview`, { revision, values });
