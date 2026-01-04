import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuth implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token =
        client.handshake.auth.token || client.handshake.headers.authorization;

      if (!token) {
        throw new WsException('Authentication token not provided');
      }

      const payload = this.jwtService.verify(token);
      if (!payload) {
        throw new WsException('Invalid authentication token');
      }

      client.handshake.auth.userId = payload.userId;
      client.handshake.auth.user = payload;

      return true;
    } catch {
      throw new WsException('Authentication failed');
    }
  }
}
