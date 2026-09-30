import { Tag } from 'antd';
import { SUBMISSION_STATUS_MAP, REGISTRATION_STATUS_MAP } from '../../config/constants';

export function SubmissionStatusTag({ status }: { status: string }) {
  const config = (SUBMISSION_STATUS_MAP as any)[status] || { label: status, color: 'default' };
  return <Tag color={config.color}>{config.label}</Tag>;
}

export function RegistrationStatusTag({ status }: { status: string }) {
  const config = (REGISTRATION_STATUS_MAP as any)[status] || { label: status, color: 'default' };
  return <Tag color={config.color}>{config.label}</Tag>;
}
