import { Module } from '@nestjs/common';
import { RevenueService } from './revenue.service';
import { RevenueController } from './revenue.controller';
import { PrismaService } from 'src/common/services/prisma.service';

@Module({
  controllers: [RevenueController],
  providers: [RevenueService, PrismaService],
  exports: [RevenueService],
})
export class RevenueModule {}
