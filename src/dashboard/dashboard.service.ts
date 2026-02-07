import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Récupérer les statistiques complètes du dashboard
   */
  async getOverview(storeId?: string, startDate?: Date, endDate?: Date) {
    try {
      // Définir les dates par défaut (30 derniers jours)
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Requêtes parallèles pour optimiser les performances
      const [
        financialStats,
        salesStats,
        stockStats,
        topProducts,
        lowStockProducts,
        recentSales,
        salesByStore,
        salesByPaymentMethod,
        salesTrend,
      ] = await Promise.all([
        this.getFinancialStats(storeId, start, end),
        this.getSalesStats(storeId, start, end),
        this.getStockStats(storeId),
        this.getTopProducts(storeId, start, end, 10),
        this.getLowStockProducts(storeId, 10),
        this.getRecentSales(storeId, 10),
        this.getSalesByStore(start, end),
        this.getSalesByPaymentMethod(storeId, start, end),
        this.getSalesTrend(storeId, start, end),
      ]);

      return {
        data: {
          period: {
            startDate: start,
            endDate: end,
          },
          financial: financialStats,
          sales: salesStats,
          stock: stockStats,
          topProducts,
          lowStockProducts,
          recentSales,
          salesByStore,
          salesByPaymentMethod,
          salesTrend,
        },
        message: 'Dashboard chargé avec succès',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du dashboard:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du dashboard',
      );
    }
  }

  /**
   * Statistiques financières
   */
  private async getFinancialStats(
    storeId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      createdAt: {},
    };

    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
    if (storeId) where.storeId = storeId;

    // Récupérer toutes les ventes complétées
    const sales = await this.prisma.sale.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
      },
      select: {
        total: true,
        subtotal: true,
        discount: true,
        tax: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
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
    const expensesWhere: any = {
      date: {},
    };
    if (startDate) expensesWhere.date.gte = startDate;
    if (endDate) expensesWhere.date.lte = endDate;
    if (storeId) expensesWhere.storeId = storeId;

    const expenses = await this.prisma.expense.findMany({
      where: expensesWhere,
      select: {
        amount: true,
      },
    });

    // Récupérer les recettes (hors ventes)
    const revenuesWhere: any = {
      date: {},
    };
    if (startDate) revenuesWhere.date.gte = startDate;
    if (endDate) revenuesWhere.date.lte = endDate;

    const revenues = await this.prisma.revenue.findMany({
      where: revenuesWhere,
      select: {
        amount: true,
      },
    });

    // Calculs
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    for (const sale of sales) {
      totalRevenue += sale.total;

      // Calculer le coût réel
      for (const item of sale.items) {
        totalCost += item.product.costPrice * item.quantity;
      }
    }

    totalProfit = totalRevenue - totalCost;

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalOtherRevenues = revenues.reduce((sum, rev) => sum + rev.amount, 0);

    // Profit net (après dépenses et autres recettes)
    const netProfit = totalProfit - totalExpenses + totalOtherRevenues;

    // Marge bénéficiaire
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue: Math.round(totalRevenue),
      totalCost: Math.round(totalCost),
      grossProfit: Math.round(totalProfit),
      totalExpenses: Math.round(totalExpenses),
      totalOtherRevenues: Math.round(totalOtherRevenues),
      netProfit: Math.round(netProfit),
      profitMargin: parseFloat(profitMargin.toFixed(2)),
    };
  }

  /**
   * Statistiques des ventes
   */
  private async getSalesStats(
    storeId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      status: 'COMPLETED',
      createdAt: {},
    };

    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
    if (storeId) where.storeId = storeId;

    const [totalSales, todaySales] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.getTodaySalesCount(storeId),
    ]);

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        total: true,
        items: {
          select: {
            quantity: true,
          },
        },
      },
    });

    const totalAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalItems = sales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((s, item) => s + item.quantity, 0),
      0,
    );

    const averageSaleAmount = totalSales > 0 ? totalAmount / totalSales : 0;

    return {
      totalSales,
      todaySales,
      totalAmount: Math.round(totalAmount),
      totalItems,
      averageSaleAmount: Math.round(averageSaleAmount),
    };
  }

  /**
   * Nombre de ventes aujourd'hui
   */
  private async getTodaySalesCount(storeId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      status: 'COMPLETED',
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (storeId) where.storeId = storeId;

    return this.prisma.sale.count({ where });
  }

  /**
   * Statistiques des stocks
   */
  private async getStockStats(storeId?: string) {
    const where: any = {};
    if (storeId) where.storeId = storeId;

    const stocks = await this.prisma.stock.findMany({
      where,
      include: {
        product: {
          select: {
            minStock: true,
            costPrice: true,
            sellingPrice: true,
            isActive: true,
          },
        },
      },
    });

    let totalProducts = 0;
    let lowStockCount = 0;
    let totalStockValue = 0;
    let potentialRevenue = 0;

    for (const stock of stocks) {
      if (stock.product.isActive) {
        totalProducts++;

        if (stock.quantity <= stock.product.minStock) {
          lowStockCount++;
        }

        totalStockValue += stock.quantity * stock.product.costPrice;
        potentialRevenue += stock.quantity * stock.product.sellingPrice;
      }
    }

    return {
      totalProducts,
      lowStockCount,
      totalStockValue: Math.round(totalStockValue),
      potentialRevenue: Math.round(potentialRevenue),
      potentialProfit: Math.round(potentialRevenue - totalStockValue),
    };
  }

  /**
   * Top produits les plus vendus
   */
  private async getTopProducts(
    storeId?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 10,
  ) {
    const where: any = {
      sale: {
        status: 'COMPLETED',
        createdAt: {},
      },
    };

    if (startDate) where.sale.createdAt.gte = startDate;
    if (endDate) where.sale.createdAt.lte = endDate;
    if (storeId) where.sale.storeId = storeId;

    const topProducts = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where,
      _sum: {
        quantity: true,
        subtotal: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    // Enrichir avec les détails des produits
    const enrichedProducts = await Promise.all(
      topProducts.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return {
          product,
          quantitySold: item._sum.quantity || 0,
          totalRevenue: Math.round(item._sum.subtotal || 0),
          salesCount: item._count.id,
        };
      }),
    );

    return enrichedProducts;
  }

  /**
   * Produits en stock faible
   */
  private async getLowStockProducts(storeId?: string, limit = 10) {
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
            minStock: true,
            unit: true,
            isActive: true,
            category: {
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
    });

    // Filtrer et trier les produits en stock faible
    const lowStock = stocks
      .filter(
        (stock) =>
          stock.product.isActive && stock.quantity <= stock.product.minStock,
      )
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, limit)
      .map((stock) => ({
        product: stock.product,
        store: stock.store,
        currentStock: stock.quantity,
        minStock: stock.product.minStock,
        deficit: stock.product.minStock - stock.quantity,
      }));

    return lowStock;
  }

  /**
   * Ventes récentes
   */
  private async getRecentSales(storeId?: string, limit = 10) {
    const where: any = {
      status: 'COMPLETED',
    };

    if (storeId) where.storeId = storeId;

    const sales = await this.prisma.sale.findMany({
      where,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        saleNumber: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
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
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return sales;
  }

  /**
   * Ventes par magasin
   */
  private async getSalesByStore(startDate?: Date, endDate?: Date) {
    const where: any = {
      status: 'COMPLETED',
      createdAt: {},
    };

    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;

    const salesByStore = await this.prisma.sale.groupBy({
      by: ['storeId'],
      where,
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
    });

    // Enrichir avec les détails des magasins
    const enrichedStores = await Promise.all(
      salesByStore.map(async (item) => {
        const store = await this.prisma.store.findUnique({
          where: { id: item.storeId },
          select: {
            id: true,
            name: true,
            city: true,
          },
        });

        return {
          store,
          salesCount: item._count.id,
          totalRevenue: Math.round(item._sum.total || 0),
        };
      }),
    );

    return enrichedStores;
  }

  /**
   * Ventes par méthode de paiement
   */
  private async getSalesByPaymentMethod(
    storeId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      status: 'COMPLETED',
      createdAt: {},
    };

    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
    if (storeId) where.storeId = storeId;

    const salesByPaymentMethod = await this.prisma.sale.groupBy({
      by: ['paymentMethod'],
      where,
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
    });

    return salesByPaymentMethod.map((item) => ({
      paymentMethod: item.paymentMethod,
      count: item._count.id,
      total: Math.round(item._sum.total || 0),
    }));
  }

  /**
   * Tendance des ventes (par jour sur la période)
   */
  private async getSalesTrend(
    storeId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      status: 'COMPLETED',
      createdAt: {},
    };

    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
    if (storeId) where.storeId = storeId;

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        total: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Grouper par jour
    const salesByDay = new Map<string, { count: number; total: number }>();

    for (const sale of sales) {
      const dateKey = sale.createdAt.toISOString().split('T')[0];

      if (!salesByDay.has(dateKey)) {
        salesByDay.set(dateKey, { count: 0, total: 0 });
      }

      const dayData = salesByDay.get(dateKey)!;
      dayData.count++;
      dayData.total += sale.total;
    }

    // Convertir en tableau
    const trend = Array.from(salesByDay.entries()).map(([date, data]) => ({
      date,
      salesCount: data.count,
      totalAmount: Math.round(data.total),
    }));

    return trend;
  }

  /**
   * Statistiques de performance (comparaison avec période précédente)
   */
  async getPerformanceComparison(
    storeId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    try {
      const end = endDate || new Date();
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Calculer la période précédente (même durée)
      const duration = end.getTime() - start.getTime();
      const previousStart = new Date(start.getTime() - duration);
      const previousEnd = new Date(start.getTime());

      // Statistiques période actuelle
      const [currentFinancial, currentSales] = await Promise.all([
        this.getFinancialStats(storeId, start, end),
        this.getSalesStats(storeId, start, end),
      ]);

      // Statistiques période précédente
      const [previousFinancial, previousSales] = await Promise.all([
        this.getFinancialStats(storeId, previousStart, previousEnd),
        this.getSalesStats(storeId, previousStart, previousEnd),
      ]);

      // Calculer les variations en pourcentage
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return parseFloat((((current - previous) / previous) * 100).toFixed(2));
      };

      return {
        data: {
          current: {
            period: { startDate: start, endDate: end },
            financial: currentFinancial,
            sales: currentSales,
          },
          previous: {
            period: { startDate: previousStart, endDate: previousEnd },
            financial: previousFinancial,
            sales: previousSales,
          },
          changes: {
            revenue: calculateChange(
              currentFinancial.totalRevenue,
              previousFinancial.totalRevenue,
            ),
            netProfit: calculateChange(
              currentFinancial.netProfit,
              previousFinancial.netProfit,
            ),
            sales: calculateChange(
              currentSales.totalSales,
              previousSales.totalSales,
            ),
            averageSale: calculateChange(
              currentSales.averageSaleAmount,
              previousSales.averageSaleAmount,
            ),
          },
        },
        message: 'Comparaison de performance récupérée',
        success: true,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la comparaison de performance:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la comparaison de performance',
      );
    }
  }

  /**
   * Tableau de bord des caisses
   */
  async getCashRegisterDashboard(storeId?: string) {
    try {
      const where: any = {};
      if (storeId) where.storeId = storeId;

      const [openRegisters, todayRegisters] = await Promise.all([
        // Caisses ouvertes
        this.prisma.cashRegister.findMany({
          where: {
            ...where,
            status: 'OPEN',
          },
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
            sales: {
              where: {
                status: 'COMPLETED',
              },
              select: {
                total: true,
                paymentMethod: true,
              },
            },
          },
        }),

        // Caisses fermées aujourd'hui
        this.prisma.cashRegister.findMany({
          where: {
            ...where,
            status: 'CLOSED',
            closedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
          select: {
            id: true,
            openingAmount: true,
            closingAmount: true,
            difference: true,
            openedAt: true,
            closedAt: true,
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
        }),
      ]);

      // Enrichir les caisses ouvertes avec les statistiques
      const enrichedOpenRegisters = openRegisters.map((register) => {
        const totalSales = register.sales.reduce(
          (sum, sale) => sum + sale.total,
          0,
        );
        const cashSales = register.sales
          .filter((sale) => sale.paymentMethod === 'CASH')
          .reduce((sum, sale) => sum + sale.total, 0);

        const expectedAmount = register.openingAmount + cashSales;

        return {
          id: register.id,
          store: register.store,
          user: register.user,
          openingAmount: register.openingAmount,
          openedAt: register.openedAt,
          currentSalesCount: register.sales.length,
          currentRevenue: Math.round(totalSales),
          expectedCash: Math.round(expectedAmount),
        };
      });

      return {
        data: {
          openRegisters: enrichedOpenRegisters,
          closedTodayRegisters: todayRegisters,
        },
        message: 'Dashboard des caisses récupéré',
        success: true,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération du dashboard des caisses:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du dashboard des caisses',
      );
    }
  }
}