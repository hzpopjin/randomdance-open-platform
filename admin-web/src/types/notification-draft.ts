export interface NotificationVariable { name: string; required: boolean }
export interface NotificationDraftInput {
  name: string;
  title: string;
  body: string;
  variables: NotificationVariable[];
}
export interface NotificationDraft extends NotificationDraftInput {
  id: number;
  organizer_id: number;
  status: 'draft' | 'archived';
  revision: number;
  created_by: number;
  updated_by: number;
  created_at: string;
  updated_at: string;
}
export type PreviewValues = Record<string, string | number | boolean>;
export interface NotificationPreview { title: string; body: string; preview_only: true }
