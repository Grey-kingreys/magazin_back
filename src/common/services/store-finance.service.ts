import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class StoreFinanceService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Vérifier si un magasin a assez de fonds
     */
    async checkBalance(storeId: string, amount: number): Promise<boolean> {
        const store = await this.prisma.store.findUnique({
            where: { id: storeId },
            select: { balance: true }
        });

        if (!store) {
            throw new BadRequestException(`Magasin ${storeId} introuvable`);
        }

        return store.balance >= amount;
    }

    /**
     * Créditer le compte d'un magasin (ajouter de l'argent)
     */
    async creditStore(
        storeId: string,
        userId: string,
        amount: number,
        category: string,
        description: string,
        reference?: string,
    ) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Récupérer le solde actuel
            const store = await tx.store.findUnique({
                where: { id: storeId },
                select: { balance: true }
            });

            if (!store) {
                throw new BadRequestException(`Magasin ${storeId} introuvable`);
            }

            const balanceBefore = store.balance;
            const balanceAfter = balanceBefore + amount;

            // 2. Mettre à jour le solde
            await tx.store.update({
                where: { id: storeId },
                data: { balance: balanceAfter }
            });

            // 3. Enregistrer la transaction
            const transaction = await tx.storeTransaction.create({
                data: {
                    storeId,
                    userId,
                    type: 'IN',
                    category,
                    amount,
                    balanceBefore,
                    balanceAfter,
                    reference,
                    description
                }
            });

            return { balanceAfter, transaction };
        });
    }

    /**
     * Débiter le compte d'un magasin (retirer de l'argent)
     */
    async debitStore(
        storeId: string,
        userId: string,
        amount: number,
        category: string,
        description: string,
        reference?: string,
    ) {
        return await this.prisma.$transaction(async (tx) => {
            // 1. Récupérer le solde actuel
            const store = await tx.store.findUnique({
                where: { id: storeId },
                select: { balance: true, name: true }
            });

            if (!store) {
                throw new BadRequestException(`Magasin ${storeId} introuvable`);
            }

            const balanceBefore = store.balance;
            const balanceAfter = balanceBefore - amount;

            // 2. Vérifier que le solde est suffisant
            if (balanceAfter < 0) {
                throw new BadRequestException(
                    `Solde insuffisant au magasin "${store.name}". ` +
                    `Disponible: ${balanceBefore.toLocaleString()} GNF, ` +
                    `Requis: ${amount.toLocaleString()} GNF`
                );
            }

            // 3. Mettre à jour le solde
            await tx.store.update({
                where: { id: storeId },
                data: { balance: balanceAfter }
            });

            // 4. Enregistrer la transaction
            const transaction = await tx.storeTransaction.create({
                data: {
                    storeId,
                    userId,
                    type: 'OUT',
                    category,
                    amount,
                    balanceBefore,
                    balanceAfter,
                    reference,
                    description
                }
            });

            return { balanceAfter, transaction };
        });
    }

    /**
     * Obtenir le solde actuel d'un magasin
     */
    async getBalance(storeId: string): Promise<number> {
        const store = await this.prisma.store.findUnique({
            where: { id: storeId },
            select: { balance: true }
        });

        if (!store) {
            throw new BadRequestException(`Magasin ${storeId} introuvable`);
        }

        return store.balance;
    }

    /**
     * Obtenir l'historique des transactions d'un magasin
     */
    async getTransactionHistory(
        storeId: string,
        page = 1,
        limit = 50,
        startDate?: Date,
        endDate?: Date,
    ) {
        const skip = (page - 1) * limit;

        const where: any = { storeId };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [transactions, total] = await Promise.all([
            this.prisma.storeTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            }),
            this.prisma.storeTransaction.count({ where })
        ]);

        return {
            transactions,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}