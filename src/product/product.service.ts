import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer un nouveau produit
   */
  async create(createProductDto: CreateProductDto) {
    try {
      const {
        name,
        description,
        barcode,
        sku,
        categoryId,
        supplierId,
        costPrice,
        sellingPrice,
        minStock,
        unit,
      } = createProductDto;

      // Vérifier que la catégorie existe
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!categoryExists) {
        throw new BadRequestException(
          `La catégorie avec l'ID "${categoryId}" n'existe pas`,
        );
      }

      // Vérifier que le fournisseur existe (si fourni)
      if (supplierId) {
        const supplierExists = await this.prisma.supplier.findUnique({
          where: { id: supplierId },
        });

        if (!supplierExists) {
          throw new BadRequestException(
            `Le fournisseur avec l'ID "${supplierId}" n'existe pas`,
          );
        }
      }

      // Vérifier que le SKU est unique
      const existingProductBySku = await this.prisma.product.findUnique({
        where: { sku },
      });

      if (existingProductBySku) {
        throw new ConflictException(
          `Un produit avec le SKU "${sku}" existe déjà`,
        );
      }

      // Vérifier que le code-barres est unique (s'il est fourni)
      if (barcode) {
        const existingProductByBarcode = await this.prisma.product.findUnique({
          where: { barcode },
        });

        if (existingProductByBarcode) {
          throw new ConflictException(
            `Un produit avec le code-barres "${barcode}" existe déjà`,
          );
        }
      }

      // Validation de la marge
      if (sellingPrice < costPrice) {
        console.warn(
          `⚠️ Le prix de vente (${sellingPrice}) est inférieur au prix d'achat (${costPrice})`,
        );
      }

      // Créer le produit
      const product = await this.prisma.product.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          barcode: barcode?.trim() || null,
          sku: sku.trim().toUpperCase(),
          categoryId,
          supplierId: supplierId || null,
          costPrice,
          sellingPrice,
          minStock: minStock || 0,
          unit: unit?.trim() || 'pièce',
          isActive: true,
        },
        include: {
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
      });

      // Calculer la marge
      const margin = product.sellingPrice - product.costPrice;
      const marginPercentage =
        product.costPrice > 0
          ? ((margin / product.costPrice) * 100).toFixed(2)
          : 0;

      return {
        data: {
          ...product,
          margin,
          marginPercentage: parseFloat(marginPercentage as string),
        },
        message: 'Produit créé avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la création du produit:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la création du produit',
      );
    }
  }

  /**
   * Récupérer tous les produits avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    search?: string,
    categoryId?: string,
    supplierId?: string,
    isActive?: boolean,
    lowStock?: boolean,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Construction de la clause where
      const where: any = {};

      // Filtre de recherche
      if (search) {
        where.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            description: {
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
        ];
      }

      // Filtre par catégorie
      if (categoryId) {
        where.categoryId = categoryId;
      }

      // Filtre par fournisseur
      if (supplierId) {
        where.supplierId = supplierId;
      }

      // Filtre par statut actif/inactif
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Récupération des produits avec comptage
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          include: {
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
            stocks: {
              select: {
                id: true,
                storeId: true,
                quantity: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      // Calculer les marges et filtrer par stock faible si nécessaire
      let productsWithMargins = products.map((product) => {
        const margin = product.sellingPrice - product.costPrice;
        const marginPercentage =
          product.costPrice > 0
            ? parseFloat(((margin / product.costPrice) * 100).toFixed(2))
            : 0;

        const totalStock = product.stocks.reduce(
          (sum, stock) => sum + stock.quantity,
          0,
        );
        const isLowStock = totalStock <= product.minStock;

        return {
          ...product,
          margin,
          marginPercentage,
          totalStock,
          isLowStock,
        };
      });

      // Filtre par stock faible (après calcul du stock total)
      if (lowStock === true) {
        productsWithMargins = productsWithMargins.filter((p) => p.isLowStock);
      }

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          products: productsWithMargins,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${productsWithMargins.length} produit(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des produits:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des produits',
      );
    }
  }

  /**
   * Récupérer un produit par son ID
   */
  async findOne(id: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
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
          stocks: {
            select: {
              id: true,
              storeId: true,
              quantity: true,
              store: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                },
              },
            },
            orderBy: {
              store: {
                name: 'asc',
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec l'ID "${id}" non trouvé`,
        );
      }

      // Calculer la marge
      const margin = product.sellingPrice - product.costPrice;
      const marginPercentage =
        product.costPrice > 0
          ? parseFloat(((margin / product.costPrice) * 100).toFixed(2))
          : 0;

      // Calculer le stock total
      const totalStock = product.stocks.reduce(
        (sum, stock) => sum + stock.quantity,
        0,
      );
      const isLowStock = totalStock <= product.minStock;

      return {
        data: {
          ...product,
          margin,
          marginPercentage,
          totalStock,
          isLowStock,
        },
        message: 'Produit trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération du produit:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du produit',
      );
    }
  }

  /**
   * Rechercher un produit par code-barres
   */
  async findByBarcode(barcode: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { barcode },
        include: {
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
          stocks: {
            select: {
              id: true,
              storeId: true,
              quantity: true,
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec le code-barres "${barcode}" non trouvé`,
        );
      }

      const margin = product.sellingPrice - product.costPrice;
      const marginPercentage =
        product.costPrice > 0
          ? parseFloat(((margin / product.costPrice) * 100).toFixed(2))
          : 0;

      const totalStock = product.stocks.reduce(
        (sum, stock) => sum + stock.quantity,
        0,
      );

      return {
        data: {
          ...product,
          margin,
          marginPercentage,
          totalStock,
          isLowStock: totalStock <= product.minStock,
        },
        message: 'Produit trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors de la recherche du produit par code-barres:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la recherche du produit',
      );
    }
  }

  /**
   * Rechercher un produit par SKU
   */
  async findBySku(sku: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { sku: sku.toUpperCase() },
        include: {
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
          stocks: {
            select: {
              id: true,
              storeId: true,
              quantity: true,
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec le SKU "${sku}" non trouvé`,
        );
      }

      const margin = product.sellingPrice - product.costPrice;
      const marginPercentage =
        product.costPrice > 0
          ? parseFloat(((margin / product.costPrice) * 100).toFixed(2))
          : 0;

      const totalStock = product.stocks.reduce(
        (sum, stock) => sum + stock.quantity,
        0,
      );

      return {
        data: {
          ...product,
          margin,
          marginPercentage,
          totalStock,
          isLowStock: totalStock <= product.minStock,
        },
        message: 'Produit trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la recherche du produit par SKU:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la recherche du produit',
      );
    }
  }

  /**
   * Mettre à jour un produit
   */
  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      // Vérifier que le produit existe
      const existingProduct = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!existingProduct) {
        throw new NotFoundException(
          `Produit avec l'ID "${id}" non trouvé`,
        );
      }

      // Vérifier la catégorie si elle est modifiée
      if (updateProductDto.categoryId) {
        const categoryExists = await this.prisma.category.findUnique({
          where: { id: updateProductDto.categoryId },
        });

        if (!categoryExists) {
          throw new BadRequestException(
            `La catégorie avec l'ID "${updateProductDto.categoryId}" n'existe pas`,
          );
        }
      }

      // Vérifier le fournisseur si il est modifié
      if (updateProductDto.supplierId) {
        const supplierExists = await this.prisma.supplier.findUnique({
          where: { id: updateProductDto.supplierId },
        });

        if (!supplierExists) {
          throw new BadRequestException(
            `Le fournisseur avec l'ID "${updateProductDto.supplierId}" n'existe pas`,
          );
        }
      }

      // Vérifier le SKU si il est modifié
      if (updateProductDto.sku) {
        const productWithSameSku = await this.prisma.product.findFirst({
          where: {
            sku: updateProductDto.sku.toUpperCase(),
            NOT: {
              id,
            },
          },
        });

        if (productWithSameSku) {
          throw new ConflictException(
            `Un autre produit avec le SKU "${updateProductDto.sku}" existe déjà`,
          );
        }
      }

      // Vérifier le code-barres si il est modifié
      if (updateProductDto.barcode) {
        const productWithSameBarcode = await this.prisma.product.findFirst({
          where: {
            barcode: updateProductDto.barcode,
            NOT: {
              id,
            },
          },
        });

        if (productWithSameBarcode) {
          throw new ConflictException(
            `Un autre produit avec le code-barres "${updateProductDto.barcode}" existe déjà`,
          );
        }
      }

      // Validation de la marge si les prix sont modifiés
      const newCostPrice = updateProductDto.costPrice || existingProduct.costPrice;
      const newSellingPrice =
        updateProductDto.sellingPrice || existingProduct.sellingPrice;

      if (newSellingPrice < newCostPrice) {
        console.warn(
          `⚠️ Le prix de vente (${newSellingPrice}) est inférieur au prix d'achat (${newCostPrice})`,
        );
      }

      // Mettre à jour le produit
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          name: updateProductDto.name?.trim(),
          description: updateProductDto.description?.trim() || undefined,
          barcode: updateProductDto.barcode?.trim() || undefined,
          sku: updateProductDto.sku?.trim().toUpperCase() || undefined,
          categoryId: updateProductDto.categoryId,
          supplierId: updateProductDto.supplierId,
          costPrice: updateProductDto.costPrice,
          sellingPrice: updateProductDto.sellingPrice,
          minStock: updateProductDto.minStock,
          unit: updateProductDto.unit?.trim() || undefined,
        },
        include: {
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
      });

      const margin = updatedProduct.sellingPrice - updatedProduct.costPrice;
      const marginPercentage =
        updatedProduct.costPrice > 0
          ? parseFloat(
            ((margin / updatedProduct.costPrice) * 100).toFixed(2),
          )
          : 0;

      return {
        data: {
          ...updatedProduct,
          margin,
          marginPercentage,
        },
        message: 'Produit mis à jour avec succès',
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

      console.error('Erreur lors de la mise à jour du produit:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour du produit',
      );
    }
  }

  /**
   * Activer/Désactiver un produit
   */
  async toggleActive(id: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec l'ID "${id}" non trouvé`,
        );
      }

      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          isActive: !product.isActive,
        },
        include: {
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
      });

      return {
        data: updatedProduct,
        message: `Produit ${updatedProduct.isActive ? 'activé' : 'désactivé'} avec succès`,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors du changement de statut du produit:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors du changement de statut',
      );
    }
  }

  /**
   * Supprimer un produit
   */
  async remove(id: string) {
    try {
      // Vérifier que le produit existe
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          stocks: true,
          saleItems: true,
          stockMovements: true,
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Produit avec l'ID "${id}" non trouvé`,
        );
      }

      // Vérifier qu'il n'a pas de ventes associées
      if (product.saleItems.length > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce produit car il est associé à ${product.saleItems.length} vente(s). Désactivez-le plutôt.`,
        );
      }

      // Vérifier qu'il n'a pas de mouvements de stock
      if (product.stockMovements.length > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce produit car il possède un historique de ${product.stockMovements.length} mouvement(s) de stock. Désactivez-le plutôt.`,
        );
      }

      // Supprimer d'abord les stocks associés (cascade devrait le faire mais on s'assure)
      if (product.stocks.length > 0) {
        await this.prisma.stock.deleteMany({
          where: {
            productId: id,
          },
        });
      }

      // Supprimer le produit
      await this.prisma.product.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Produit supprimé avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression du produit:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la suppression du produit',
      );
    }
  }

  /**
   * Récupérer les produits avec stock faible
   */
  async getLowStockProducts(page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      // Récupérer tous les produits actifs avec leurs stocks
      const products = await this.prisma.product.findMany({
        where: {
          isActive: true,
        },
        include: {
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
          stocks: {
            select: {
              id: true,
              storeId: true,
              quantity: true,
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Filtrer les produits avec stock faible
      const lowStockProducts = products
        .map((product) => {
          const totalStock = product.stocks.reduce(
            (sum, stock) => sum + stock.quantity,
            0,
          );
          const margin = product.sellingPrice - product.costPrice;
          const marginPercentage =
            product.costPrice > 0
              ? parseFloat(((margin / product.costPrice) * 100).toFixed(2))
              : 0;

          return {
            ...product,
            totalStock,
            margin,
            marginPercentage,
            isLowStock: totalStock <= product.minStock,
          };
        })
        .filter((product) => product.isLowStock)
        .slice(skip, skip + limit);

      const total = products.filter((product) => {
        const totalStock = product.stocks.reduce(
          (sum, stock) => sum + stock.quantity,
          0,
        );
        return totalStock <= product.minStock;
      }).length;

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          products: lowStockProducts,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${lowStockProducts.length} produit(s) en stock faible`,
        success: true,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des produits en stock faible:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des produits en stock faible',
      );
    }
  }

  /**
   * Récupérer des statistiques sur les produits
   */
  async getStats() {
    try {
      const [
        totalProducts,
        activeProducts,
        inactiveProducts,
        productsWithSupplier,
        allProducts,
        topProducts,
      ] = await Promise.all([
        // Total de produits
        this.prisma.product.count(),

        // Produits actifs
        this.prisma.product.count({
          where: {
            isActive: true,
          },
        }),

        // Produits inactifs
        this.prisma.product.count({
          where: {
            isActive: false,
          },
        }),

        // Produits avec fournisseur
        this.prisma.product.count({
          where: {
            supplierId: {
              not: null,
            },
          },
        }),

        // Tous les produits avec stocks pour calculer stock faible
        this.prisma.product.findMany({
          where: {
            isActive: true,
          },
          select: {
            id: true,
            minStock: true,
            stocks: {
              select: {
                quantity: true,
              },
            },
          },
        }),

        // Top 5 produits par nombre de ventes (à implémenter plus tard avec SaleItems)
        this.prisma.product.findMany({
          take: 5,
          where: {
            isActive: true,
          },
          orderBy: {
            name: 'asc', // Temporaire, sera remplacé par ventes plus tard
          },
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
            _count: {
              select: {
                saleItems: true,
              },
            },
          },
        }),
      ]);

      // Calculer les produits en stock faible
      const lowStockCount = allProducts.filter((product) => {
        const totalStock = product.stocks.reduce(
          (sum, stock) => sum + stock.quantity,
          0,
        );
        return totalStock <= product.minStock;
      }).length;

      // Produits par catégorie
      const productsByCategory = await this.prisma.category.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: {
          products: {
            _count: 'desc',
          },
        },
        take: 5,
      });

      return {
        data: {
          totalProducts,
          activeProducts,
          inactiveProducts,
          productsWithSupplier,
          productsWithoutSupplier: totalProducts - productsWithSupplier,
          lowStockCount,
          topProducts,
          productsByCategory,
        },
        message: 'Statistiques des produits récupérées',
        success: true,
      };
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des statistiques:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des statistiques',
      );
    }
  }
}