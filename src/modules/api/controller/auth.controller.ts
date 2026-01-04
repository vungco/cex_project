import { Body, Controller, Post } from '@nestjs/common';
import { RegisterDto, LoginDto, AuthResponseDto } from '../dtos/auth.dto';
import { AuthService } from '../services/auth.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagePattern } from '@nestjs/microservices';
import { UserEntity } from 'src/modules/database/entities';
import { UserService } from 'src/modules/database/services';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiBody({ type: RegisterDto })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<{ sucess: boolean }> {
    return await this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully.',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiBody({ type: LoginDto })
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(dto);
  }

  @MessagePattern('getUserByEmail')
  async getToken(data: { email: string }): Promise<UserEntity> {
    return await this.userService.findByEmail(data.email);
  }
}
