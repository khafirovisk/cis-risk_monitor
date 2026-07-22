import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SamlConfigController } from './saml-config.controller';
import { SecurityController } from './security-settings.controller';
import { SessionSerializer } from './session.serializer';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { SamlConfigService } from './saml-config.service';
import { SecuritySettingsService } from './security-settings.service';
import { LocalAdminAccountService } from './local-admin-account.service';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController, SamlConfigController, SecurityController],
  providers: [SessionSerializer, AuthenticatedGuard, RolesGuard, SamlConfigService, SecuritySettingsService, LocalAdminAccountService],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
