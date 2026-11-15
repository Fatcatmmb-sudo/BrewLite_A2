
import {
  Body,
  ForbiddenException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { UserRole } from '../../../generated/prisma/client.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';

import {
  ReceiveStockDto,
  StaffInventoryQueryDto,
} from '../dto/staff-inventory.dto.js';

import { InventoryService } from '../services/inventory.service.js';

@Controller('staff/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BARISTA)
export class StaffInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // GET /api/v1/staff/inventory
  // Lấy danh sách nguyên liệu.
  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Query() query: StaffInventoryQueryDto,
  ) {
    return this.inventory.listIngredients(user.id, query);
  }

  // GET /api/v1/staff/inventory/:id
  // Xem chi tiết một nguyên liệu.
  @Get(':id')
  async detail(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.inventory.getIngredient(user.id, id),
    };
  }

  // POST /api/v1/staff/inventory/:id/receipts
  // Barista nhập thêm số lượng nguyên liệu.
  @Post(':id/receipts')
  @HttpCode(HttpStatus.CREATED)
  async receiveStock(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveStockDto,
  ) {
    return {
      data: await this.inventory.receiveStock(
        user.id,
        id,
        dto.quantity,
      ),
    };
  }

  // Barista không được cập nhật tồn kho bằng API cũ.
  // Giữ lại để các client cũ vẫn nhận được 403.
  @Patch(':id/stock')
  update() {
    throw new ForbiddenException({
      error: {
        code: 'FORBIDDEN_RESOURCE',
        message: 'Barista chỉ được xem tồn kho, không được cập nhật số lượng.',
      },
    });
  }
}
