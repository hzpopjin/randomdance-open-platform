import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number = 10;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiResponseUtil {
  static success<T>(data: T, message = 'success'): ApiResponse<T> {
    return { code: 0, message, data };
  }
}
