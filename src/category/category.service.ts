import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer une nouvelle catégorie
   */
  async create(createCategoryDto: CreateCategoryDto) {
    try {
      const { name, description } = createCategoryDto;

      // Vérifier si une catégorie avec ce nom existe déjà (insensible à la casse)
      const existingCategory = await this.prisma.category.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingCategory) {
        throw new ConflictException(
          `Une catégorie avec le nom "${name}" existe déjà`,
        );
      }

      // Créer la catégorie
      const category = await this.prisma.category.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      return {
        data: category,
        message: 'Catégorie créée avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      console.error('Erreur lors de la création de la catégorie:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la création de la catégorie',
      );
    }
  }

  /**
   * Récupérer toutes les catégories avec pagination et filtres
   */
  async findAll(page = 1, limit = 50, search?: string) {
    try {
      const skip = (page - 1) * limit;

      // Construction de la clause where pour la recherche
      const where = search
        ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              description: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
        : {};

      // Récupération des catégories avec comptage
      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        }),
        this.prisma.category.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          categories,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${categories.length} catégorie(s) trouvée(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des catégories:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des catégories',
      );
    }
  }

  /**
   * Récupérer une catégorie par son ID
   */
  async findOne(id: string) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
          products: {
            take: 10, // Limiter à 10 produits pour la vue détaillée
            select: {
              id: true,
              name: true,
              sku: true,
              sellingPrice: true,
              isActive: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      });

      if (!category) {
        throw new NotFoundException(`Catégorie avec l'ID "${id}" non trouvée`);
      }

      return {
        data: category,
        message: 'Catégorie trouvée',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération de la catégorie:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération de la catégorie',
      );
    }
  }

  /**
   * Mettre à jour une catégorie
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    try {
      // Vérifier que la catégorie existe
      const existingCategory = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!existingCategory) {
        throw new NotFoundException(`Catégorie avec l'ID "${id}" non trouvée`);
      }

      // Si le nom est modifié, vérifier qu'il n'existe pas déjà
      if (updateCategoryDto.name) {
        const categoryWithSameName = await this.prisma.category.findFirst({
          where: {
            name: {
              equals: updateCategoryDto.name,
              mode: 'insensitive',
            },
            NOT: {
              id,
            },
          },
        });

        if (categoryWithSameName) {
          throw new ConflictException(
            `Une autre catégorie avec le nom "${updateCategoryDto.name}" existe déjà`,
          );
        }
      }

      // Mettre à jour la catégorie
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          name: updateCategoryDto.name?.trim(),
          description: updateCategoryDto.description?.trim() || null,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      return {
        data: updatedCategory,
        message: 'Catégorie mise à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour de la catégorie:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour de la catégorie',
      );
    }
  }

  /**
   * Supprimer une catégorie
   */
  async remove(id: string) {
    try {
      // Vérifier que la catégorie existe
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!category) {
        throw new NotFoundException(`Catégorie avec l'ID "${id}" non trouvée`);
      }

      // Vérifier qu'elle n'a pas de produits associés
      if (category._count.products > 0) {
        throw new ConflictException(
          `Impossible de supprimer cette catégorie car elle contient ${category._count.products} produit(s). Veuillez d'abord supprimer ou réaffecter les produits.`,
        );
      }

      // Supprimer la catégorie
      await this.prisma.category.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Catégorie supprimée avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression de la catégorie:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la suppression de la catégorie',
      );
    }
  }

  /**
   * Récupérer tous les produits d'une catégorie
   */
  async getProducts(id: string, page = 1, limit = 20) {
    try {
      // Vérifier que la catégorie existe
      const category = await this.prisma.category.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });

      if (!category) {
        throw new NotFoundException(`Catégorie avec l'ID "${id}" non trouvée`);
      }

      const skip = (page - 1) * limit;

      // Récupérer les produits avec pagination
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            categoryId: id,
          },
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            sku: true,
            barcode: true,
            costPrice: true,
            sellingPrice: true,
            minStock: true,
            unit: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.product.count({
          where: {
            categoryId: id,
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          category,
          products,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${products.length} produit(s) trouvé(s) dans la catégorie "${category.name}"`,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors de la récupération des produits de la catégorie:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des produits',
      );
    }
  }

  /**
   * Récupérer des statistiques sur les catégories
   */
  async getStats() {
    try {
      const [totalCategories, categoriesWithProducts, topCategories] =
        await Promise.all([
          // Total de catégories
          this.prisma.category.count(),

          // Catégories avec au moins 1 produit
          this.prisma.category.count({
            where: {
              products: {
                some: {},
              },
            },
          }),

          // Top 5 catégories par nombre de produits
          this.prisma.category.findMany({
            take: 5,
            orderBy: {
              products: {
                _count: 'desc',
              },
            },
            select: {
              id: true,
              name: true,
              _count: {
                select: {
                  products: true,
                },
              },
            },
          }),
        ]);

      const emptyCategories = totalCategories - categoriesWithProducts;

      return {
        data: {
          totalCategories,
          categoriesWithProducts,
          emptyCategories,
          topCategories,
        },
        message: 'Statistiques des catégories récupérées',
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