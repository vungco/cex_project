import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Injectable()
export class AdminGuard extends AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest() as any;
    const user = request.user;
    if (user && user.role === 'admin') {
      return true;
    }
    throw new ForbiddenException('Admin access only');
  }
}
