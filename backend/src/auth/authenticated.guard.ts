import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Bloqueia rotas sem sessão, e também bloqueia se o usuário local
 * ainda precisa trocar a senha (mustChangePassword). Em desenvolvimento
 * (sem sessão nenhuma) injeta um usuário mock para facilitar o trabalho local.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (req.isAuthenticated?.()) {
      return !req.user?.mustChangePassword && !req.user?.mfaEnrollRequired;
    }

    if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 'dev', email: 'dev@local', name: 'Dev', role: 'ADMIN' };
      return true;
    }

    return false;
  }
}
