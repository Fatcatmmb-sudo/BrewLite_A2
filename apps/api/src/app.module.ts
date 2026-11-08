import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    AuthModule,
    CatalogModule,
    HealthModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule,
    PromotionsModule,
  ],
})
export class AppModule {}
