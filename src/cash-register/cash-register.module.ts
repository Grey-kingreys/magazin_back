import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { PrismaService } from 'src/common/services/prisma.service';
import { StoreFinanceService } from 'src/common/services/store-finance.service';

@Module({
  controllers: [CashRegisterController],
  providers: [CashRegisterService, PrismaService, StoreFinanceService],
})
export class CashRegisterModule {}
