import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { UserEntity } from 'src/modules/database/entities/user.entity';

export class RegisterDto {
  @ApiProperty({
    description: 'User email',
    example: 'something@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'strongPassword123',
  })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email',
    example: 'something@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'strongPassword123',
  })
  @IsNotEmpty()
  password: string;
}

export class AuthResponseDto {
  access_token: string;
  user: UserEntity;
}
