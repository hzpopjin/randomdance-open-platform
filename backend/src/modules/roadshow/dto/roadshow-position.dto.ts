import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from '../../../common/dto/device-info.dto';

export class SelectRoadshowPositionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position_id: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device_info?: DeviceInfoDto;
}

export class CancelRoadshowPositionDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device_info?: DeviceInfoDto;
}
