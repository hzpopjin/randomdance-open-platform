import { resolve } from 'path';

/**
 * 本地上传根目录（TOS 未启用时的回退落盘位置，同时也是 /uploads 静态服务的根）。
 *
 * - 优先使用 UPLOAD_DIR 环境变量（绝对路径或相对 cwd 解析）。
 * - 否则回退到 `process.cwd()/uploads`。pm2 下 cwd=backend/，因此落在 backend/uploads，
 *   位于 dist 之外，不会被 nest-cli.json 的 deleteOutDir:true 清空。
 *
 * main.ts 的 useStaticAssets 与 ObjectStorageService.saveLocally 必须共用此常量，
 * 保证「写入目录」与「静态服务目录」单一来源、永不错位。
 */
export const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? resolve(process.env.UPLOAD_DIR)
  : resolve(process.cwd(), 'uploads');

/** 路演音频上限：30MB */
export const AUDIO_MAX_BYTES = 30 * 1024 * 1024;

/** 路演审核视频上限：1GB */
export const VIDEO_MAX_BYTES = 1024 * 1024 * 1024;
