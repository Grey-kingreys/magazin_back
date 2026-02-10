import { Module } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { PrismaService } from 'src/common/services/prisma.service';
import { StoreFinanceService } from 'src/common/services/store-finance.service';
import { CashRegisterService } from 'src/cash-register/cash-register.service';

@Module({
  controllers: [ExpenseController],
  providers: [ExpenseService, PrismaService, StoreFinanceService, CashRegisterService],
})
export class ExpenseModule { }