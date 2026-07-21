import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Bloqueia rotas sem sessão. Em desenvolvimento (sem SAML configurado)
 * injeta um usuário mock para facilitar o trabalho local.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.isAuthenticated?.()) return true;

    if (process.env.NODE_ENV !== 'production' && !process.env.SAML_ENTRY_POINT) {
      req.user = { id: 'dev', email: 'dev@local', name: 'Dev', role: 'ADMIN' };
      return true;
    }
    return false;
  }
}
