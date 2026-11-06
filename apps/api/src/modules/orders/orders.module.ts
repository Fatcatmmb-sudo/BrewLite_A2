import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Reflector } from '@nestjs/core';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, Reflector],
  exports: [OrdersService],
})
export class OrdersModule {}
