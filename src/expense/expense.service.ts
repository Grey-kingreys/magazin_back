import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer une nouvelle dépense
   */
  async create(createExpenseDto: CreateExpenseDto, userId: string) {
    try {
      const { storeId, category, description, amount, reference, paymentMethod, date } = createExpenseDto;

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

      // Créer la dépense
      const expense = await this.prisma.expense.create({
        data: {
          storeId,
          userId,
          category: category.trim(),
          description: description.trim(),
          amount,
          reference: reference?.trim() || null,
          paymentMethod: paymentMethod || null,
          date: date || new Date(),
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
        data: expense,
        message: 'Dépense enregistrée avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la création de la dépense:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la création de la dépense',
      );
    }
  }

  /**
   * Récupérer toutes les dépenses avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    storeId?: string,
    category?: string,
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

      const [expenses, total] = await Promise.all([
        this.prisma.expense.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            date: 'desc',
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
        }),
        this.prisma.expense.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          expenses,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${expenses.length} dépense(s) trouvée(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des dépenses',
      );
    }
  }

  /**
   * Récupérer une dépense par ID
   */
  async findOne(id: string) {
    try {
      const expense = await this.prisma.expense.findUnique({
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
              role: true,
            },
          },
        },
      });

      if (!expense) {
        throw new NotFoundException(`Dépense avec l'ID "${id}" non trouvée`);
      }

      return {
        data: expense,
        message: 'Dépense trouvée',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération de la dépense:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération de la dépense',
      );
    }
  }

  /**
   * Mettre à jour une dépense
   */
  async update(id: string, updateExpenseDto: UpdateExpenseDto) {
    try {
      // Vérifier que la dépense existe
      const existingExpense = await this.prisma.expense.findUnique({
        where: { id },
      });

      if (!existingExpense) {
        throw new NotFoundException(`Dépense avec l'ID "${id}" non trouvée`);
      }

      // Si le magasin est modifié, vérifier qu'il existe
      if (updateExpenseDto.storeId) {
        const store = await this.prisma.store.findUnique({
          where: { id: updateExpenseDto.storeId },
        });

        if (!store) {
          throw new NotFoundException(
            `Magasin avec l'ID "${updateExpenseDto.storeId}" non trouvé`,
          );
        }

        if (!store.isActive) {
          throw new BadRequestException(
            `Le magasin "${store.name}" est désactivé`,
          );
        }
      }

      // Mettre à jour la dépense
      const updatedExpense = await this.prisma.expense.update({
        where: { id },
        data: {
          storeId: updateExpenseDto.storeId,
          category: updateExpenseDto.category?.trim(),
          description: updateExpenseDto.description?.trim(),
          amount: updateExpenseDto.amount,
          reference: updateExpenseDto.reference?.trim() || undefined,
          paymentMethod: updateExpenseDto.paymentMethod,
          date: updateExpenseDto.date,
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
        data: updatedExpense,
        message: 'Dépense mise à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour de la dépense:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour de la dépense',
      );
    }
  }

  /**
   * Supprimer une dépense
   */
  async remove(id: string) {
    try {
      const expense = await this.prisma.expense.findUnique({
        where: { id },
      });

      if (!expense) {
        throw new NotFoundException(`Dépense avec l'ID "${id}" non trouvée`);
      }

      await this.prisma.expense.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Dépense supprimée avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la suppression de la dépense:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la suppression de la dépense',
      );
    }
  }

  /**
   * Récupérer les catégories de dépenses uniques
   */
  async getCategories() {
    try {
      const expenses = await this.prisma.expense.findMany({
        select: {
          category: true,
        },
        distinct: ['category'],
        orderBy: {
          category: 'asc',
        },
      });

      const categories = expenses.map((e) => e.category);

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
   * Récupérer les statistiques des dépenses
   */
  async getStats(storeId?: string, startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};

      if (storeId) {
        where.storeId = storeId;
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

      const [totalExpenses, expenses, expensesByCategory, expensesByStore] = await Promise.all([
        // Nombre total de dépenses
        this.prisma.expense.count({ where }),

        // Toutes les dépenses pour calculs
        this.prisma.expense.findMany({
          where,
          select: {
            amount: true,
            category: true,
          },
        }),

        // Dépenses par catégorie
        this.prisma.expense.groupBy({
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

        // Dépenses par magasin
        this.prisma.expense.groupBy({
          by: ['storeId'],
          where: storeId ? { storeId } : {},
          _count: true,
          _sum: {
            amount: true,
          },
        }),
      ]);

      // Calculer le total des dépenses
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

      return {
        data: {
          totalExpenses,
          totalAmount: Math.round(totalAmount),
          averageExpense:
            totalExpenses > 0 ? Math.round(totalAmount / totalExpenses) : 0,
          expensesByCategory,
          expensesByStore,
        },
        message: 'Statistiques des dépenses récupérées',
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