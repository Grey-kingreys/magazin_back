import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockMovementService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer un nouveau mouvement de stock
   * Gère automatiquement la mise à jour des stocks
   */
  async create(createStockMovementDto: CreateStockMovementDto) {
    try {
      const {
        productId,
        storeId,
        userId,
        type,
        quantity,
        reference,
        notes,
        fromStoreId,
        toStoreId,
      } = createStockMovementDto;

      // Vérifier que le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec l'ID "${productId}" non trouvé`,
        );
      }

      if (!product.isActive) {
        throw new BadRequestException(
          `Le produit "${product.name}" est désactivé`,
        );
      }

      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
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

      // Vérifier que l'utilisateur existe
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!user) {
        throw new NotFoundException(
          `Utilisateur avec l'ID "${userId}" non trouvé`,
        );
      }

      if (!user.isActive) {
        throw new BadRequestException(
          `L'utilisateur "${user.name}" est désactivé`,
        );
      }

      // Logique spécifique selon le type de mouvement
      let movement;

      switch (type) {
        case 'IN':
          movement = await this.handleStockIn(
            productId,
            storeId,
            userId,
            quantity,
            reference,
            notes,
          );
          break;

        case 'OUT':
          movement = await this.handleStockOut(
            productId,
            storeId,
            userId,
            quantity,
            reference,
            notes,
          );
          break;

        case 'TRANSFER':
          if (!fromStoreId || !toStoreId) {
            throw new BadRequestException(
              'Les magasins source et destination sont obligatoires pour un transfert',
            );
          }
          movement = await this.handleStockTransfer(
            productId,
            fromStoreId,
            toStoreId,
            userId,
            quantity,
            reference,
            notes,
          );
          break;

        case 'ADJUSTMENT':
          movement = await this.handleStockAdjustment(
            productId,
            storeId,
            userId,
            quantity,
            reference,
            notes,
          );
          break;

        default:
          throw new BadRequestException('Type de mouvement invalide');
      }

      return {
        data: movement,
        message: 'Mouvement de stock enregistré avec succès',
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

      console.error('Erreur lors de la création du mouvement:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la création du mouvement de stock',
      );
    }
  }

  /**
   * Gérer une entrée de stock
   */
  private async handleStockIn(
    productId: string,
    storeId: string,
    userId: string,
    quantity: number,
    reference?: string,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Vérifier si le stock existe
      let stock = await tx.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId,
          },
        },
      });

      // Si le stock n'existe pas, le créer
      if (!stock) {
        stock = await tx.stock.create({
          data: {
            productId,
            storeId,
            quantity,
          },
        });
      } else {
        // Sinon, augmenter la quantité
        stock = await tx.stock.update({
          where: { id: stock.id },
          data: {
            quantity: {
              increment: quantity,
            },
          },
        });
      }

      // Créer le mouvement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          storeId,
          userId,
          type: 'IN',
          quantity,
          reference,
          notes,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unit: true,
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
        },
      });

      return movement;
    });
  }

  /**
   * Gérer une sortie de stock
   */
  private async handleStockOut(
    productId: string,
    storeId: string,
    userId: string,
    quantity: number,
    reference?: string,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Vérifier que le stock existe
      const stock = await tx.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId,
          },
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
          store: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!stock) {
        throw new NotFoundException(
          'Aucun stock trouvé pour ce produit dans ce magasin',
        );
      }

      // Vérifier qu'il y a assez de stock
      if (stock.quantity < quantity) {
        throw new ConflictException(
          `Stock insuffisant pour "${stock.product.name}" au magasin "${stock.store.name}". Stock disponible: ${stock.quantity}, demandé: ${quantity}`,
        );
      }

      // Diminuer la quantité
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      // Créer le mouvement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          storeId,
          userId,
          type: 'OUT',
          quantity,
          reference,
          notes,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unit: true,
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
        },
      });

      return movement;
    });
  }

  /**
   * Gérer un transfert de stock entre magasins
   */
  private async handleStockTransfer(
    productId: string,
    fromStoreId: string,
    toStoreId: string,
    userId: string,
    quantity: number,
    reference?: string,
    notes?: string,
  ) {
    // Vérifier que les magasins sont différents
    if (fromStoreId === toStoreId) {
      throw new BadRequestException(
        'Les magasins source et destination doivent être différents',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Vérifier le stock source
      const fromStock = await tx.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId: fromStoreId,
          },
        },
        include: {
          product: {
            select: {
              name: true,
            },
          },
          store: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!fromStock) {
        throw new NotFoundException(
          'Aucun stock trouvé dans le magasin source',
        );
      }

      if (fromStock.quantity < quantity) {
        throw new ConflictException(
          `Stock insuffisant pour "${fromStock.product.name}" au magasin "${fromStock.store.name}". Stock disponible: ${fromStock.quantity}, demandé: ${quantity}`,
        );
      }

      // Vérifier que le magasin destination existe
      const toStore = await tx.store.findUnique({
        where: { id: toStoreId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!toStore) {
        throw new NotFoundException(
          `Magasin destination avec l'ID "${toStoreId}" non trouvé`,
        );
      }

      if (!toStore.isActive) {
        throw new BadRequestException(
          `Le magasin destination "${toStore.name}" est désactivé`,
        );
      }

      // Diminuer le stock source
      await tx.stock.update({
        where: { id: fromStock.id },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      // Augmenter le stock destination (ou le créer s'il n'existe pas)
      let toStock = await tx.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId: toStoreId,
          },
        },
      });

      if (!toStock) {
        toStock = await tx.stock.create({
          data: {
            productId,
            storeId: toStoreId,
            quantity,
          },
        });
      } else {
        toStock = await tx.stock.update({
          where: { id: toStock.id },
          data: {
            quantity: {
              increment: quantity,
            },
          },
        });
      }

      // Créer le mouvement de transfert
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          storeId: fromStoreId, // On enregistre le mouvement sur le magasin source
          userId,
          type: 'TRANSFER',
          quantity,
          reference,
          notes,
          fromStoreId,
          toStoreId,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unit: true,
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
        },
      });

      return movement;
    });
  }

  /**
   * Gérer un ajustement de stock (correction manuelle)
   */
  private async handleStockAdjustment(
    productId: string,
    storeId: string,
    userId: string,
    quantity: number,
    reference?: string,
    notes?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Vérifier si le stock existe
      let stock = await tx.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId,
          },
        },
      });

      if (!stock) {
        // Créer le stock avec la quantité ajustée
        stock = await tx.stock.create({
          data: {
            productId,
            storeId,
            quantity,
          },
        });
      } else {
        // Mettre à jour avec la nouvelle quantité
        stock = await tx.stock.update({
          where: { id: stock.id },
          data: {
            quantity,
          },
        });
      }

      // Créer le mouvement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          storeId,
          userId,
          type: 'ADJUSTMENT',
          quantity,
          reference,
          notes,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unit: true,
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
        },
      });

      return movement;
    });
  }

  /**
   * Récupérer tous les mouvements avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    storeId?: string,
    productId?: string,
    userId?: string,
    type?: string,
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

      if (productId) {
        where.productId = productId;
      }

      if (userId) {
        where.userId = userId;
      }

      if (type) {
        where.type = type;
      }

      // Filtre par plage de dates
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [movements, total] = await Promise.all([
        this.prisma.stockMovement.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
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
        }),
        this.prisma.stockMovement.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          movements,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${movements.length} mouvement(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des mouvements:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des mouvements',
      );
    }
  }

  /**
   * Récupérer un mouvement par ID
   */
  async findOne(id: string) {
    try {
      const movement = await this.prisma.stockMovement.findUnique({
        where: { id },
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
              role: true,
            },
          },
        },
      });

      if (!movement) {
        throw new NotFoundException(`Mouvement avec l'ID "${id}" non trouvé`);
      }

      return {
        data: movement,
        message: 'Mouvement trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération du mouvement:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du mouvement',
      );
    }
  }

  /**
   * Récupérer l'historique des mouvements d'un produit
   */
  async getProductHistory(
    productId: string,
    page = 1,
    limit = 50,
    storeId?: string,
  ) {
    try {
      // Vérifier que le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec l'ID "${productId}" non trouvé`,
        );
      }

      return this.findAll(page, limit, storeId, productId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        "Erreur lors de la récupération de l'historique du produit:",
        error,
      );
      throw new BadRequestException(
        "Une erreur est survenue lors de la récupération de l'historique",
      );
    }
  }

  /**
   * Récupérer les statistiques des mouvements
   */
  async getStats(startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [
        totalMovements,
        inMovements,
        outMovements,
        transferMovements,
        adjustmentMovements,
        recentMovements,
      ] = await Promise.all([
        this.prisma.stockMovement.count({ where }),
        this.prisma.stockMovement.count({
          where: { ...where, type: 'IN' },
        }),
        this.prisma.stockMovement.count({
          where: { ...where, type: 'OUT' },
        }),
        this.prisma.stockMovement.count({
          where: { ...where, type: 'TRANSFER' },
        }),
        this.prisma.stockMovement.count({
          where: { ...where, type: 'ADJUSTMENT' },
        }),
        this.prisma.stockMovement.findMany({
          where,
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            store: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                name: true,
              },
            },
          },
        }),
      ]);

      return {
        data: {
          totalMovements,
          byType: {
            in: inMovements,
            out: outMovements,
            transfer: transferMovements,
            adjustment: adjustmentMovements,
          },
          recentMovements,
        },
        message: 'Statistiques des mouvements récupérées',
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