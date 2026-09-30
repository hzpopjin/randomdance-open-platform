import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse, ApiResponseUtil } from '../dto/pagination.dto';
import { SKIP_RESPONSE_WRAP } from '../decorators/skip-response-wrap.decorator';
import { SystemLogService } from '../../modules/system-logs/system-log.service';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | any> {
  constructor(
    private reflector: Reflector,
    private readonly systemLogService?: SystemLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | any> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const skipWrap = this.reflector.get<boolean>(SKIP_RESPONSE_WRAP, context.getHandler());

    if (skipWrap) {
      return next.handle().pipe(
        map((data) => {
          this.logSuccess(req, res, data, startedAt, undefined, undefined);
          return data;
        }),
      );
    }

    return next.handle().pipe(
      map((data) => {
        const wrapped = ApiResponseUtil.success(data);
        this.logSuccess(req, res, wrapped, startedAt, wrapped.code, wrapped.message);
        return wrapped;
      }),
    );
  }

  private logSuccess(
    req: Request,
    res: Response,
    responsePayload: any,
    startedAt: number,
    businessCode?: number,
    message?: string,
  ) {
    if (!this.systemLogService) return;
    const path = req.originalUrl || req.url || '';
    if (path.startsWith('/api/v1/admin/system-logs')) return;
    void this.systemLogService.createFromRequest(req, {
      level: 'info',
      type: 'api_request',
      status_code: res.statusCode,
      business_code: businessCode ?? null,
      message: message || 'success',
      duration_ms: Date.now() - startedAt,
      response_payload: responsePayload,
    });
  }
}
