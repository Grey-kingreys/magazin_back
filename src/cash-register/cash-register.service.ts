import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Ouvrir une nouvelle caisse
   */
  async open(openCashRegisterDto: OpenCashRegisterDto, userId: string) {
    try {
      const { storeId, openingAmount, notes } = openCashRegisterDto;

      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${storeId}" non trouvé`,
        );
      }

      if (!store.isActive) {
        throw new BadRequestException(
          `Le magasin "${store.name}" est désactivé`,
        );
      }

      // Vérifier qu'il n'y a pas déjà une caisse ouverte pour ce magasin
      const existingOpenCashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          storeId,
          status: 'OPEN',
        },
      });

      if (existingOpenCashRegister) {
        throw new ConflictException(
          `Une caisse est déjà ouverte pour le magasin "${store.name}". Fermez-la avant d'en ouvrir une nouvelle.`,
        );
      }

      // Vérifier qu'il n'y a pas déjà une caisse ouverte pour cet utilisateur
      const userOpenCashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          userId,
          status: 'OPEN',
        },
        include: {
          store: {
            select: {
              name: true,
            },
          },
        },
      });

      if (userOpenCashRegister) {
        throw new ConflictException(
          `Vous avez déjà une caisse ouverte au magasin "${userOpenCashRegister.store.name}". Fermez-la avant d'en ouvrir une nouvelle.`,
        );
      }

      // Créer la nouvelle caisse
      const cashRegister = await this.prisma.cashRegister.create({
        data: {
          storeId,
          userId,
          openingAmount,
          status: 'OPEN',
          notes: notes || null,
          openedAt: new Date(),
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
              email: true,
            },
          },
        },
      });

      return {
        data: cashRegister,
        message: `Caisse ouverte avec succès au magasin "${store.name}"`,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error("Erreur lors de l'ouverture de la caisse:", error);
      throw new BadRequestException(
        error.message || "Une erreur est survenue lors de l'ouverture de la caisse",
      );
    }
  }

  /**
   * Fermer une caisse
   */
  async close(id: string, closeCashRegisterDto: CloseCashRegisterDto) {
    try {
      const { closingAmount, notes } = closeCashRegisterDto;

      // Récupérer la caisse
      const cashRegister = await this.prisma.cashRegister.findUnique({
        where: { id },
        include: {
          store: {
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
      });

      if (!cashRegister) {
        throw new NotFoundException(
          `Caisse avec l'ID "${id}" non trouvée`,
        );
      }

      if (cashRegister.status === 'CLOSED') {
        throw new BadRequestException('Cette caisse est déjà fermée');
      }

      // Calculer le montant théorique (ouverture + ventes en espèces)
      const cashSalesTotal = cashRegister.sales
        .filter((sale) => sale.paymentMethod === 'CASH')
        .reduce((sum, sale) => sum + sale.total, 0);

      const expectedAmount = cashRegister.openingAmount + cashSalesTotal;

      // Calculer la différence
      const difference = closingAmount - expectedAmount;

      // Fermer la caisse
      const closedCashRegister = await this.prisma.cashRegister.update({
        where: { id },
        data: {
          closingAmount,
          expectedAmount,
          difference,
          status: 'CLOSED',
          closedAt: new Date(),
          notes: notes
            ? `${cashRegister.notes || ''}\n\nFermeture: ${notes}`.trim()
            : cashRegister.notes,
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
              email: true,
            },
          },
          _count: {
            select: {
              sales: true,
            },
          },
        },
      });

      // Message d'avertissement si différence
      let message = `Caisse fermée avec succès au magasin "${cashRegister.store.name}"`;
      if (difference !== 0) {
        const diffType = difference > 0 ? 'excédent' : 'manque';
        const diffAmount = Math.abs(difference);
        message += `. ${diffType.charAt(0).toUpperCase() + diffType.slice(1)} de ${diffAmount} GNF détecté.`;

        console.warn(
          `⚠️ Différence de caisse détectée: ${difference > 0 ? '+' : ''}${difference} GNF`,
        );
      }

      return {
        data: {
          ...closedCashRegister,
          stats: {
            totalSales: cashSalesTotal,
            salesCount: cashRegister.sales.length,
          },
        },
        message,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la fermeture de la caisse:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la fermeture de la caisse',
      );
    }
  }

  /**
   * Récupérer toutes les caisses avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    storeId?: string,
    status?: 'OPEN' | 'CLOSED',
    startDate?: Date,
    endDate?: Date,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Construction de la clause where
      const where: any = {};

      if (storeId) {
        where.storeId = storeId;
      }

      if (status) {
        where.status = status;
      }

      if (startDate || endDate) {
        where.openedAt = {};
        if (startDate) {
          where.openedAt.gte = startDate;
        }
        if (endDate) {
          where.openedAt.lte = endDate;
        }
      }

      const [cashRegisters, total] = await Promise.all([
        this.prisma.cashRegister.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            openedAt: 'desc',
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
                email: true,
              },
            },
            _count: {
              select: {
                sales: true,
              },
            },
          },
        }),
        this.prisma.cashRegister.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          cashRegisters,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${cashRegisters.length} caisse(s) trouvée(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des caisses:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des caisses',
      );
    }
  }

  /**
   * Récupérer une caisse par ID
   */
  async findOne(id: string) {
    try {
      const cashRegister = await this.prisma.cashRegister.findUnique({
        where: { id },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          sales: {
            select: {
              id: true,
              saleNumber: true,
              total: true,
              paymentMethod: true,
              status: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!cashRegister) {
        throw new NotFoundException(
          `Caisse avec l'ID "${id}" non trouvée`,
        );
      }

      // Calculer les statistiques
      const completedSales = cashRegister.sales.filter(
        (sale) => sale.status === 'COMPLETED',
      );

      const totalRevenue = completedSales.reduce(
        (sum, sale) => sum + sale.total,
        0,
      );

      const salesByPaymentMethod = completedSales.reduce(
        (acc, sale) => {
          if (!acc[sale.paymentMethod]) {
            acc[sale.paymentMethod] = { count: 0, total: 0 };
          }
          acc[sale.paymentMethod].count++;
          acc[sale.paymentMethod].total += sale.total;
          return acc;
        },
        {} as Record<string, { count: number; total: number }>,
      );

      return {
        data: {
          ...cashRegister,
          stats: {
            totalSales: totalRevenue,
            salesCount: completedSales.length,
            salesByPaymentMethod,
          },
        },
        message: 'Caisse trouvée',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération de la caisse:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération de la caisse',
      );
    }
  }

  /**
   * Récupérer la caisse ouverte d'un utilisateur
   */
  async findOpenByUser(userId: string) {
    try {
      const cashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          userId,
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
              email: true,
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
      });

      if (!cashRegister) {
        return {
          data: null,
          message: 'Aucune caisse ouverte trouvée pour cet utilisateur',
          success: true,
        };
      }

      // Calculer les statistiques en temps réel
      const totalRevenue = cashRegister.sales.reduce(
        (sum, sale) => sum + sale.total,
        0,
      );

      const cashSalesTotal = cashRegister.sales
        .filter((sale) => sale.paymentMethod === 'CASH')
        .reduce((sum, sale) => sum + sale.total, 0);

      return {
        data: {
          ...cashRegister,
          stats: {
            totalRevenue,
            salesCount: cashRegister.sales.length,
            expectedAmount: cashRegister.openingAmount + cashSalesTotal,
          },
        },
        message: 'Caisse ouverte trouvée',
        success: true,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la caisse ouverte de l'utilisateur:",
        error,
      );
      throw new BadRequestException(
        "Une erreur est survenue lors de la récupération de la caisse ouverte",
      );
    }
  }

  /**
   * Récupérer les statistiques des caisses
   */
  async getStats(storeId?: string, startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};

      if (storeId) {
        where.storeId = storeId;
      }

      if (startDate || endDate) {
        where.openedAt = {};
        if (startDate) {
          where.openedAt.gte = startDate;
        }
        if (endDate) {
          where.openedAt.lte = endDate;
        }
      }

      const [totalCashRegisters, openCashRegisters, closedCashRegisters, allCashRegisters] =
        await Promise.all([
          // Total de caisses
          this.prisma.cashRegister.count({ where }),

          // Caisses ouvertes
          this.prisma.cashRegister.count({
            where: {
              ...where,
              status: 'OPEN',
            },
          }),

          // Caisses fermées
          this.prisma.cashRegister.count({
            where: {
              ...where,
              status: 'CLOSED',
            },
          }),

          // Toutes les caisses fermées pour calculs
          this.prisma.cashRegister.findMany({
            where: {
              ...where,
              status: 'CLOSED',
            },
            select: {
              difference: true,
              sales: {
                where: {
                  status: 'COMPLETED',
                },
                select: {
                  total: true,
                },
              },
            },
          }),
        ]);

      // Calculer les différences totales
      let totalDifference = 0;
      let totalRevenue = 0;
      let positiveDiscrepancies = 0;
      let negativeDiscrepancies = 0;

      for (const cashRegister of allCashRegisters) {
        if (cashRegister.difference) {
          totalDifference += cashRegister.difference;
          if (cashRegister.difference > 0) {
            positiveDiscrepancies++;
          } else if (cashRegister.difference < 0) {
            negativeDiscrepancies++;
          }
        }

        totalRevenue += cashRegister.sales.reduce(
          (sum, sale) => sum + sale.total,
          0,
        );
      }

      return {
        data: {
          totalCashRegisters,
          openCashRegisters,
          closedCashRegisters,
          totalRevenue: Math.round(totalRevenue),
          totalDifference: Math.round(totalDifference),
          positiveDiscrepancies,
          negativeDiscrepancies,
          perfectMatches: closedCashRegisters - positiveDiscrepancies - negativeDiscrepancies,
        },
        message: 'Statistiques des caisses récupérées',
        success: true,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des statistiques des caisses:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des statistiques',
      );
    }
  }

  /**
   * Supprimer une caisse (seulement si elle n'a aucune vente)
   */
  async remove(id: string) {
    try {
      const cashRegister = await this.prisma.cashRegister.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              sales: true,
            },
          },
        },
      });

      if (!cashRegister) {
        throw new NotFoundException(
          `Caisse avec l'ID "${id}" non trouvée`,
        );
      }

      if (cashRegister._count.sales > 0) {
        throw new ConflictException(
          `Impossible de supprimer une caisse avec ${cashRegister._count.sales} vente(s) associée(s)`,
        );
      }

      await this.prisma.cashRegister.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Caisse supprimée avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression de la caisse:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la suppression de la caisse',
      );
    }
  }
}