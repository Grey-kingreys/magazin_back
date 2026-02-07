import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto, SaleStatus } from './dto/update-sale.dto';

// Type pour les items validés
interface ValidatedItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stockId: string;
  productName: string;
}

@Injectable()
export class SaleService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Générer un numéro de vente unique
   */
  private async generateSaleNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Compter les ventes du mois en cours
    const count = await this.prisma.sale.count({
      where: {
        createdAt: {
          gte: new Date(year, now.getMonth(), 1),
          lt: new Date(year, now.getMonth() + 1, 1),
        },
      },
    });

    const sequence = String(count + 1).padStart(5, '0');
    return `VNT-${year}${month}-${sequence}`;
  }

  /**
   * Créer une nouvelle vente
   */
  async create(createSaleDto: CreateSaleDto, userId: string) {
    try {
      const {
        storeId,
        cashRegisterId,
        items,
        discount = 0,
        tax = 0,
        paymentMethod,
        amountPaid,
        notes,
      } = createSaleDto;

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

      // Vérifier la caisse si fournie
      if (cashRegisterId) {
        const cashRegister = await this.prisma.cashRegister.findUnique({
          where: { id: cashRegisterId },
        });

        if (!cashRegister) {
          throw new NotFoundException(
            `Caisse avec l'ID "${cashRegisterId}" non trouvée`,
          );
        }

        if (cashRegister.status !== 'OPEN') {
          throw new BadRequestException(
            'La caisse doit être ouverte pour effectuer une vente',
          );
        }

        if (cashRegister.storeId !== storeId) {
          throw new BadRequestException(
            'La caisse ne correspond pas au magasin',
          );
        }
      }

      // Valider et préparer les articles avec le type explicite
      const validatedItems: ValidatedItem[] = [];
      let subtotal = 0;

      for (const item of items) {
        // Vérifier que le produit existe
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            stocks: {
              where: {
                storeId,
              },
            },
          },
        });

        if (!product) {
          throw new NotFoundException(
            `Produit avec l'ID "${item.productId}" non trouvé`,
          );
        }

        if (!product.isActive) {
          throw new BadRequestException(
            `Le produit "${product.name}" est désactivé`,
          );
        }

        // Vérifier le stock disponible
        const stock = product.stocks[0];
        if (!stock) {
          throw new BadRequestException(
            `Le produit "${product.name}" n'est pas disponible dans ce magasin`,
          );
        }

        if (stock.quantity < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour "${product.name}". Disponible: ${stock.quantity}, Demandé: ${item.quantity}`,
          );
        }

        // Calculer le sous-total de l'article
        const itemSubtotal = item.unitPrice * item.quantity;
        subtotal += itemSubtotal;

        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: itemSubtotal,
          stockId: stock.id,
          productName: product.name,
        });
      }

      // Calculer le total
      const total = subtotal - discount + tax;

      // Vérifier que le montant payé est suffisant
      if (amountPaid < total) {
        throw new BadRequestException(
          `Montant payé insuffisant. Total: ${total} GNF, Payé: ${amountPaid} GNF`,
        );
      }

      // Calculer la monnaie
      const change = amountPaid - total;

      // Générer le numéro de vente
      const saleNumber = await this.generateSaleNumber();

      // Créer la vente dans une transaction
      const sale = await this.prisma.$transaction(async (tx) => {
        // Créer la vente
        const newSale = await tx.sale.create({
          data: {
            saleNumber,
            storeId,
            userId,
            cashRegisterId: cashRegisterId || null,
            subtotal,
            discount,
            tax,
            total,
            paymentMethod,
            amountPaid,
            change,
            status: 'COMPLETED',
            notes: notes || null,
            items: {
              create: validatedItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    unit: true,
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
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            cashRegister: {
              select: {
                id: true,
                openingAmount: true,
              },
            },
          },
        });

        // Mettre à jour les stocks
        for (const item of validatedItems) {
          await tx.stock.update({
            where: {
              id: item.stockId,
            },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          });

          // Créer un mouvement de stock
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              storeId,
              userId,
              type: 'OUT',
              quantity: item.quantity,
              reference: saleNumber,
              notes: `Vente: ${item.productName}`,
            },
          });
        }

        return newSale;
      });

      return {
        data: sale,
        message: `Vente ${saleNumber} créée avec succès`,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la création de la vente:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la création de la vente',
      );
    }
  }

  /**
   * Récupérer toutes les ventes avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    storeId?: string,
    status?: SaleStatus,
    startDate?: Date,
    endDate?: Date,
    search?: string,
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

      if (search) {
        where.saleNumber = {
          contains: search,
          mode: 'insensitive',
        };
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [sales, total] = await Promise.all([
        this.prisma.sale.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
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
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
            _count: {
              select: {
                items: true,
              },
            },
          },
        }),
        this.prisma.sale.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          sales,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${sales.length} vente(s) trouvée(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des ventes:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des ventes',
      );
    }
  }

  /**
   * Récupérer une vente par ID
   */
  async findOne(id: string) {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              phone: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          cashRegister: {
            select: {
              id: true,
              openingAmount: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  unit: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!sale) {
        throw new NotFoundException(`Vente avec l'ID "${id}" non trouvée`);
      }

      return {
        data: sale,
        message: 'Vente trouvée',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération de la vente:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération de la vente',
      );
    }
  }

  /**
   * Rechercher une vente par numéro
   */
  async findBySaleNumber(saleNumber: string) {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { saleNumber },
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
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      if (!sale) {
        throw new NotFoundException(
          `Vente avec le numéro "${saleNumber}" non trouvée`,
        );
      }

      return {
        data: sale,
        message: 'Vente trouvée',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la recherche de la vente:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la recherche de la vente',
      );
    }
  }

  /**
   * Mettre à jour le statut d'une vente
   */
  async updateStatus(id: string, status: SaleStatus, userId: string) {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!sale) {
        throw new NotFoundException(`Vente avec l'ID "${id}" non trouvée`);
      }

      // Vérifier les transitions de statut autorisées
      if (sale.status === 'REFUNDED') {
        throw new BadRequestException(
          'Impossible de modifier une vente déjà remboursée',
        );
      }

      if (status === 'CANCELLED' && sale.status !== 'PENDING') {
        throw new BadRequestException(
          'Seules les ventes en attente peuvent être annulées',
        );
      }

      // Si on rembourse ou annule, restaurer le stock
      if (status === 'REFUNDED' || status === 'CANCELLED') {
        await this.prisma.$transaction(async (tx) => {
          // Mettre à jour le statut
          await tx.sale.update({
            where: { id },
            data: { status },
          });

          // Restaurer les stocks
          for (const item of sale.items) {
            await tx.stock.updateMany({
              where: {
                productId: item.productId,
                storeId: sale.storeId,
              },
              data: {
                quantity: {
                  increment: item.quantity,
                },
              },
            });

            // Créer un mouvement de stock de retour
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                storeId: sale.storeId,
                userId,
                type: 'IN',
                quantity: item.quantity,
                reference: sale.saleNumber,
                notes: `${status === 'REFUNDED' ? 'Remboursement' : 'Annulation'} de vente`,
              },
            });
          }
        });
      } else {
        await this.prisma.sale.update({
          where: { id },
          data: { status },
        });
      }

      const updatedSale = await this.findOne(id);

      return {
        data: updatedSale.data,
        message: `Statut de la vente mis à jour vers ${status}`,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour du statut:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la mise à jour du statut',
      );
    }
  }

  /**
   * Supprimer une vente (soft delete en changeant le statut)
   */
  async remove(id: string, userId: string) {
    try {
      const sale = await this.prisma.sale.findUnique({
        where: { id },
      });

      if (!sale) {
        throw new NotFoundException(`Vente avec l'ID "${id}" non trouvée`);
      }

      if (sale.status === 'COMPLETED') {
        throw new BadRequestException(
          'Impossible de supprimer une vente complétée. Annulez-la d\'abord.',
        );
      }

      // Annuler la vente au lieu de la supprimer
      return this.updateStatus(id, SaleStatus.CANCELLED, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression de la vente:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la suppression de la vente',
      );
    }
  }

  /**
   * Récupérer les statistiques des ventes
   */
  async getStats(storeId?: string, startDate?: Date, endDate?: Date) {
    try {
      const where: any = {
        status: 'COMPLETED',
      };

      if (storeId) {
        where.storeId = storeId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [totalSales, sales, salesByStore, salesByPaymentMethod] =
        await Promise.all([
          // Nombre total de ventes
          this.prisma.sale.count({ where }),

          // Récupérer toutes les ventes pour calculs
          this.prisma.sale.findMany({
            where,
            select: {
              total: true,
              subtotal: true,
              discount: true,
              tax: true,
              paymentMethod: true,
              items: {
                select: {
                  quantity: true,
                  product: {
                    select: {
                      costPrice: true,
                    },
                  },
                },
              },
            },
          }),

          // Ventes par magasin
          this.prisma.store.findMany({
            where: storeId ? { id: storeId } : {},
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  sales: {
                    where: {
                      status: 'COMPLETED',
                      createdAt: where.createdAt,
                    },
                  },
                },
              },
            },
            orderBy: {
              name: 'asc',
            },
          }),

          // Ventes par méthode de paiement
          this.prisma.sale.groupBy({
            by: ['paymentMethod'],
            where,
            _count: true,
            _sum: {
              total: true,
            },
          }),
        ]);

      // Calculer le revenu total et la marge
      let totalRevenue = 0;
      let totalProfit = 0;
      let totalItemsSold = 0;

      for (const sale of sales) {
        totalRevenue += sale.total;
        totalItemsSold += sale.items.reduce((sum, item) => sum + item.quantity, 0);

        // Calculer le profit (prix de vente - coût d'achat)
        for (const item of sale.items) {
          const itemProfit = (sale.subtotal / sale.items.length) - (item.product.costPrice * item.quantity);
          totalProfit += itemProfit;
        }
      }

      const averageSaleAmount = totalSales > 0 ? totalRevenue / totalSales : 0;

      return {
        data: {
          totalSales,
          totalRevenue: Math.round(totalRevenue),
          totalProfit: Math.round(totalProfit),
          totalItemsSold,
          averageSaleAmount: Math.round(averageSaleAmount),
          salesByStore,
          salesByPaymentMethod,
        },
        message: 'Statistiques des ventes récupérées',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des statistiques',
      );
    }
  }

  /**
   * Récupérer les ventes d'aujourd'hui
   */
  async getTodaySales(storeId?: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return this.findAll(1, 100, storeId, undefined, today, tomorrow);
    } catch (error) {
      console.error('Erreur lors de la récupération des ventes du jour:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des ventes du jour',
      );
    }
  }
}