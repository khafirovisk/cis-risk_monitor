import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SamlConfigController } from './saml-config.controller';
import { SecurityController } from './security-settings.controller';
import { LocalAccountsController } from './local-accounts.controller';
import { SessionSerializer } from './session.serializer';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { SamlConfigService } from './saml-config.service';
import { SecuritySettingsService } from './security-settings.service';
import { LocalAccountsService } from './local-accounts.service';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController, SamlConfigController, SecurityController, LocalAccountsController],
  providers: [SessionSerializer, AuthenticatedGuard, RolesGuard, SamlConfigService, SecuritySettingsService, LocalAccountsService],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
