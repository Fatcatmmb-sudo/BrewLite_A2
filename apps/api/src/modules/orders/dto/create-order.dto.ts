import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
  ValidateNested, ArrayMaxSize, ArrayMinSize,
} from 'class-validator';

export class OrderItemToppingDto {
  @IsUUID()
  toppingId!: string;
}

export class CreateOrderItemDto {
  @IsUUID()
  productVariantId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sugarLevel?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  iceLevel?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemToppingDto)
  toppings?: OrderItemToppingDto[];
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;
}
