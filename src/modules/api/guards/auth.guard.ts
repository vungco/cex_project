import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserEntity } from 'src/modules/database/entities';
import { UserService } from 'src/modules/database/services';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    if (!authHeader || typeof authHeader !== 'string')
      throw new UnauthorizedException('No token provided');
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token)
      throw new UnauthorizedException('Invalid token format');
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'changeme',
      });

      if (!payload) throw new UnauthorizedException('Invalid token');

      // 👇 BƯỚC MỚI: Truy vấn User từ DB bằng ID trong payload
      const user: UserEntity = await this.userService.findByEmail(
        payload.email,
      );

      if (!user) {
        // Nếu token hợp lệ nhưng không tìm thấy người dùng (VD: đã bị xóa)
        throw new UnauthorizedException('User not found');
      }

      request['user'] = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
