import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { StoreFinanceService } from 'src/common/services/store-finance.service';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeFinance: StoreFinanceService
  ) { }

  /**
 * Ouvrir une nouvelle caisse
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

      // GESTION DU FONDS DE CAISSE
      if (openingAmount > 0) {
        const hasBalance = await this.storeFinance.checkBalance(storeId, openingAmount);
        if (!hasBalance) {
          const currentBalance = await this.storeFinance.getBalance(storeId);
          throw new BadRequestException(
            `Solde insuffisant au magasin "${store.name}" pour le fonds de caisse. ` +
            `Disponible: ${currentBalance.toLocaleString()} GNF, ` +
            `Requis: ${openingAmount.toLocaleString()} GNF`
          );
        }

        // Débiter le magasin pour le fonds de caisse
        await this.storeFinance.debitStore(
          storeId,
          userId,
          openingAmount,
          'CASH_REGISTER_OPEN',
          `Fonds de caisse pour ouverture`,
          "",
        );
      }

      // Vérifier qu'il n'y a pas déjà une caisse ouverte pour ce magasin
      const existingOpenCashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          storeId,
          status: 'OPEN',
        },
      });

      if (existingOpenCashRegister) {
        throw new ConflictException(
          `Une caisse est déjà ouverte pour le magasin "${store.name}". Fermez-la avant d'en ouvrir une nouvelle.`,
        );
      }

      // Vérifier qu'il n'y a pas déjà une caisse ouverte pour cet utilisateur
      const userOpenCashRegister = await this.prisma.cashRegister.findFirst({
        where: {
          userId,
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

      // Mettre à jour la référence de la transaction
      if (openingAmount > 0) {
        await this.prisma.storeTransaction.updateMany({
          where: {
            storeId,
            userId,
            category: 'CASH_REGISTER_OPEN',
            reference: null,
            createdAt: {
              gte: new Date(Date.now() - 60000),
            },
          },
          data: {
            reference: cashRegister.id,
            description: `Fonds de caisse pour ouverture #${cashRegister.id}`,
          },
        });
      }

      return {
        data: cashRegister,
        message: `Caisse ouverte avec succès au magasin "${store.name}"`,
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
   */
  async close(id: string, closeCashRegisterDto: CloseCashRegisterDto) {
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

      // Calculer le montant théorique (availableAmount devrait être à jour)
      const expectedAmount = cashRegister.availableAmount;

      // Calculer la différence
      const difference = closingAmount - expectedAmount;

      // GESTION DU TRANSFERT VERS LE MAGASIN
      let transferMessage = '';
      const excessAmount = closingAmount - cashRegister.openingAmount;

      if (excessAmount > 0) {
        transferMessage = `L'excédent de ${excessAmount.toLocaleString()} GNF reste dans la trésorerie du magasin.`;
      } else if (excessAmount < 0) {
        transferMessage = `ATTENTION: Manque de ${Math.abs(excessAmount).toLocaleString()} GNF par rapport à l'ouverture.`;
      }

      if (difference > 0) {
        transferMessage += ` Excédent de caisse: +${difference.toLocaleString()} GNF.`;
      } else if (difference < 0) {
        transferMessage += ` Manque de caisse: ${difference.toLocaleString()} GNF.`;
      }

      // Fermer la caisse
      const closedCashRegister = await this.prisma.cashRegister.update({
        where: { id },
        data: {
          closingAmount,
          expectedAmount, // Maintenant égal à availableAmount
          difference,
          status: 'CLOSED',
          closedAt: new Date(),
          notes: notes
            ? `${cashRegister.notes || ''}\n\nFermeture: ${notes}\n${transferMessage}`.trim()
            : `${cashRegister.notes || ''}\n\n${transferMessage}`.trim(),
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
      let message = `Caisse fermée avec succès au magasin "${cashRegister.store.name}". ${transferMessage}`;
      if (difference !== 0) {
        const diffType = difference > 0 ? 'excédent' : 'manque';
        const diffAmount = Math.abs(difference);
        message += ` ${diffType.charAt(0).toUpperCase() + diffType.slice(1)} de ${diffAmount} GNF détecté.`;

        console.warn(
          `⚠️ Différence de caisse détectée: ${difference > 0 ? '+' : ''}${difference} GNF`,
        );
      }

      return {
        data: {
          ...closedCashRegister,
          stats: {
            totalSales: cashRegister.availableAmount - cashRegister.openingAmount,
            salesCount: cashRegister.sales.length,
            cashSalesTotal: cashRegister.availableAmount - cashRegister.openingAmount,
            expectedAmount,
            difference,
            excessAmount,
          },
        },
        message,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
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

      // Construction de la clause where
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
  * Mettre à jour une caisse ouverte
  */
  async update(id: string, updateCashRegisterDto: UpdateCashRegisterDto, userId: string) {
    try {
      const { openingAmount, notes, availableAmount } = updateCashRegisterDto;

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
        throw new BadRequestException('Impossible de modifier une caisse fermée');
      }

      if (cashRegister.userId !== userId) {
        throw new BadRequestException(
          'Vous ne pouvez modifier que votre propre caisse ouverte',
        );
      }

      const updateData: any = {};
      let operationMessage = '';
      let adjustmentAmount = 0;

      // GESTION DU CHANGEMENT DE FONDS DE CAISSE
      if (openingAmount !== undefined && openingAmount !== cashRegister.openingAmount) {
        adjustmentAmount = openingAmount - cashRegister.openingAmount;

        if (adjustmentAmount > 0) {
          // Ajout de fonds - débiter le magasin
          const hasBalance = await this.storeFinance.checkBalance(cashRegister.storeId, adjustmentAmount);
          if (!hasBalance) {
            const currentBalance = await this.storeFinance.getBalance(cashRegister.storeId);
            throw new BadRequestException(
              `Solde insuffisant au magasin "${cashRegister.store.name}" pour augmenter le fonds de caisse. ` +
              `Disponible: ${currentBalance.toLocaleString()} GNF, ` +
              `Requis: ${adjustmentAmount.toLocaleString()} GNF`
            );
          }

          await this.storeFinance.debitStore(
            cashRegister.storeId,
            userId,
            adjustmentAmount,
            'CASH_REGISTER_ADJUSTMENT',
            `Ajustement fonds de caisse #${id} - Augmentation`,
            id,
          );

          operationMessage = `Fonds de caisse augmenté de ${adjustmentAmount.toLocaleString()} GNF. `;

          // ⭐ Mettre à jour availableAmount aussi
          updateData.availableAmount = cashRegister.availableAmount + adjustmentAmount;
        } else if (adjustmentAmount < 0) {
          // Retrait de fonds - créditer le magasin
          await this.storeFinance.creditStore(
            cashRegister.storeId,
            userId,
            Math.abs(adjustmentAmount),
            'CASH_REGISTER_ADJUSTMENT',
            `Ajustement fonds de caisse #${id} - Diminution`,
            id,
          );

          operationMessage = `Fonds de caisse diminué de ${Math.abs(adjustmentAmount).toLocaleString()} GNF. `;

          // ⭐ Mettre à jour availableAmount aussi (mais vérifier qu'on ne retire pas plus que disponible)
          const newAvailableAmount = cashRegister.availableAmount + adjustmentAmount; // adjustmentAmount est négatif
          if (newAvailableAmount < 0) {
            throw new BadRequestException(
              `Impossible de retirer plus que le montant disponible. Disponible: ${cashRegister.availableAmount.toLocaleString()} GNF`
            );
          }
          updateData.availableAmount = newAvailableAmount;
        }

        updateData.openingAmount = openingAmount;
      }

      // GESTION DU CHANGEMENT DIRECT DU MONTANT DISPONIBLE
      if (availableAmount !== undefined && availableAmount !== cashRegister.availableAmount) {
        const availableAdjustment = availableAmount - cashRegister.availableAmount;

        // Mettre à jour availableAmount directement
        if (availableAdjustment > 0) {
          // Ajout d'argent dans la caisse - débiter le magasin
          const hasBalance = await this.storeFinance.checkBalance(cashRegister.storeId, availableAdjustment);
          if (!hasBalance) {
            const currentBalance = await this.storeFinance.getBalance(cashRegister.storeId);
            throw new BadRequestException(
              `Solde insuffisant au magasin "${cashRegister.store.name}" pour ajouter de l'argent à la caisse. ` +
              `Disponible: ${currentBalance.toLocaleString()} GNF, ` +
              `Requis: ${availableAdjustment.toLocaleString()} GNF`
            );
          }

          await this.storeFinance.debitStore(
            cashRegister.storeId,
            userId,
            availableAdjustment,
            'CASH_REGISTER_ADJUSTMENT',
            `Ajustement montant disponible #${id} - Augmentation`,
            id,
          );

          operationMessage += `Montant disponible augmenté de ${availableAdjustment.toLocaleString()} GNF. `;
        } else if (availableAdjustment < 0) {
          // Retrait d'argent de la caisse - créditer le magasin
          await this.storeFinance.creditStore(
            cashRegister.storeId,
            userId,
            Math.abs(availableAdjustment),
            'CASH_REGISTER_ADJUSTMENT',
            `Ajustement montant disponible #${id} - Diminution`,
            id,
          );

          operationMessage += `Montant disponible diminué de ${Math.abs(availableAdjustment).toLocaleString()} GNF. `;
        }

        updateData.availableAmount = availableAmount;
      }

      // Mise à jour des notes
      if (notes !== undefined) {
        updateData.notes = notes;
        if (adjustmentAmount !== 0 || (availableAmount !== undefined && availableAmount !== cashRegister.availableAmount)) {
          updateData.notes = `${cashRegister.notes || ''}\n\n${new Date().toLocaleString()}: ${notes} (${operationMessage})`.trim();
        }
      }

      // Si aucune mise à jour n'est demandée, retourner une erreur
      if (Object.keys(updateData).length === 0) {
        throw new BadRequestException(
          'Aucune donnée à mettre à jour',
        );
      }

      // Mettre à jour la caisse
      const updatedCashRegister = await this.prisma.cashRegister.update({
        where: { id },
        data: updateData,
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

      // Calculer les statistiques en temps réel
      const cashSalesTotal = updatedCashRegister.sales
        .filter((sale) => sale.paymentMethod === 'CASH')
        .reduce((sum, sale) => sum + sale.total, 0);

      const totalRevenue = updatedCashRegister.sales.reduce(
        (sum, sale) => sum + sale.total,
        0,
      );

      return {
        data: {
          ...updatedCashRegister,
          stats: {
            totalRevenue,
            salesCount: updatedCashRegister.sales.length,
            expectedAmount: updatedCashRegister.availableAmount, // ⭐ Utiliser availableAmount
            cashSalesTotal,
            adjustmentAmount,
          },
        },
        message: `Caisse mise à jour avec succès. ${operationMessage || ''}`.trim(),
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
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

      // Calculer les statistiques
      const completedSales = cashRegister.sales.filter(
        (sale) => sale.status === 'COMPLETED',
      );

      const totalRevenue = completedSales.reduce(
        (sum, sale) => sum + sale.total,
        0,
      );

      const cashSalesTotal = completedSales
        .filter((sale) => sale.paymentMethod === 'CASH')
        .reduce((sum, sale) => sum + sale.total, 0);

      return {
        data: {
          ...cashRegister,
          stats: {
            totalSales: totalRevenue,
            salesCount: completedSales.length,
            cashSalesTotal,
            expectedAmount: cashRegister.availableAmount, // ⭐ Utiliser availableAmount
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

      // Calculer les statistiques en temps réel
      const cashSalesTotal = cashRegister.sales
        .filter((sale) => sale.paymentMethod === 'CASH')
        .reduce((sum, sale) => sum + sale.total, 0);

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
            expectedAmount: cashRegister.availableAmount, // ⭐ Utiliser availableAmount
            cashSalesTotal,
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
          // Total de caisses
          this.prisma.cashRegister.count({ where }),

          // Caisses ouvertes
          this.prisma.cashRegister.count({
            where: {
              ...where,
              status: 'OPEN',
            },
          }),

          // Caisses fermées
          this.prisma.cashRegister.count({
            where: {
              ...where,
              status: 'CLOSED',
            },
          }),

          // Toutes les caisses fermées pour calculs
          this.prisma.cashRegister.findMany({
            where: {
              ...where,
              status: 'CLOSED',
            },
            select: {
              openingAmount: true,
              closingAmount: true,
              difference: true,
              availableAmount: true,
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
          }),
        ]);

      // Calculer les statistiques financières
      let totalOpeningAmount = 0;
      let totalClosingAmount = 0;
      let totalDifference = 0;
      let totalCashSales = 0;
      let totalNonCashSales = 0;
      let positiveDiscrepancies = 0;
      let negativeDiscrepancies = 0;

      for (const cashRegister of allCashRegisters) {
        if (cashRegister.openingAmount) totalOpeningAmount += cashRegister.openingAmount;
        if (cashRegister.closingAmount) totalClosingAmount += cashRegister.closingAmount;
        if (cashRegister.difference) {
          totalDifference += cashRegister.difference;
          if (cashRegister.difference > 0) {
            positiveDiscrepancies++;
          } else if (cashRegister.difference < 0) {
            negativeDiscrepancies++;
          }
        }

        // Calculer les ventes
        for (const sale of cashRegister.sales) {
          if (sale.paymentMethod === 'CASH') {
            totalCashSales += sale.total;
          } else {
            totalNonCashSales += sale.total;
          }
        }
      }

      return {
        data: {
          totalCashRegisters,
          openCashRegisters,
          closedCashRegisters,
          totalOpeningAmount: Math.round(totalOpeningAmount),
          totalClosingAmount: Math.round(totalClosingAmount),
          totalDifference: Math.round(totalDifference),
          totalCashSales: Math.round(totalCashSales),
          totalNonCashSales: Math.round(totalNonCashSales),
          totalSales: Math.round(totalCashSales + totalNonCashSales),
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
          store: {
            select: {
              id: true,
            },
          },
          user: {
            select: {
              id: true,
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

      // REMBOURSER LE FONDS DE CAISSE
      if (cashRegister.openingAmount > 0 && cashRegister.status === 'CLOSED') {
        // Créditer le magasin du fonds de caisse
        await this.storeFinance.creditStore(
          cashRegister.store.id,
          cashRegister.user.id,
          cashRegister.openingAmount,
          'CASH_REGISTER_DELETE',
          `Remboursement fonds de caisse #${id} (suppression)`,
          id,
        );
      }

      // REMBOURSER LE MONTANT DISPONIBLE S'IL Y EN A
      if (cashRegister.availableAmount > 0 && cashRegister.status === 'CLOSED') {
        await this.storeFinance.creditStore(
          cashRegister.store.id,
          cashRegister.user.id,
          cashRegister.availableAmount - cashRegister.openingAmount,
          'CASH_REGISTER_DELETE',
          `Remboursement montant disponible #${id} (suppression)`,
          id,
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

  /**
   * Vérifier si une caisse ouverte existe pour un magasin donné
   */
  async findOpenCashRegisterByStore(storeId: string, userId?: string) {
    try {
      const where: any = {
        storeId,
        status: 'OPEN',
      };

      if (userId) {
        where.userId = userId;
      }

      const cashRegister = await this.prisma.cashRegister.findFirst({
        where,
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
        },
      });

      return cashRegister;
    } catch (error) {
      console.error('Erreur lors de la recherche de la caisse ouverte:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la recherche de la caisse ouverte',
      );
    }
  }
}