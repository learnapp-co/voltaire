import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserDocument } from '../../schemas/user.schema';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: UserDocument = request.user;

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
