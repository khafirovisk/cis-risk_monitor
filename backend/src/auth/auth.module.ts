import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SessionSerializer } from './session.serializer';
import { SamlStrategy } from './saml.strategy';
import { AuthenticatedGuard } from './authenticated.guard';

const providers: any[] = [SessionSerializer, AuthenticatedGuard];
// só registra a estratégia SAML se estiver configurada
if (process.env.SAML_ENTRY_POINT) providers.push(SamlStrategy);

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController],
  providers,
  exports: [AuthenticatedGuard],
})
export class AuthModule {}
