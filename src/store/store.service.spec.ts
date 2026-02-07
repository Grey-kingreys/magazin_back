import { Test, TestingModule } from '@nestjs/testing';
import { StoreService } from './store.service';
import { PrismaService } from 'src/common/services/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('StoreService', () => {
    let service: StoreService;
    let prisma: PrismaService;

    const mockPrismaService = {
        store: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        user: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        stock: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StoreService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<StoreService>(StoreService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('devrait créer un magasin avec succès', async () => {
            const createDto = {
                name: 'Magasin Central',
                email: 'central@magasin.com',
                phone: '+224 622 00 00 00',
                address: '123 Avenue de la République',
                city: 'Conakry',
            };

            const mockStore = {
                id: '1',
                ...createDto,
                email: 'central@magasin.com',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { users: 0, stocks: 0, sales: 0 },
            };

            mockPrismaService.store.findFirst.mockResolvedValue(null);
            mockPrismaService.store.create.mockResolvedValue(mockStore);

            const result = await service.create(createDto);

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Magasin Central');
            expect(mockPrismaService.store.create).toHaveBeenCalled();
        });

        it('devrait lancer une erreur si le nom existe déjà', async () => {
            const createDto = {
                name: 'Magasin Central',
                email: 'central@magasin.com',
            };

            const existingStore = {
                id: '1',
                name: 'Magasin Central',
                email: 'other@email.com',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.store.findFirst.mockResolvedValue(existingStore);

            await expect(service.create(createDto)).rejects.toThrow(
                ConflictException,
            );
        });

        it("devrait lancer une erreur si l'email existe déjà", async () => {
            const createDto = {
                name: 'Nouveau Magasin',
                email: 'central@magasin.com',
            };

            mockPrismaService.store.findFirst
                .mockResolvedValueOnce(null) // Pas de nom existant
                .mockResolvedValueOnce({
                    // Email existant
                    id: '1',
                    name: 'Magasin Central',
                    email: 'central@magasin.com',
                });

            await expect(service.create(createDto)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    describe('findAll', () => {
        it('devrait retourner tous les magasins avec pagination', async () => {
            const mockStores = [
                {
                    id: '1',
                    name: 'Magasin Central',
                    email: 'central@magasin.com',
                    phone: '+224 622 00 00 00',
                    address: '123 Avenue',
                    city: 'Conakry',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { users: 3, stocks: 50, sales: 100 },
                },
            ];

            mockPrismaService.store.findMany.mockResolvedValue(mockStores);
            mockPrismaService.store.count.mockResolvedValue(1);

            const result = await service.findAll(1, 50);

            expect(result.success).toBe(true);
            expect(result.data.stores).toHaveLength(1);
        });

        it('devrait filtrer par recherche', async () => {
            mockPrismaService.store.findMany.mockResolvedValue([]);
            mockPrismaService.store.count.mockResolvedValue(0);

            await service.findAll(1, 50, 'Central');

            expect(mockPrismaService.store.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.any(Array),
                    }),
                }),
            );
        });

        it('devrait filtrer par statut actif', async () => {
            mockPrismaService.store.findMany.mockResolvedValue([]);
            mockPrismaService.store.count.mockResolvedValue(0);

            await service.findAll(1, 50, undefined, true);

            expect(mockPrismaService.store.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isActive: true,
                    }),
                }),
            );
        });

        it('devrait filtrer par ville', async () => {
            mockPrismaService.store.findMany.mockResolvedValue([]);
            mockPrismaService.store.count.mockResolvedValue(0);

            await service.findAll(1, 50, undefined, undefined, 'Conakry');

            expect(mockPrismaService.store.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        city: expect.objectContaining({
                            equals: 'Conakry',
                        }),
                    }),
                }),
            );
        });
    });

    describe('findOne', () => {
        it('devrait retourner un magasin par ID', async () => {
            const mockStore = {
                id: '1',
                name: 'Magasin Central',
                email: 'central@magasin.com',
                phone: '+224 622 00 00 00',
                address: '123 Avenue',
                city: 'Conakry',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: {
                    users: 3,
                    stocks: 50,
                    sales: 100,
                    cashRegisters: 2,
                    stockMovements: 200,
                    expenses: 10,
                },
            };

            mockPrismaService.store.findUnique.mockResolvedValue(mockStore);

            const result = await service.findOne('1');

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Magasin Central');
        });

        it("devrait lancer une erreur si le magasin n'existe pas", async () => {
            mockPrismaService.store.findUnique.mockResolvedValue(null);

            await expect(service.findOne('999')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('update', () => {
        it('devrait mettre à jour un magasin', async () => {
            const updateDto = {
                name: 'Magasin Central Rénové',
            };

            const existingStore = {
                id: '1',
                name: 'Magasin Central',
                email: 'central@magasin.com',
                isActive: true,
            };

            const updatedStore = {
                ...existingStore,
                name: 'Magasin Central Rénové',
                _count: { users: 3, stocks: 50, sales: 100 },
            };

            mockPrismaService.store.findUnique.mockResolvedValue(existingStore);
            mockPrismaService.store.findFirst.mockResolvedValue(null);
            mockPrismaService.store.update.mockResolvedValue(updatedStore);

            const result = await service.update('1', updateDto);

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Magasin Central Rénové');
        });

        it("devrait lancer une erreur si le magasin n'existe pas", async () => {
            mockPrismaService.store.findUnique.mockResolvedValue(null);

            await expect(service.update('999', { name: 'Test' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('devrait lancer une erreur si le nouveau nom existe déjà', async () => {
            const existingStore = {
                id: '1',
                name: 'Magasin Central',
                email: 'central@magasin.com',
            };

            const storeWithSameName = {
                id: '2',
                name: 'Magasin Sud',
                email: 'sud@magasin.com',
            };

            mockPrismaService.store.findUnique.mockResolvedValue(existingStore);
            mockPrismaService.store.findFirst.mockResolvedValue(
                storeWithSameName,
            );

            await expect(
                service.update('1', { name: 'Magasin Sud' }),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('toggleActive', () => {
        it('devrait activer/désactiver un magasin', async () => {
            const store = {
                id: '1',
                name: 'Magasin Central',
                isActive: true,
            };

            const toggledStore = {
                ...store,
                isActive: false,
                _count: { users: 3, stocks: 50, sales: 100 },
            };

            mockPrismaService.store.findUnique.mockResolvedValue(store);
            mockPrismaService.store.update.mockResolvedValue(toggledStore);

            const result = await service.toggleActive('1');

            expect(result.success).toBe(true);
            expect(result.data.isActive).toBe(false);
        });

        it("devrait lancer une erreur si le magasin n'existe pas", async () => {
            mockPrismaService.store.findUnique.mockResolvedValue(null);

            await expect(service.toggleActive('999')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('remove', () => {
        it('devrait supprimer un magasin sans données associées', async () => {
            const mockStore = {
                id: '1',
                name: 'Magasin Central',
                _count: {
                    users: 0,
                    stocks: 0,
                    sales: 0,
                    cashRegisters: 0,
                    stockMovements: 0,
                    expenses: 0,
                },
            };

            mockPrismaService.store.findUnique.mockResolvedValue(mockStore);
            mockPrismaService.store.delete.mockResolvedValue(mockStore);

            const result = await service.remove('1');

            expect(result.success).toBe(true);
            expect(mockPrismaService.store.delete).toHaveBeenCalled();
        });

        it('devrait lancer une erreur si le magasin a des utilisateurs', async () => {
            const mockStore = {
                id: '1',
                name: 'Magasin Central',
                _count: {
                    users: 3,
                    stocks: 0,
                    sales: 0,
                    cashRegisters: 0,
                    stockMovements: 0,
                    expenses: 0,
                },
            };

            mockPrismaService.store.findUnique.mockResolvedValue(mockStore);

            await expect(service.remove('1')).rejects.toThrow(ConflictException);
            expect(mockPrismaService.store.delete).not.toHaveBeenCalled();
        });

        it('devrait lancer une erreur si le magasin a des stocks', async () => {
            const mockStore = {
                id: '1',
                name: 'Magasin Central',
                _count: {
                    users: 0,
                    stocks: 50,
                    sales: 0,
                    cashRegisters: 0,
                    stockMovements: 0,
                    expenses: 0,
                },
            };

            mockPrismaService.store.findUnique.mockResolvedValue(mockStore);

            await expect(service.remove('1')).rejects.toThrow(ConflictException);
        });

        it("devrait lancer une erreur si le magasin n'existe pas", async () => {
            mockPrismaService.store.findUnique.mockResolvedValue(null);

            await expect(service.remove('999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getUsers', () => {
        it("devrait retourner les utilisateurs d'un magasin", async () => {
            const mockStore = {
                id: '1',
                name: 'Magasin Central',
            };

            const mockUsers = [
                {
                    id: '1',
                    name: 'John Doe',
                    email: 'john@example.com',
                    role: 'CASHIER',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ];

            mockPrismaService.store.findUnique.mockResolvedValue(mockStore);
            mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
            mockPrismaService.user.count.mockResolvedValue(1);

            const result = await service.getUsers('1', 1, 20);

            expect(result.success).toBe(true);
            expect(result.data.users).toHaveLength(1);
            expect(result.data.store.name).toBe('Magasin Central');
        });

        it("devrait lancer une erreur si le magasin n'existe pas", async () => {
            mockPrismaService.store.findUnique.mockResolvedValue(null);

            await expect(service.getUsers('999', 1, 20)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getStocks', () => {
        it("devrait retourner les stocks d'un magasin", async () => {
            const mockStore = {
                id: '1',
                name: 'Magasin Central',
            };

            const mockStocks = [
                {
                    id: '1',
                    productId: '1',
                    storeId: '1',
                    quantity: 50,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    product: {
                        id: '1',
                        name: 'iPhone 15',
                        sku: 'IPH-15',
                        barcode: '123456',
                        sellingPrice: 1000,
                        minStock: 10,
                        unit: 'pièce',
                        category: {
                            id: '1',
                            name: 'Électronique',
                        },
                    },
                },
            ];

            mockPrismaService.store.findUnique.mockResolvedValue(mockStore);
            mockPrismaService.stock.findMany.mockResolvedValue(mockStocks);
            mockPrismaService.stock.count.mockResolvedValue(1);

            const result = await service.getStocks('1', 1, 50);

            expect(result.success).toBe(true);
            expect(result.data.stocks).toHaveLength(1);
            expect(result.data.store.name).toBe('Magasin Central');
        });

        it("devrait lancer une erreur si le magasin n'existe pas", async () => {
            mockPrismaService.store.findUnique.mockResolvedValue(null);

            await expect(service.getStocks('999', 1, 50)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getStats', () => {
        it('devrait retourner les statistiques des magasins', async () => {
            mockPrismaService.store.count
                .mockResolvedValueOnce(10) // Total
                .mockResolvedValueOnce(8) // Actifs
                .mockResolvedValueOnce(2) // Inactifs
                .mockResolvedValueOnce(6) // Avec utilisateurs
                .mockResolvedValueOnce(7); // Avec stocks

            mockPrismaService.store.findMany.mockResolvedValue([
                {
                    id: '1',
                    name: 'Magasin Central',
                    city: 'Conakry',
                    _count: { users: 5, stocks: 100, sales: 500 },
                },
            ]);

            const result = await service.getStats();

            expect(result.success).toBe(true);
            expect(result.data.totalStores).toBe(10);
            expect(result.data.activeStores).toBe(8);
            expect(result.data.inactiveStores).toBe(2);
            expect(result.data.storesWithUsers).toBe(6);
            expect(result.data.storesWithStocks).toBe(7);
        });
    });

    describe('getCities', () => {
        it('devrait retourner les villes uniques', async () => {
            const mockStores = [
                { city: 'Conakry' },
                { city: 'Kankan' },
                { city: 'Labé' },
            ];

            mockPrismaService.store.findMany.mockResolvedValue(mockStores);

            const result = await service.getCities();

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data).toContain('Conakry');
        });
    });
});