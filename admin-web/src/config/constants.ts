export const SUBMISSION_STATUS_MAP = {
  pending: { label: '待审核', color: 'orange' },
  approved: { label: '已收录', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
} as const;

export const REGISTRATION_STATUS_MAP = {
  pending: { label: '待审核', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
} as const;

export const PLAY_PART_MAP: Record<number, string> = {
  0: '全曲',
  1: '副歌',
  2: '自定义',
};

export const SONG_FORMAT_MAP: Record<number, string> = {
  0: '原版',
  1: '自己剪辑',
};
