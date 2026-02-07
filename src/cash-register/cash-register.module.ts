import { Module } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { PrismaService } from 'src/common/services/prisma.service';

@Module({
  controllers: [CashRegisterController],
  providers: [CashRegisterService, PrismaService],
})
export class CashRegisterModule {}
