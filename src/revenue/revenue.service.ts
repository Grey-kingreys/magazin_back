import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { StoreFinanceService } from 'src/common/services/store-finance.service';

@Injectable()
export class RevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeFinance: StoreFinanceService,
  ) { }

  async create(createRevenueDto: CreateRevenueDto, userId: string) {
    try {
      const { storeId, category, description, amount, reference, date } = createRevenueDto;

      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        throw new NotFoundException(`Magasin avec l'ID "${storeId}" non trouvé`);
      }

      if (!store.isActive) {
        throw new BadRequestException(`Le magasin "${store.name}" est désactivé`);
      }

      // Créer la recette ET créditer le magasin dans une transaction
      const revenue = await this.prisma.$transaction(async (tx) => {
        // 1. Créer la recette
        const newRevenue = await tx.revenue.create({
          data: {
            userId,
            storeId,
            category: category.trim(),
            description: description.trim(),
            amount,
            reference: reference?.trim() || null,
            date: date || new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
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

        // 2. Créditer le magasin
        await this.storeFinance.creditStore(
          storeId,
          userId,
          amount,
          'REVENUE',
          `Recette: ${category} - ${description}`,
          newRevenue.id,
        );

        return newRevenue;
      });

      return {
        data: revenue,
        message: 'Recette enregistrée avec succès',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la création de la recette:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la création de la recette',
      );
    }
  }



  /**
   * Récupérer toutes les recettes avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    category?: string,
    startDate?: Date,
    endDate?: Date,
    search?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Construction de la clause where
      const where: any = {};

      if (category) {
        where.category = {
          equals: category,
          mode: 'insensitive',
        };
      }

      if (search) {
        where.OR = [
          {
            description: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            reference: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            category: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = startDate;
        }
        if (endDate) {
          where.date.lte = endDate;
        }
      }

      const [revenues, total] = await Promise.all([
        this.prisma.revenue.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            date: 'desc',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.revenue.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          revenues,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${revenues.length} recette(s) trouvée(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des recettes:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des recettes',
      );
    }
  }

  /**
   * Récupérer une recette par ID
   */
  async findOne(id: string) {
    try {
      const revenue = await this.prisma.revenue.findUnique({
        where: { id },
        include: {
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

      if (!revenue) {
        throw new NotFoundException(`Recette avec l'ID "${id}" non trouvée`);
      }

      return {
        data: revenue,
        message: 'Recette trouvée',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération de la recette:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération de la recette',
      );
    }
  }

  /**
   * Mettre à jour une recette
   */
  async update(id: string, updateRevenueDto: UpdateRevenueDto) {
    try {
      // Vérifier que la recette existe
      const existingRevenue = await this.prisma.revenue.findUnique({
        where: { id },
      });

      if (!existingRevenue) {
        throw new NotFoundException(`Recette avec l'ID "${id}" non trouvée`);
      }

      // Mettre à jour la recette
      const updatedRevenue = await this.prisma.revenue.update({
        where: { id },
        data: {
          category: updateRevenueDto.category?.trim(),
          description: updateRevenueDto.description?.trim(),
          amount: updateRevenueDto.amount,
          reference: updateRevenueDto.reference?.trim() || undefined,
          date: updateRevenueDto.date,
        },
        include: {
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
        data: updatedRevenue,
        message: 'Recette mise à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour de la recette:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour de la recette',
      );
    }
  }

  /**
   * Supprimer une recette
   */
  async remove(id: string) {
    try {
      const revenue = await this.prisma.revenue.findUnique({
        where: { id },
      });

      if (!revenue) {
        throw new NotFoundException(`Recette avec l'ID "${id}" non trouvée`);
      }

      await this.prisma.revenue.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Recette supprimée avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la suppression de la recette:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la suppression de la recette',
      );
    }
  }

  /**
   * Récupérer les catégories de recettes uniques
   */
  async getCategories() {
    try {
      const revenues = await this.prisma.revenue.findMany({
        select: {
          category: true,
        },
        distinct: ['category'],
        orderBy: {
          category: 'asc',
        },
      });

      const categories = revenues.map((r) => r.category);

      return {
        data: categories,
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
   * Récupérer les statistiques des recettes
   */
  async getStats(startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};

      if (startDate || endDate) {
        where.date = {};
        if (startDate) {
          where.date.gte = startDate;
        }
        if (endDate) {
          where.date.lte = endDate;
        }
      }

      const [totalRevenues, revenues, revenuesByCategory] = await Promise.all([
        // Nombre total de recettes
        this.prisma.revenue.count({ where }),

        // Toutes les recettes pour calculs
        this.prisma.revenue.findMany({
          where,
          select: {
            amount: true,
            category: true,
          },
        }),

        // Recettes par catégorie
        this.prisma.revenue.groupBy({
          by: ['category'],
          where,
          _count: true,
          _sum: {
            amount: true,
          },
          orderBy: {
            _sum: {
              amount: 'desc',
            },
          },
        }),
      ]);

      // Calculer le total des recettes
      const totalAmount = revenues.reduce((sum, revenue) => sum + revenue.amount, 0);

      return {
        data: {
          totalRevenues,
          totalAmount: Math.round(totalAmount),
          averageRevenue:
            totalRevenues > 0 ? Math.round(totalAmount / totalRevenues) : 0,
          revenuesByCategory,
        },
        message: 'Statistiques des recettes récupérées',
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