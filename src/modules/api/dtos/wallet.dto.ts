import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { walletType } from 'src/modules/database/entities';

@ValidatorConstraint({ name: 'WalletTypeDifference', async: false })
export class WalletTypeDifference implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const object = args.object as any;
    return object.fromWalletType !== object.toWalletType;
  }

  defaultMessage() {
    return 'fromWalletType and toWalletType must be different';
  }
}

export class TransferTokenByWalletDto {
  @ApiProperty({ example: 'FUNDING', enum: walletType })
  @IsEnum(walletType)
  fromWalletType: walletType;

  @ApiProperty({ example: 'SPOT', enum: walletType })
  @IsEnum(walletType)
  toWalletType: walletType;

  @Validate(WalletTypeDifference)
  checkWalletDifference: boolean;

  @ApiProperty({ example: 1000 })
  @IsString()
  amount: string;

  @ApiProperty({ example: 'USDT' })
  @IsString()
  assetToken: string;
}
