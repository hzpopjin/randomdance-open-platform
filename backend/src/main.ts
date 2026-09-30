import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SystemLogService } from './modules/system-logs/system-log.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { UPLOAD_ROOT } from './common/constants/upload';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const systemLogService = app.get(SystemLogService);
  app.useGlobalFilters(new AllExceptionsFilter(systemLogService));
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector), systemLogService));

  app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads' });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Backend service is running on http://localhost:${port}`);
  console.log(`API base: http://localhost:${port}/api/v1`);
}
bootstrap();
