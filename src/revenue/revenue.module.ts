import { Module } from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { RevenueController } from './revenue.controller';
import { PrismaService } from 'src/common/services/prisma.service';
import { StoreFinanceService } from 'src/common/services/store-finance.service';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService, PrismaService, StoreFinanceService],
  exports: [RevenueService],
})
export class RevenueModule {}
