import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { StoreFinanceService } from 'src/common/services/store-finance.service';
import { CashRegisterService } from 'src/cash-register/cash-register.service';

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeFinance: StoreFinanceService,
    private readonly cashRegisterService: CashRegisterService,
  ) { }

  /**
   * Créer une nouvelle dépense
   * ⭐ Gère automatiquement les caisses pour les paiements en espèces
   */
  async create(createExpenseDto: CreateExpenseDto, userId: string) {
    try {
      const { storeId, category, description, amount, reference, paymentMethod, date, cashRegisterId } = createExpenseDto;

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

      // ⭐ Vérifier le solde avant de créer la dépense
      const hasBalance = await this.storeFinance.checkBalance(storeId, amount);
      if (!hasBalance) {
        const currentBalance = await this.storeFinance.getBalance(storeId);
        throw new BadRequestException(
          `Solde insuffisant au magasin "${store.name}". ` +
          `Disponible: ${currentBalance.toLocaleString()} GNF, ` +
          `Requis: ${amount.toLocaleString()} GNF`
        );
      }

      // ⭐ GESTION DES DÉPENSES EN ESPÈCES
      let effectiveCashRegisterId = cashRegisterId;
      let enhancedDescription = description;

      if (paymentMethod === 'CASH') {
        // Si une caisse est fournie, vérifier qu'elle est valide
        if (effectiveCashRegisterId) {
          const specifiedCashRegister = await this.prisma.cashRegister.findUnique({
            where: { id: effectiveCashRegisterId },
            select: {
              id: true,
              status: true,
              userId: true,
              storeId: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          });

          if (!specifiedCashRegister) {
            throw new NotFoundException(
              `Caisse avec l'ID "${effectiveCashRegisterId}" non trouvée`
            );
          }

          if (specifiedCashRegister.status !== 'OPEN') {
            throw new BadRequestException(
              `La caisse spécifiée est fermée. Veuillez choisir une caisse ouverte.`
            );
          }

          if (specifiedCashRegister.storeId !== storeId) {
            throw new BadRequestException(
              `La caisse spécifiée n'appartient pas au magasin "${store.name}"`
            );
          }

          if (specifiedCashRegister.userId !== userId) {
            throw new BadRequestException(
              `La caisse spécifiée appartient à ${specifiedCashRegister.user.name}. Vous ne pouvez utiliser que votre propre caisse.`
            );
          }
        } else {
          // Si pas de caisse fournie, chercher la caisse ouverte de l'utilisateur dans ce magasin
          const userOpenCashRegister = await this.prisma.cashRegister.findFirst({
            where: {
              userId,
              storeId,
              status: 'OPEN',
            },
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          });

          if (!userOpenCashRegister) {
            throw new BadRequestException(
              `Aucune caisse ouverte trouvée dans le magasin "${store.name}" pour un paiement en espèces. ` +
              `Ouvrez une caisse d'abord ou utilisez un autre mode de paiement.`
            );
          }

          effectiveCashRegisterId = userOpenCashRegister.id;
        }

        // Ajouter une note dans la description
        enhancedDescription = `${description} [Payé en espèces depuis votre caisse]`;
      }

      // Créer la dépense ET débiter le magasin dans une transaction
      const expense = await this.prisma.$transaction(async (tx) => {
        // 1. Créer la dépense
        const newExpense = await tx.expense.create({
          data: {
            storeId,
            userId,
            cashRegisterId: effectiveCashRegisterId || null,
            category: category.trim(),
            description: enhancedDescription.trim(),
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
            cashRegister: {
              select: {
                id: true,
              },
            },
          },
        });

        // 2. Débiter le magasin
        await this.storeFinance.debitStore(
          storeId,
          userId,
          amount,
          'EXPENSE',
          `Dépense: ${category} - ${description}`,
          newExpense.id,
        );

        return newExpense;
      });

      // ⭐ 3. Mettre à jour le montant disponible dans la caisse (si paiement en espèces)
      if (effectiveCashRegisterId && paymentMethod === 'CASH') {
        try {
          await this.cashRegisterService.updateAvailableAmount(
            effectiveCashRegisterId,
            amount,
            'SUBTRACT',
            `Dépense: ${category}`,
          );
        } catch (error) {
          console.warn(
            '⚠️ Erreur lors de la mise à jour de la caisse, mais dépense créée:',
            error,
          );
        }
      }

      return {
        data: expense,
        message: `Dépense enregistrée avec succès${effectiveCashRegisterId && paymentMethod === 'CASH' ? '. Caisse mise à jour.' : ''}`,
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
            cashRegister: {
              select: {
                id: true,
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
          cashRegister: {
            select: {
              id: true,
              status: true,
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
   * ⚠️ Note: La mise à jour ne modifie PAS les caisses (pour éviter les incohérences)
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

      // Mettre à jour la dépense (sans toucher aux caisses)
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
          // ⚠️ cashRegisterId n'est PAS modifiable pour éviter les incohérences
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
          cashRegister: {
            select: {
              id: true,
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
   * ⭐ Restaure l'argent dans la caisse si c'était un paiement en espèces
   */
  async remove(id: string) {
    try {
      const expense = await this.prisma.expense.findUnique({
        where: { id },
        include: {
          cashRegister: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!expense) {
        throw new NotFoundException(`Dépense avec l'ID "${id}" non trouvée`);
      }

      // ⭐ Si la dépense a été débitée d'une caisse ouverte, créditer la caisse
      if (expense.cashRegisterId && expense.cashRegister?.status === 'OPEN') {
        try {
          await this.cashRegisterService.updateAvailableAmount(
            expense.cashRegisterId,
            expense.amount,
            'ADD',
            `Annulation dépense: ${expense.category}`,
          );
        } catch (error) {
          console.warn(
            '⚠️ Erreur lors de la restauration de l\'argent dans la caisse:',
            error,
          );
        }
      }

      // Créditer le magasin pour annuler le débit
      if (expense.amount > 0) {
        await this.storeFinance.creditStore(
          expense.storeId,
          expense.userId,
          expense.amount,
          'EXPENSE_CANCELLATION',
          `Annulation dépense: ${expense.category}`,
          expense.id,
        );
      }

      // Supprimer la dépense
      await this.prisma.expense.delete({
        where: { id },
      });

      return {
        data: { id },
        message: `Dépense supprimée avec succès${expense.cashRegisterId && expense.cashRegister?.status === 'OPEN' ? '. Caisse mise à jour.' : ''}`,
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
            paymentMethod: true,
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

      // Calculer les dépenses par méthode de paiement
      const expensesByPaymentMethod = expenses.reduce((acc, expense) => {
        const method = expense.paymentMethod || 'UNKNOWN';
        if (!acc[method]) {
          acc[method] = { count: 0, total: 0 };
        }
        acc[method].count++;
        acc[method].total += expense.amount;
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      return {
        data: {
          totalExpenses,
          totalAmount: Math.round(totalAmount),
          averageExpense:
            totalExpenses > 0 ? Math.round(totalAmount / totalExpenses) : 0,
          expensesByCategory,
          expensesByStore,
          expensesByPaymentMethod,
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