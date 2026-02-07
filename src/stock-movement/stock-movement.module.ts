import { Module } from '@nestjs/common';
import { StockMovementService } from './stock-movement.service';
import { StockMovementController } from './stock-movement.controller';
import { PrismaService } from 'src/common/services/prisma.service';

@Module({
  controllers: [StockMovementController],
  providers: [StockMovementService, PrismaService],
  exports: [StockMovementService],
})
export class StockMovementModule {}
