import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { StaffInventoryController } from './controllers/staff-inventory.controller.js';
import { Module } from '@nestjs/common';
import { InventoryRepository } from './repositories/inventory.repository.js';
import { InventoryService } from './services/inventory.service.js';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [StaffInventoryController],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
