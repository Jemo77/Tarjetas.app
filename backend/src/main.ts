import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });

  const config = app.get(ConfigService);

  // Seguridad y utilidades
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger /v1/docs
  const doc = new DocumentBuilder()
    .setTitle('Tarjetas de fidelidad - API')
    .setDescription('Backend SaaS de tarjetas de sellos digitales para bares y cafés.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, doc);
  SwaggerModule.setup('v1/docs', app, document, { swaggerOptions: { persistAuthorization: true } });

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port, '0.0.0.0');
}
await bootstrap();