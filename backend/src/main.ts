import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import passport from 'passport';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');

  const isProd = process.env.NODE_ENV === 'production';
  app.set('trust proxy', 1); // atrás do Nginx

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8, // 8h
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // em dev, libera o front do Vite
  if (!isProd) {
    app.enableCors({ origin: process.env.APP_BASE_URL, credentials: true });
  }

  await app.listen(3000, '0.0.0.0');
  console.log('Sentinela CIS API on :3000');
}
bootstrap();
