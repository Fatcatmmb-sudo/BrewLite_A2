import { Controller, Post, Get, Patch, Query, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { OrdersService } from './services/orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../../common/utils/jwt.js';
import { OrderHistoryQueryDto } from './dto/order-history-query.dto.js';
import { UpdateOrderStatusDto } from './dto/staff-orders.dto.js';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles('CUSTOMER')
  @UseGuards(RolesGuard)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    const data = await this.ordersService.createOrder(user.sub, dto);
    return { success: true, data };
  }

  @Get('me')
  async getMyOrders(@CurrentUser() user: JwtPayload, @Query() query: OrderHistoryQueryDto = {}) {
    // Include pagination metadata only when the caller passes a history query option.
    if (query.limit !== undefined || query.cursor !== undefined || query.status !== undefined) {
      return { success: true, ...await this.ordersService.getMyOrdersPage(user.sub, query) };
    }
    const data = await this.ordersService.getMyOrders(user.sub);
    return { success: true, data };
  }

  @Get(':id')
  async getOrder(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const data = await this.ordersService.getOrderDetail(id, user.sub);
    return { success: true, data };
  }

  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.ordersService.cancelOrder(id, user.sub, 'Khách hàng yêu cầu hủy đơn hàng', false);
    const data = await this.ordersService.getOrderDetail(id, user.sub);
    return { success: true, data };
  }

  @Patch(':id/status')
  @Roles('BARISTA')
  @UseGuards(RolesGuard)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const data = await this.ordersService.advanceOrderStatus(id, user.sub, body.status);
    return { success: true, data };
  }
}
