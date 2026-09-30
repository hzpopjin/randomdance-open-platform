import { Tag } from 'antd';
import { PLAY_PART_MAP } from '../../config/constants';

export default function PlayPartTag({ playPart }: { playPart: number }) {
  const label = PLAY_PART_MAP[playPart] || '未知';
  const colors: Record<number, string> = { 0: 'blue', 1: 'green', 2: 'purple' };
  return <Tag color={colors[playPart] || 'default'}>{label}</Tag>;
}
