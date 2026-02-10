import { Module } from '@nestjs/common';
import { SaleService } from './sale.service';
import { SaleController } from './sale.controller';
import { PrismaService } from 'src/common/services/prisma.service';
import { CashRegisterService } from 'src/cash-register/cash-register.service'; // ⭐ Import

@Module({
  controllers: [SaleController],
  providers: [
    SaleService,
    PrismaService,
    CashRegisterService, // ⭐ Ajout du service de caisse
  ],
})
export class SaleModule { }