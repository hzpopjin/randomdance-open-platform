import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SystemLogService } from '../../modules/system-logs/system-log.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly systemLogService?: SystemLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = 1;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'object' && resp !== null) {
        const r = resp as Record<string, any>;
        message = r.message
          ? Array.isArray(r.message)
            ? r.message.join('; ')
            : r.message
          : message;
        code = r.code ?? status;
      } else {
        message = String(resp);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status === HttpStatus.UNAUTHORIZED) code = 10002;

    void this.systemLogService?.createFromRequest(request, {
      level: status >= 500 ? 'error' : 'warn',
      type: 'api_error',
      status_code: status,
      business_code: code,
      message,
      duration_ms: 0,
      error_stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({ code, message, data: null });
  }
}
