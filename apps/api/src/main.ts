import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  config({ path: resolve(process.cwd(), '../../.env') });
  const app = await NestFactory.create(AppModule, { cors: false });
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const port = Number(process.env.API_PORT ?? 4000);

  app.use(helmet());
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.get('origin');
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (isMutation && origin && origin !== frontendUrl) {
      response.status(403).json({ statusCode: 403, message: 'Request origin is not allowed.' });
      return;
    }
    next();
  });
  app.enableCors({ origin: frontendUrl, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const swaggerConfig = new DocumentBuilder()
    .setTitle('StayShield API')
    .setDescription('Hotel network and cybersecurity management API')
    .setVersion('0.1.0')
    .addCookieAuth('stayshield_session')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(port);
}

void bootstrap();
