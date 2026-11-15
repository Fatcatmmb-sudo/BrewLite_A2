import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRefundRequestDto {
  @IsString({ message: 'Lý do yêu cầu hoàn tiền phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Lý do yêu cầu hoàn tiền không được để trống.' })
  @MaxLength(255, { message: 'Lý do yêu cầu hoàn tiền không được vượt quá 255 ký tự.' })
  reason!: string;
}

export class RejectRefundRequestDto {
  @IsString({ message: 'Lý do từ chối hoàn tiền phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Lý do từ chối hoàn tiền không được để trống.' })
  @MaxLength(255, { message: 'Lý do từ chối hoàn tiền không được vượt quá 255 ký tự.' })
  rejectReason!: string;
}

export interface RefundRequestResponseDto {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  processedByUserId?: string | null;
  processedAt?: string | null;
  rejectReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
