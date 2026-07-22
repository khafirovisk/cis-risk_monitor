import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import session from 'express-session';
import passport from 'passport';
import { Pool } from 'pg';
import connectPgSimple from 'connect-pg-simple';
import { AppModule } from './app.module';

const PgSession = connectPgSimple(session);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');

  const isProd = process.env.NODE_ENV === 'production';
  app.set('trust proxy', 1); // atrás do Nginx

  // Sessões persistidas no Postgres (mesma base do Prisma) — sobrevivem a
  // restart/redeploy do backend. Sem isso o express-session usa MemoryStore,
  // derrubando todas as sessões (SAML e local-admin) a cada restart.
  const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });

  app.use(
    session({
      store: new PgSession({ pool: sessionPool, createTableIfMissing: true }),
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
