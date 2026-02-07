import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer un nouveau stock (ou initialiser le stock d'un produit dans un magasin)
   */
  async create(createStockDto: CreateStockDto) {
    try {
      const { productId, storeId, quantity } = createStockDto;

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

      // Vérifier qu'il n'existe pas déjà un stock pour ce couple produit-magasin
      const existingStock = await this.prisma.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId,
          },
        },
      });

      if (existingStock) {
        throw new ConflictException(
          `Un stock existe déjà pour le produit "${product.name}" dans le magasin "${store.name}"`,
        );
      }

      // Créer le stock
      const stock = await this.prisma.stock.create({
        data: {
          productId,
          storeId,
          quantity,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              sellingPrice: true,
              minStock: true,
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
        },
      });

      const isLowStock = stock.quantity <= stock.product.minStock;

      return {
        data: {
          ...stock,
          isLowStock,
        },
        message: 'Stock créé avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la création du stock:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la création du stock',
      );
    }
  }

  /**
   * Récupérer tous les stocks avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    search?: string,
    storeId?: string,
    productId?: string,
    lowStock?: boolean,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Construction de la clause where
      const where: any = {};

      // Filtre par magasin
      if (storeId) {
        where.storeId = storeId;
      }

      // Filtre par produit
      if (productId) {
        where.productId = productId;
      }

      // Filtre de recherche (nom du produit, SKU, code-barres)
      if (search) {
        where.product = {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              sku: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              barcode: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        };
      }

      // Récupération des stocks avec comptage
      const [stocks, total] = await Promise.all([
        this.prisma.stock.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            {
              store: {
                name: 'asc',
              },
            },
            {
              product: {
                name: 'asc',
              },
            },
          ],
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                sellingPrice: true,
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
                isActive: true,
              },
            },
          },
        }),
        this.prisma.stock.count({ where }),
      ]);

      // Ajouter le statut de stock faible
      let stocksWithStatus = stocks.map((stock) => ({
        ...stock,
        isLowStock: stock.quantity <= stock.product.minStock,
      }));

      // Filtre par stock faible (après calcul)
      if (lowStock === true) {
        stocksWithStatus = stocksWithStatus.filter((s) => s.isLowStock);
      }

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          stocks: stocksWithStatus,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${stocksWithStatus.length} stock(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stocks:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des stocks',
      );
    }
  }

  /**
   * Récupérer un stock par ID
   */
  async findOne(id: string) {
    try {
      const stock = await this.prisma.stock.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              sellingPrice: true,
              costPrice: true,
              minStock: true,
              unit: true,
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
                  email: true,
                  phone: true,
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
              isActive: true,
            },
          },
        },
      });

      if (!stock) {
        throw new NotFoundException(`Stock avec l'ID "${id}" non trouvé`);
      }

      const isLowStock = stock.quantity <= stock.product.minStock;

      return {
        data: {
          ...stock,
          isLowStock,
        },
        message: 'Stock trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération du stock:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du stock',
      );
    }
  }

  /**
   * Récupérer le stock d'un produit dans un magasin spécifique
   */
  async findByProductAndStore(productId: string, storeId: string) {
    try {
      const stock = await this.prisma.stock.findUnique({
        where: {
          productId_storeId: {
            productId,
            storeId,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              sellingPrice: true,
              minStock: true,
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
        },
      });

      if (!stock) {
        throw new NotFoundException(
          `Aucun stock trouvé pour ce produit dans ce magasin`,
        );
      }

      const isLowStock = stock.quantity <= stock.product.minStock;

      return {
        data: {
          ...stock,
          isLowStock,
        },
        message: 'Stock trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération du stock:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du stock',
      );
    }
  }

  /**
   * Mettre à jour un stock (quantité uniquement)
   * Note: Les mouvements de stock doivent normalement passer par StockMovement
   * Cette méthode est pour les ajustements manuels
   */
  async update(id: string, updateStockDto: UpdateStockDto) {
    try {
      // Vérifier que le stock existe
      const existingStock = await this.prisma.stock.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              name: true,
              minStock: true,
            },
          },
          store: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!existingStock) {
        throw new NotFoundException(`Stock avec l'ID "${id}" non trouvé`);
      }

      // Mettre à jour le stock
      const updatedStock = await this.prisma.stock.update({
        where: { id },
        data: {
          quantity: updateStockDto.quantity,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              sellingPrice: true,
              minStock: true,
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
        },
      });

      const isLowStock = updatedStock.quantity <= updatedStock.product.minStock;

      // Avertissement si stock faible
      if (isLowStock) {
        console.warn(
          `⚠️ Stock faible pour "${updatedStock.product.name}" au magasin "${updatedStock.store.name}": ${updatedStock.quantity} ${updatedStock.product.unit}`,
        );
      }

      return {
        data: {
          ...updatedStock,
          isLowStock,
        },
        message: 'Stock mis à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour du stock:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour du stock',
      );
    }
  }

  /**
   * Supprimer un stock
   */
  async remove(id: string) {
    try {
      // Vérifier que le stock existe
      const stock = await this.prisma.stock.findUnique({
        where: { id },
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
        throw new NotFoundException(`Stock avec l'ID "${id}" non trouvé`);
      }

      // Vérifier qu'il n'y a pas de stock restant
      if (stock.quantity > 0) {
        throw new ConflictException(
          `Impossible de supprimer un stock avec une quantité de ${stock.quantity}. Videz d'abord le stock.`,
        );
      }

      // Supprimer le stock
      await this.prisma.stock.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Stock supprimé avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression du stock:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la suppression du stock',
      );
    }
  }

  /**
   * Récupérer les stocks faibles (quantité <= minStock)
   */
  async getLowStocks(page = 1, limit = 50, storeId?: string) {
    try {
      const skip = (page - 1) * limit;

      const where: any = {};

      if (storeId) {
        where.storeId = storeId;
      }

      // Récupérer tous les stocks
      const allStocks = await this.prisma.stock.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              sellingPrice: true,
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

      // Filtrer les stocks faibles
      const lowStocks = allStocks
        .filter((stock) => stock.quantity <= stock.product.minStock)
        .map((stock) => ({
          ...stock,
          isLowStock: true,
        }))
        .slice(skip, skip + limit);

      const total = allStocks.filter(
        (stock) => stock.quantity <= stock.product.minStock,
      ).length;
      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          stocks: lowStocks,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${lowStocks.length} stock(s) faible(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stocks faibles:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des stocks faibles',
      );
    }
  }

  /**
   * Récupérer les stocks par magasin
   */
  async getStocksByStore(storeId: string, page = 1, limit = 50) {
    try {
      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${storeId}" non trouvé`,
        );
      }

      return this.findAll(page, limit, undefined, storeId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors de la récupération des stocks par magasin:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des stocks',
      );
    }
  }

  /**
   * Récupérer les statistiques des stocks
   */
  async getStats() {
    try {
      const [totalStocks, allStocks, stocksByStore] = await Promise.all([
        // Total des stocks
        this.prisma.stock.count(),

        // Tous les stocks avec produits
        this.prisma.stock.findMany({
          include: {
            product: {
              select: {
                minStock: true,
                sellingPrice: true,
                costPrice: true,
              },
            },
          },
        }),

        // Stocks par magasin
        this.prisma.store.findMany({
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                stocks: true,
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        }),
      ]);

      // Calculer les stocks faibles
      const lowStockCount = allStocks.filter(
        (stock) => stock.quantity <= stock.product.minStock,
      ).length;

      // Calculer la valeur totale du stock
      const totalStockValue = allStocks.reduce(
        (sum, stock) => sum + stock.quantity * stock.product.costPrice,
        0,
      );

      // Calculer la valeur de vente potentielle
      const potentialSaleValue = allStocks.reduce(
        (sum, stock) => sum + stock.quantity * stock.product.sellingPrice,
        0,
      );

      // Quantité totale en stock
      const totalQuantity = allStocks.reduce(
        (sum, stock) => sum + stock.quantity,
        0,
      );

      return {
        data: {
          totalStocks,
          lowStockCount,
          totalQuantity,
          totalStockValue: Math.round(totalStockValue),
          potentialSaleValue: Math.round(potentialSaleValue),
          potentialProfit: Math.round(potentialSaleValue - totalStockValue),
          stocksByStore,
        },
        message: 'Statistiques des stocks récupérées',
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