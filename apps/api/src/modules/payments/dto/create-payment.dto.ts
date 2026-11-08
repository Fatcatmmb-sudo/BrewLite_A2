import { IsEnum, IsUUID, IsString, MinLength, MaxLength } from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client.js';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}

export class IdempotencyKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;
}
