import { CatalogModule } from '../catalog/catalog.module.js';
import { UsersModule } from '../users/users.module.js';

import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { OrdersController } from './orders.controller.js';
import { StaffOrdersController } from './controllers/staff-orders.controller.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { OrderExpiryJob } from './services/order-expiry.job.js';
import { OrdersService } from './services/orders.service.js';

@Module({
  imports: [PromotionsModule, CatalogModule, InventoryModule, UsersModule],
  controllers: [OrdersController, StaffOrdersController],
  providers: [OrdersRepository, OrdersService, OrderExpiryJob],
  exports: [OrdersService],
})
export class OrdersModule {}
