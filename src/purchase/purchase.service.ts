import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer un nouvel achat
   * - Vérifie le fournisseur et le magasin
   * - Crée l'achat avec ses articles
   * - Met à jour automatiquement le stock du magasin
   * - Crée un mouvement de stock pour chaque article
   */
  async create(createPurchaseDto: CreatePurchaseDto, userId: string) {
    try {
      const { supplierId, storeId, items, invoiceNumber, notes, purchaseDate } =
        createPurchaseDto;

      // Vérifier le fournisseur
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${supplierId}" non trouvé`,
        );
      }

      if (!supplier.isActive) {
        throw new BadRequestException(
          `Le fournisseur "${supplier.name}" est désactivé`,
        );
      }

      // Vérifier le magasin
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

      // Vérifier que tous les produits existent
      const productIds = items.map((item) => item.productId);
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        throw new BadRequestException(
          'Un ou plusieurs produits sont introuvables',
        );
      }

      // Calculer le montant total
      const totalAmount = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      // Générer un numéro d'achat unique
      const purchaseNumber = await this.generatePurchaseNumber();

      // Créer l'achat dans une transaction
      const purchase = await this.prisma.$transaction(async (tx) => {
        // 1. Créer l'achat
        const newPurchase = await tx.purchase.create({
          data: {
            purchaseNumber,
            supplierId,
            storeId,
            userId,
            totalAmount,
            invoiceNumber: invoiceNumber || null,
            notes: notes || null,
            purchaseDate: purchaseDate || new Date(),
          },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
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
        });

        // 2. Créer les articles d'achat
        for (const item of items) {
          const subtotal = item.quantity * item.unitPrice;

          await tx.purchaseItem.create({
            data: {
              purchaseId: newPurchase.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal,
            },
          });

          // 3. Mettre à jour le stock
          const existingStock = await tx.stock.findUnique({
            where: {
              productId_storeId: {
                productId: item.productId,
                storeId,
              },
            },
          });

          if (existingStock) {
            // Stock existe : augmenter la quantité
            await tx.stock.update({
              where: { id: existingStock.id },
              data: {
                quantity: {
                  increment: item.quantity,
                },
              },
            });
          } else {
            // Stock n'existe pas : le créer
            await tx.stock.create({
              data: {
                productId: item.productId,
                storeId,
                quantity: item.quantity,
              },
            });
          }

          // 4. Créer un mouvement de stock
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              storeId,
              userId,
              type: 'IN',
              quantity: item.quantity,
              reference: `Achat ${purchaseNumber}`,
              notes: `Achat chez ${supplier.name}`,
            },
          });
        }

        return newPurchase;
      });

      // Récupérer l'achat complet avec les articles
      const completePurchase = await this.prisma.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          supplier: true,
          store: true,
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

      return {
        data: completePurchase,
        message: 'Achat créé avec succès. Stocks mis à jour automatiquement.',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error("Erreur lors de la création de l'achat:", error);
      throw new BadRequestException(
        error.message || "Une erreur est survenue lors de la création de l'achat",
      );
    }
  }

  /**
   * Générer un numéro d'achat unique
   */
  private async generatePurchaseNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    const count = await this.prisma.purchase.count({
      where: {
        createdAt: {
          gte: new Date(year, today.getMonth(), 1),
          lt: new Date(year, today.getMonth() + 1, 1),
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `ACH-${year}${month}-${sequence}`;
  }

  /**
   * Récupérer tous les achats avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    storeId?: string,
    supplierId?: string,
    startDate?: Date,
    endDate?: Date,
    search?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      const where: any = {};

      if (storeId) where.storeId = storeId;
      if (supplierId) where.supplierId = supplierId;

      if (search) {
        where.OR = [
          { purchaseNumber: { contains: search, mode: 'insensitive' } },
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (startDate || endDate) {
        where.purchaseDate = {};
        if (startDate) where.purchaseDate.gte = startDate;
        if (endDate) where.purchaseDate.lte = endDate;
      }

      const [purchases, total] = await Promise.all([
        this.prisma.purchase.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
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
        }),
        this.prisma.purchase.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          purchases,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${purchases.length} achat(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des achats:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des achats',
      );
    }
  }

  /**
   * Récupérer un achat par ID
   */
  async findOne(id: string) {
    try {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id },
        include: {
          supplier: true,
          store: true,
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
                  barcode: true,
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

      if (!purchase) {
        throw new NotFoundException(`Achat avec l'ID "${id}" non trouvé`);
      }

      return {
        data: purchase,
        message: 'Achat trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error("Erreur lors de la récupération de l'achat:", error);
      throw new BadRequestException(
        "Une erreur est survenue lors de la récupération de l'achat",
      );
    }
  }

  /**
   * Mettre à jour un achat
   * ⚠️ Attention : ne modifie pas les stocks (pour éviter les incohérences)
   */
  async update(id: string, updatePurchaseDto: UpdatePurchaseDto) {
    try {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id },
      });

      if (!purchase) {
        throw new NotFoundException(`Achat avec l'ID "${id}" non trouvé`);
      }

      const updatedPurchase = await this.prisma.purchase.update({
        where: { id },
        data: {
          invoiceNumber: updatePurchaseDto.invoiceNumber,
          notes: updatePurchaseDto.notes,
          purchaseDate: updatePurchaseDto.purchaseDate,
        },
        include: {
          supplier: true,
          store: true,
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return {
        data: updatedPurchase,
        message: 'Achat mis à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error("Erreur lors de la mise à jour de l'achat:", error);
      throw new BadRequestException(
        "Une erreur est survenue lors de la mise à jour de l'achat",
      );
    }
  }

  /**
   * Supprimer un achat (Admin uniquement)
   * ⚠️ Supprime également les mouvements de stock associés
   */
  async remove(id: string) {
    try {
      const purchase = await this.prisma.purchase.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!purchase) {
        throw new NotFoundException(`Achat avec l'ID "${id}" non trouvé`);
      }

      // Supprimer dans une transaction
      await this.prisma.$transaction(async (tx) => {
        // Supprimer les mouvements de stock liés
        await tx.stockMovement.deleteMany({
          where: {
            reference: `Achat ${purchase.purchaseNumber}`,
          },
        });

        // Supprimer les articles d'achat
        await tx.purchaseItem.deleteMany({
          where: { purchaseId: id },
        });

        // Supprimer l'achat
        await tx.purchase.delete({
          where: { id },
        });
      });

      return {
        data: { id },
        message: 'Achat supprimé avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error("Erreur lors de la suppression de l'achat:", error);
      throw new BadRequestException(
        "Une erreur est survenue lors de la suppression de l'achat",
      );
    }
  }

  /**
   * Statistiques des achats
   */
  async getStats(storeId?: string, startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};

      if (storeId) where.storeId = storeId;

      if (startDate || endDate) {
        where.purchaseDate = {};
        if (startDate) where.purchaseDate.gte = startDate;
        if (endDate) where.purchaseDate.lte = endDate;
      }

      const [totalPurchases, purchases, purchasesBySupplier] =
        await Promise.all([
          this.prisma.purchase.count({ where }),
          this.prisma.purchase.findMany({
            where,
            select: { totalAmount: true },
          }),
          this.prisma.purchase.groupBy({
            by: ['supplierId'],
            where,
            _count: true,
            _sum: { totalAmount: true },
          }),
        ]);

      const totalAmount = purchases.reduce(
        (sum, p) => sum + p.totalAmount,
        0,
      );
      const averageAmount =
        totalPurchases > 0 ? totalAmount / totalPurchases : 0;

      return {
        data: {
          totalPurchases,
          totalAmount: Math.round(totalAmount),
          averageAmount: Math.round(averageAmount),
          purchasesBySupplier,
        },
        message: 'Statistiques des achats récupérées',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des statistiques',
      );
    }
  }
}