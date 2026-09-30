import request from '../utils/request';
import type { ApiResponse } from '../types/api';

export interface DashboardStats {
  summary: {
    total_users: number; users_last_7_days: number;
    total_registrations: number; registrations_last_7_days: number;
    total_submissions: number; submissions_last_7_days: number;
    active_sessions: number;
  };
  pending: { registrations: number; submissions: number; songs: number };
  trend: Array<{ date: string; registrations: number; submissions: number }>;
  upcoming_sessions: any[];
  recent_activity: Array<{
    id: string; type: 'registration' | 'submission';
    title: string; description: string; status: string; created_at: string;
  }>;
  system_health: { requests_24h: number; errors_24h: number; client_events_24h: number; error_rate: number };
  generated_at: string;
}

export function getDashboardStats() {
  return request.get<ApiResponse<DashboardStats>>('/admin/dashboard');
}
