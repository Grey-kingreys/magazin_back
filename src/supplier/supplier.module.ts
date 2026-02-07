import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { PrismaService } from 'src/common/services/prisma.service';

@Module({
  controllers: [SupplierController],
  providers: [SupplierService, PrismaService],
  exports: [SupplierService], // Export pour utilisation dans d'autres modules
})
export class SupplierModule { }