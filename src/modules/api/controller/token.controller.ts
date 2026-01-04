import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TokenService } from 'src/modules/database/services';
import { TokenCreateDto } from '../dtos';
import { AdminGuard } from '../guards/admin.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { MessagePattern } from '@nestjs/microservices';
import { TokenEntity } from 'src/modules/database/entities/token.entity';
import { AuthGuard } from '../guards/auth.guard';

@Controller('tokens')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @ApiOperation({ summary: 'create token' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'The token has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'bad request' })
  @ApiBody({ type: TokenCreateDto })
  @UseGuards(AdminGuard)
  @Post()
  async createToken(@Body() body: TokenCreateDto): Promise<any> {
    return await this.tokenService.createToken(body);
  }

  @ApiOperation({ summary: 'get all token' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'The token has been successfully getted.',
  })
  @ApiResponse({ status: 400, description: 'bad request' })
  @UseGuards(AuthGuard)
  @Get()
  async getAllToken(): Promise<any> {
    return await this.tokenService.getAll();
  }

  @MessagePattern('getToken')
  async getToken(data: { token_id: string }): Promise<TokenEntity> {
    return this.tokenService.findById(data.token_id);
  }
}
