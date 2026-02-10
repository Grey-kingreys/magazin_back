import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Ouvrir une nouvelle caisse
   * - Plusieurs caisses peuvent être ouvertes simultanément pour un même magasin
   * - Un utilisateur ne peut avoir qu'une seule caisse ouverte à la fois
   * - La caisse est liée à l'utilisateur qui l'ouvre (traçabilité)
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

      // ⭐ NOUVELLE RÈGLE: Vérifier qu'il n'y a pas déjà une caisse ouverte pour cet utilisateur
      // (sur le magasin en questions)
      const userOpenCashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          userId,
          storeId,
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
          availableAmount: openingAmount, // ⭐ Initialiser availableAmount avec openingAmount
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
        message: `Caisse ouverte avec succès au magasin "${store.name}". Toutes vos transactions seront enregistrées dans cette caisse.`,
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
   * - Compare l'argent disponible (calculé automatiquement) avec l'argent compté
   * - Calcule la différence
   * - Exige un commentaire obligatoire si différence détectée
   */
  async close(id: string, closeCashRegisterDto: CloseCashRegisterDto, userId: string) {
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
          user: {
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

      // ⭐ Vérifier que c'est bien l'utilisateur qui a ouvert la caisse
      if (cashRegister.userId !== userId) {
        throw new ForbiddenException(
          'Vous ne pouvez fermer que votre propre caisse',
        );
      }

      // ⭐ Le montant théorique est maintenant availableAmount (mis à jour automatiquement)
      const expectedAmount = cashRegister.availableAmount;

      // Calculer la différence
      const difference = closingAmount - expectedAmount;

      // ⭐ Si différence détectée et pas de notes, erreur
      if (difference !== 0 && !notes) {
        throw new BadRequestException(
          `Une différence de ${Math.abs(difference).toLocaleString()} GNF a été détectée. ` +
          `Veuillez fournir un commentaire obligatoire pour expliquer cet écart.`
        );
      }

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
        message += `. ⚠️ ${diffType.charAt(0).toUpperCase() + diffType.slice(1)} de ${diffAmount.toLocaleString()} GNF détecté.`;

        console.warn(
          `⚠️ Différence de caisse détectée pour ${cashRegister.user.name}: ${difference > 0 ? '+' : ''}${difference} GNF`,
        );
      } else {
        message += '. ✅ Montant exact, aucune différence détectée.';
      }

      return {
        data: {
          ...closedCashRegister,
          stats: {
            totalSales: cashRegister.sales.reduce((sum, sale) => sum + sale.total, 0),
            salesCount: cashRegister.sales.length,
            expectedAmount,
            difference,
          },
        },
        message,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
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
   * Mettre à jour une caisse (ADMIN uniquement)
   * - Seul l'admin peut modifier
   * - Seul le userId peut être changé (réassignation de caisse)
   */
  async update(id: string, updateCashRegisterDto: UpdateCashRegisterDto, adminUserId: string) {
    try {
      const { userId: newUserId } = updateCashRegisterDto;

      // Récupérer la caisse
      const cashRegister = await this.prisma.cashRegister.findUnique({
        where: { id },
        include: {
          store: true,
          user: {
            select: {
              id: true,
              name: true,
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
        throw new BadRequestException('Impossible de modifier une caisse fermée');
      }

      if (!newUserId) {
        throw new BadRequestException('Le nouvel utilisateur est requis');
      }

      // Vérifier que le nouvel utilisateur existe
      const newUser = await this.prisma.user.findUnique({
        where: { id: newUserId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!newUser) {
        throw new NotFoundException(`Utilisateur avec l'ID "${newUserId}" non trouvé`);
      }

      if (!newUser.isActive) {
        throw new BadRequestException(`L'utilisateur "${newUser.name}" est désactivé`);
      }

      // Vérifier que le nouvel utilisateur n'a pas déjà une caisse ouverte
      const userHasOpenCashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          userId: newUserId,
          status: 'OPEN',
          id: { not: id }, // Exclure la caisse actuelle
        },
      });

      if (userHasOpenCashRegister) {
        throw new ConflictException(
          `L'utilisateur "${newUser.name}" a déjà une caisse ouverte. Il doit la fermer avant d'en ouvrir une autre.`,
        );
      }

      // Mettre à jour la caisse
      const updatedCashRegister = await this.prisma.cashRegister.update({
        where: { id },
        data: {
          userId: newUserId,
          notes: `${cashRegister.notes || ''}\n\n[${new Date().toLocaleString()}] Caisse réassignée de ${cashRegister.user.name} à ${newUser.name} par un administrateur.`.trim(),
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
        data: updatedCashRegister,
        message: `Caisse réassignée avec succès de "${cashRegister.user.name}" à "${newUser.name}"`,
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

      console.error('Erreur lors de la mise à jour de la caisse:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la mise à jour de la caisse',
      );
    }
  }

  /**
   * ⭐ NOUVELLE MÉTHODE: Mettre à jour le montant disponible dans la caisse
   * Appelée automatiquement lors de:
   * - Création d'une vente (+ total de la vente)
   * - Annulation d'une vente (- total de la vente)
   * - Remboursement d'une vente (- total de la vente)
   * - Création d'une dépense (- montant de la dépense)
   * - Annulation d'une dépense (+ montant de la dépense)
   */
  async updateAvailableAmount(
    cashRegisterId: string,
    amount: number,
    operation: 'ADD' | 'SUBTRACT',
    description: string,
  ) {
    try {
      const cashRegister = await this.prisma.cashRegister.findUnique({
        where: { id: cashRegisterId },
        select: {
          id: true,
          availableAmount: true,
          status: true,
        },
      });

      if (!cashRegister) {
        throw new NotFoundException(
          `Caisse avec l'ID "${cashRegisterId}" non trouvée`,
        );
      }

      if (cashRegister.status !== 'OPEN') {
        throw new BadRequestException(
          'Impossible de modifier le montant d\'une caisse fermée',
        );
      }

      const newAvailableAmount =
        operation === 'ADD'
          ? cashRegister.availableAmount + amount
          : cashRegister.availableAmount - amount;

      // Vérifier que le montant ne devient pas négatif
      if (newAvailableAmount < 0) {
        throw new BadRequestException(
          `Opération refusée: le montant disponible deviendrait négatif. ` +
          `Disponible: ${cashRegister.availableAmount.toLocaleString()} GNF, ` +
          `Opération: ${operation === 'ADD' ? '+' : '-'}${amount.toLocaleString()} GNF`
        );
      }

      await this.prisma.cashRegister.update({
        where: { id: cashRegisterId },
        data: {
          availableAmount: newAvailableAmount,
        },
      });

      console.log(
        `✅ Caisse ${cashRegisterId}: ${operation} ${amount.toLocaleString()} GNF - ${description}. ` +
        `Nouveau montant: ${newAvailableAmount.toLocaleString()} GNF`
      );

      return {
        success: true,
        previousAmount: cashRegister.availableAmount,
        newAmount: newAvailableAmount,
        operation,
        amount,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour du montant disponible:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la mise à jour du montant disponible',
      );
    }
  }

  // ... (les autres méthodes restent inchangées: findAll, findOne, findOpenByUser, getStats, remove)

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

      const completedSales = cashRegister.sales.filter(
        (sale) => sale.status === 'COMPLETED',
      );

      const totalRevenue = completedSales.reduce(
        (sum, sale) => sum + sale.total,
        0,
      );

      return {
        data: {
          ...cashRegister,
          stats: {
            totalSales: totalRevenue,
            salesCount: completedSales.length,
            expectedAmount: cashRegister.availableAmount,
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

      const totalRevenue = cashRegister.sales.reduce(
        (sum, sale) => sum + sale.total,
        0,
      );

      return {
        data: {
          ...cashRegister,
          stats: {
            totalRevenue,
            salesCount: cashRegister.sales.length,
            expectedAmount: cashRegister.availableAmount,
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
          this.prisma.cashRegister.count({ where }),
          this.prisma.cashRegister.count({
            where: {
              ...where,
              status: 'OPEN',
            },
          }),
          this.prisma.cashRegister.count({
            where: {
              ...where,
              status: 'CLOSED',
            },
          }),
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