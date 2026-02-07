import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { ReportModule } from './report/report.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RevenueModule } from './revenue/revenue.module';
import { ExpenseModule } from './expense/expense.module';
import { CashRegisterModule } from './cash-register/cash-register.module';
import { SaleModule } from './sale/sale.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { StockModule } from './stock/stock.module';
import { StoreModule } from './store/store.module';
import { ProductModule } from './product/product.module';
import { SupplierModule } from './supplier/supplier.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    UserModule,
    AuthModule,
    CategoryModule,
    SupplierModule,
    ProductModule,
    StoreModule,
    StockModule,
    StockMovementModule,
    SaleModule,
    CashRegisterModule,
    ExpenseModule,
    RevenueModule,
    DashboardModule,
    ReportModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
