import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController } from './sale.controller';
import { PrismaService } from 'src/common/services/prisma.service';
import { StoreFinanceService } from 'src/common/services/store-finance.service';

@Module({
  controllers: [SaleController],
  providers: [SaleService, PrismaService, StoreFinanceService],
})
export class SaleModule {}
