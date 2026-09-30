import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class RoadshowUploadContextDto {
  // 放宽校验：第三方在 multipart 中可能携带空/非数字 sessionId。
  // 全局 ValidationPipe 开启 whitelist，未声明字段会被静默剥离；此处仅做可选转换，
  // 非法值（NaN/0）由下游 resolveObjectDirectory 的 truthy 判断回退到 unassigned 目录，不再 400。
  @IsOptional()
  @Type(() => Number)
  sessionId?: number;
}
