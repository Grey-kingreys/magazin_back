import { Module } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { PrismaService } from 'src/common/services/prisma.service';
import { StoreFinanceService } from 'src/common/services/store-finance.service';

@Module({
  controllers: [ExpenseController],
  providers: [ExpenseService, PrismaService, StoreFinanceService],
})
export class ExpenseModule {}
