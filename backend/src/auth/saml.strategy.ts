import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifiedCallback } from '@node-saml/passport-saml';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Estratégia SAML 2.0 (SP). Valida a asserção do IdP e faz upsert do usuário.
 * Config via variáveis SAML_* (ver docs/SAML.md).
 */
@Injectable()
export class SamlStrategy extends PassportStrategy(Strategy, 'saml') {
  constructor(private prisma: PrismaService) {
    super({
      entryPoint: process.env.SAML_ENTRY_POINT,
      issuer: process.env.SAML_ISSUER || 'sentinela-cis',
      callbackUrl: process.env.SAML_CALLBACK_URL,
      idpCert: process.env.SAML_IDP_CERT || '',
      wantAssertionsSigned: true,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    });
  }

  async validate(profile: Profile, done: VerifiedCallback) {
    const email =
      (profile.email as string) ||
      (profile.nameID as string) ||
      (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string);

    if (!email) return done(new Error('SAML sem e-mail/NameID'), null);

    const name =
      (profile.displayName as string) ||
      (profile.name as string) ||
      (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string) ||
      email;

    const roleClaim = (profile.role as string)?.toUpperCase();
    const role = ['ADMIN', 'AUDITOR', 'LEITOR'].includes(roleClaim) ? roleClaim : 'AUDITOR';

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, samlNameId: profile.nameID as string },
      create: { email, name, samlNameId: profile.nameID as string, role: role as any },
    });

    return done(null, { id: user.id, email: user.email, name: user.name, role: user.role });
  }
}
