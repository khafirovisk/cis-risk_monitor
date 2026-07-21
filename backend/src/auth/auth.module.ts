import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SamlConfigController } from './saml-config.controller';
import { SessionSerializer } from './session.serializer';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { SamlConfigService } from './saml-config.service';
import { LocalAdminAccountService } from './local-admin-account.service';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController, SamlConfigController],
  providers: [SessionSerializer, AuthenticatedGuard, RolesGuard, SamlConfigService, LocalAdminAccountService],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
