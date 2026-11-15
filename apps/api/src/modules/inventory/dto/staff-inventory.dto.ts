
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const STOCK_THRESHOLDS = {
  G: 500,
  ML: 1000,
  PCS: 10,
} as const;

export const stockStatus = (
  quantity: number,
  unit: keyof typeof STOCK_THRESHOLDS,
) =>
  quantity === 0
    ? 'OUT_OF_STOCK'
    : quantity <= STOCK_THRESHOLDS[unit]
      ? 'LOW_STOCK'
      : 'IN_STOCK';

export class StaffInventoryQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'])
  status?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Một dòng nguyên liệu trong phiếu nhập.
 */
export class ReceiveStockItemDto {
  @IsUUID()
  ingredientId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity!: number;
}

/**
 * Phiếu nhập kho có thể chứa nhiều nguyên liệu.
 */
export class ReceiveStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveStockItemDto)
  items!: ReceiveStockItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  supplier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  note?: string;
}
