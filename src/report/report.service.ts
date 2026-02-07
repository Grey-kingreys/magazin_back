import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Rapport de ventes détaillé
   */
  async getSalesReport(
    startDate?: Date,
    endDate?: Date,
    storeId?: string,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    try {
      const where: any = {
        status: 'COMPLETED',
        createdAt: {},
      };

      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
      if (storeId) where.storeId = storeId;

      const sales = await this.prisma.sale.findMany({
        where,
        include: {
          store: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Grouper les ventes selon le paramètre
      const groupedSales = this.groupSalesByPeriod(sales, groupBy);

      // Calculer les totaux
      const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
      const totalDiscount = sales.reduce(
        (sum, sale) => sum + sale.discount,
        0,
      );
      const totalTax = sales.reduce((sum, sale) => sum + sale.tax, 0);

      return {
        data: {
          period: {
            startDate,
            endDate,
            groupBy,
          },
          summary: {
            totalSales: sales.length,
            totalRevenue: Math.round(totalRevenue),
            totalDiscount: Math.round(totalDiscount),
            totalTax: Math.round(totalTax),
            averageSale:
              sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0,
          },
          groupedData: groupedSales,
          detailedSales: sales,
        },
        message: 'Rapport de ventes généré avec succès',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la génération du rapport',
      );
    }
  }

  /**
   * Rapport de stock
   */
  async getStockReport(storeId?: string, lowStockOnly = false) {
    try {
      const where: any = {};
      if (storeId) where.storeId = storeId;

      const stocks = await this.prisma.stock.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              minStock: true,
              unit: true,
              costPrice: true,
              sellingPrice: true,
              isActive: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
        orderBy: {
          product: {
            name: 'asc',
          },
        },
      });

      // Filtrer par stock faible si demandé
      let filteredStocks = stocks;
      if (lowStockOnly) {
        filteredStocks = stocks.filter(
          (stock) =>
            stock.product.isActive &&
            stock.quantity <= stock.product.minStock,
        );
      }

      // Calculer les statistiques
      const totalProducts = filteredStocks.length;
      const lowStockCount = stocks.filter(
        (s) => s.quantity <= s.product.minStock,
      ).length;
      const totalValue = filteredStocks.reduce(
        (sum, stock) => sum + stock.quantity * stock.product.costPrice,
        0,
      );
      const potentialRevenue = filteredStocks.reduce(
        (sum, stock) => sum + stock.quantity * stock.product.sellingPrice,
        0,
      );

      // Grouper par catégorie
      const stocksByCategory = this.groupStocksByCategory(filteredStocks);

      return {
        data: {
          summary: {
            totalProducts,
            lowStockCount,
            totalValue: Math.round(totalValue),
            potentialRevenue: Math.round(potentialRevenue),
            potentialProfit: Math.round(potentialRevenue - totalValue),
          },
          stocksByCategory,
          detailedStocks: filteredStocks.map((stock) => ({
            ...stock,
            value: stock.quantity * stock.product.costPrice,
            isLowStock: stock.quantity <= stock.product.minStock,
          })),
        },
        message: 'Rapport de stock généré avec succès',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la génération du rapport',
      );
    }
  }

  /**
   * Rapport de mouvements de stock
   */
  async getStockMovementsReport(
    startDate?: Date,
    endDate?: Date,
    storeId?: string,
    productId?: string,
  ) {
    try {
      const where: any = {
        createdAt: {},
      };

      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
      if (storeId) where.storeId = storeId;
      if (productId) where.productId = productId;

      const movements = await this.prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
          store: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Grouper par type
      const movementsByType = {
        IN: movements.filter((m) => m.type === 'IN'),
        OUT: movements.filter((m) => m.type === 'OUT'),
        TRANSFER: movements.filter((m) => m.type === 'TRANSFER'),
        ADJUSTMENT: movements.filter((m) => m.type === 'ADJUSTMENT'),
      };

      const totalIn = movementsByType.IN.reduce(
        (sum, m) => sum + m.quantity,
        0,
      );
      const totalOut = movementsByType.OUT.reduce(
        (sum, m) => sum + m.quantity,
        0,
      );

      return {
        data: {
          period: {
            startDate,
            endDate,
          },
          summary: {
            totalMovements: movements.length,
            totalIn,
            totalOut,
            netMovement: totalIn - totalOut,
            byType: {
              IN: movementsByType.IN.length,
              OUT: movementsByType.OUT.length,
              TRANSFER: movementsByType.TRANSFER.length,
              ADJUSTMENT: movementsByType.ADJUSTMENT.length,
            },
          },
          movements,
        },
        message: 'Rapport de mouvements généré avec succès',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la génération du rapport',
      );
    }
  }

  /**
   * Rapport financier (Compte de résultat)
   */
  async getFinancialReport(
    startDate?: Date,
    endDate?: Date,
    storeId?: string,
  ) {
    try {
      const where: any = {
        createdAt: {},
      };

      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
      if (storeId) where.storeId = storeId;

      // Récupérer les ventes
      const sales = await this.prisma.sale.findMany({
        where: {
          ...where,
          status: 'COMPLETED',
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  costPrice: true,
                },
              },
            },
          },
        },
      });

      // Récupérer les dépenses
      const expensesWhere: any = { date: {} };
      if (startDate) expensesWhere.date.gte = startDate;
      if (endDate) expensesWhere.date.lte = endDate;
      if (storeId) expensesWhere.storeId = storeId;

      const expenses = await this.prisma.expense.findMany({
        where: expensesWhere,
        include: {
          store: {
            select: {
              name: true,
            },
          },
        },
      });

      // Récupérer les recettes
      const revenuesWhere: any = { date: {} };
      if (startDate) revenuesWhere.date.gte = startDate;
      if (endDate) revenuesWhere.date.lte = endDate;

      const revenues = await this.prisma.revenue.findMany({
        where: revenuesWhere,
      });

      // Calculs financiers
      let salesRevenue = 0;
      let costOfGoodsSold = 0;

      for (const sale of sales) {
        salesRevenue += sale.total;
        for (const item of sale.items) {
          costOfGoodsSold += item.product.costPrice * item.quantity;
        }
      }

      const grossProfit = salesRevenue - costOfGoodsSold;

      const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const otherRevenues = revenues.reduce((sum, rev) => sum + rev.amount, 0);

      const operatingProfit = grossProfit - totalExpenses;
      const netProfit = operatingProfit + otherRevenues;

      const grossMargin =
        salesRevenue > 0 ? (grossProfit / salesRevenue) * 100 : 0;
      const netMargin = salesRevenue > 0 ? (netProfit / salesRevenue) * 100 : 0;

      // Grouper les dépenses par catégorie
      const expensesByCategory = expenses.reduce(
        (acc, exp) => {
          if (!acc[exp.category]) {
            acc[exp.category] = { count: 0, total: 0 };
          }
          acc[exp.category].count++;
          acc[exp.category].total += exp.amount;
          return acc;
        },
        {} as Record<string, { count: number; total: number }>,
      );

      return {
        data: {
          period: {
            startDate,
            endDate,
          },
          incomeStatement: {
            salesRevenue: Math.round(salesRevenue),
            costOfGoodsSold: Math.round(costOfGoodsSold),
            grossProfit: Math.round(grossProfit),
            grossMargin: parseFloat(grossMargin.toFixed(2)),
            operatingExpenses: Math.round(totalExpenses),
            operatingProfit: Math.round(operatingProfit),
            otherRevenues: Math.round(otherRevenues),
            netProfit: Math.round(netProfit),
            netMargin: parseFloat(netMargin.toFixed(2)),
          },
          expensesByCategory,
          detailedExpenses: expenses,
          detailedRevenues: revenues,
        },
        message: 'Rapport financier généré avec succès',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la génération du rapport',
      );
    }
  }

  /**
   * Export Excel - Rapport de ventes
   */
  async exportSalesToExcel(
    startDate?: Date,
    endDate?: Date,
    storeId?: string,
  ): Promise<Buffer> {
    try {
      const report = await this.getSalesReport(startDate, endDate, storeId);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rapport de Ventes');

      // En-têtes
      worksheet.columns = [
        { header: 'Numéro', key: 'saleNumber', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Magasin', key: 'store', width: 20 },
        { header: 'Vendeur', key: 'user', width: 20 },
        { header: 'Sous-total', key: 'subtotal', width: 15 },
        { header: 'Remise', key: 'discount', width: 15 },
        { header: 'Taxe', key: 'tax', width: 15 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Paiement', key: 'payment', width: 15 },
        { header: 'Articles', key: 'items', width: 10 },
      ];

      // Style de l'en-tête
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };

      // Données
      report.data.detailedSales.forEach((sale) => {
        worksheet.addRow({
          saleNumber: sale.saleNumber,
          date: new Date(sale.createdAt).toLocaleDateString('fr-FR'),
          store: sale.store.name,
          user: sale.user.name,
          subtotal: sale.subtotal,
          discount: sale.discount,
          tax: sale.tax,
          total: sale.total,
          payment: sale.paymentMethod,
          items: sale.items.length,
        });
      });

      // Ligne de total
      worksheet.addRow({});
      const totalRow = worksheet.addRow({
        saleNumber: 'TOTAL',
        subtotal: report.data.summary.totalRevenue,
        discount: report.data.summary.totalDiscount,
        tax: report.data.summary.totalTax,
        total: report.data.summary.totalRevenue,
      });
      totalRow.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error("Erreur lors de l'export Excel:", error);
      throw new BadRequestException(
        "Une erreur est survenue lors de l'export",
      );
    }
  }

  /**
   * Export Excel - Rapport de stock
   */
  async exportStockToExcel(storeId?: string): Promise<Buffer> {
    try {
      const report = await this.getStockReport(storeId);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rapport de Stock');

      worksheet.columns = [
        { header: 'Produit', key: 'product', width: 30 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Catégorie', key: 'category', width: 20 },
        { header: 'Magasin', key: 'store', width: 20 },
        { header: 'Quantité', key: 'quantity', width: 12 },
        { header: 'Stock Min', key: 'minStock', width: 12 },
        { header: 'Unité', key: 'unit', width: 10 },
        { header: 'Prix Achat', key: 'costPrice', width: 15 },
        { header: 'Valeur', key: 'value', width: 15 },
        { header: 'Statut', key: 'status', width: 15 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' },
      };

      report.data.detailedStocks.forEach((stock) => {
        const row = worksheet.addRow({
          product: stock.product.name,
          sku: stock.product.sku,
          category: stock.product.category.name,
          store: stock.store.name,
          quantity: stock.quantity,
          minStock: stock.product.minStock,
          unit: stock.product.unit,
          costPrice: stock.product.costPrice,
          value: stock.value,
          status: stock.isLowStock ? 'Stock Faible' : 'OK',
        });

        if (stock.isLowStock) {
          row.getCell('status').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF0000' },
          };
          row.getCell('status').font = { color: { argb: 'FFFFFFFF' } };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      console.error("Erreur lors de l'export Excel:", error);
      throw new BadRequestException(
        "Une erreur est survenue lors de l'export",
      );
    }
  }

  /**
   * Grouper les ventes par période
   */
  private groupSalesByPeriod(
    sales: any[],
    groupBy: 'day' | 'week' | 'month',
  ): any[] {
    const grouped = new Map<string, any>();

    sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      let key: string;

      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekNumber = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${weekNumber}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          period: key,
          count: 0,
          total: 0,
          discount: 0,
          tax: 0,
        });
      }

      const group = grouped.get(key)!;
      group.count++;
      group.total += sale.total;
      group.discount += sale.discount;
      group.tax += sale.tax;
    });

    return Array.from(grouped.values());
  }

  /**
   * Grouper les stocks par catégorie
   */
  private groupStocksByCategory(stocks: any[]): any[] {
    const grouped = new Map<string, any>();

    stocks.forEach((stock) => {
      const categoryName = stock.product.category.name;

      if (!grouped.has(categoryName)) {
        grouped.set(categoryName, {
          category: categoryName,
          totalProducts: 0,
          totalQuantity: 0,
          totalValue: 0,
        });
      }

      const group = grouped.get(categoryName)!;
      group.totalProducts++;
      group.totalQuantity += stock.quantity;
      group.totalValue += stock.quantity * stock.product.costPrice;
    });

    return Array.from(grouped.values());
  }

  /**
   * Obtenir le numéro de semaine
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}