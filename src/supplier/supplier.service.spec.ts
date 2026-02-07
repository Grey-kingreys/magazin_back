import { Test, TestingModule } from '@nestjs/testing';
import { SupplierService } from './supplier.service';
import { PrismaService } from 'src/common/services/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('SupplierService', () => {
    let service: SupplierService;
    let prisma: PrismaService;

    const mockPrismaService = {
        supplier: {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        product: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SupplierService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<SupplierService>(SupplierService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('devrait créer un fournisseur avec succès', async () => {
            const createDto = {
                name: 'Apple Inc.',
                email: 'contact@apple.com',
                phone: '+1 408 996 1010',
                address: '1 Apple Park Way',
                city: 'Cupertino',
                country: 'USA',
                taxId: 'US123456789',
            };

            const mockSupplier = {
                id: '1',
                ...createDto,
                email: 'contact@apple.com',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { products: 0 },
            };

            mockPrismaService.supplier.findFirst.mockResolvedValue(null);
            mockPrismaService.supplier.create.mockResolvedValue(mockSupplier);

            const result = await service.create(createDto);

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Apple Inc.');
            expect(mockPrismaService.supplier.create).toHaveBeenCalled();
        });

        it('devrait lancer une erreur si le nom existe déjà', async () => {
            const createDto = {
                name: 'Apple Inc.',
                email: 'contact@apple.com',
            };

            const existingSupplier = {
                id: '1',
                name: 'Apple Inc.',
                email: 'other@email.com',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.supplier.findFirst.mockResolvedValue(
                existingSupplier,
            );

            await expect(service.create(createDto)).rejects.toThrow(
                ConflictException,
            );
        });

        it("devrait lancer une erreur si l'email existe déjà", async () => {
            const createDto = {
                name: 'Samsung',
                email: 'contact@apple.com',
            };

            mockPrismaService.supplier.findFirst
                .mockResolvedValueOnce(null) // Pas de nom existant
                .mockResolvedValueOnce({
                    // Email existant
                    id: '1',
                    name: 'Apple Inc.',
                    email: 'contact@apple.com',
                });

            await expect(service.create(createDto)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    describe('findAll', () => {
        it('devrait retourner tous les fournisseurs avec pagination', async () => {
            const mockSuppliers = [
                {
                    id: '1',
                    name: 'Apple Inc.',
                    email: 'contact@apple.com',
                    phone: '+1 408 996 1010',
                    address: '1 Apple Park Way',
                    city: 'Cupertino',
                    country: 'USA',
                    taxId: 'US123456789',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { products: 10 },
                },
            ];

            mockPrismaService.supplier.findMany.mockResolvedValue(mockSuppliers);
            mockPrismaService.supplier.count.mockResolvedValue(1);

            const result = await service.findAll(1, 50);

            expect(result.success).toBe(true);
            expect(result.data.suppliers).toHaveLength(1);
        });

        it('devrait filtrer par recherche', async () => {
            mockPrismaService.supplier.findMany.mockResolvedValue([]);
            mockPrismaService.supplier.count.mockResolvedValue(0);

            await service.findAll(1, 50, 'Apple');

            expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        OR: expect.any(Array),
                    }),
                }),
            );
        });

        it('devrait filtrer par statut actif', async () => {
            mockPrismaService.supplier.findMany.mockResolvedValue([]);
            mockPrismaService.supplier.count.mockResolvedValue(0);

            await service.findAll(1, 50, undefined, true);

            expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        isActive: true,
                    }),
                }),
            );
        });
    });

    describe('findOne', () => {
        it('devrait retourner un fournisseur par ID', async () => {
            const mockSupplier = {
                id: '1',
                name: 'Apple Inc.',
                email: 'contact@apple.com',
                phone: '+1 408 996 1010',
                address: '1 Apple Park Way',
                city: 'Cupertino',
                country: 'USA',
                taxId: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { products: 10 },
                products: [],
            };

            mockPrismaService.supplier.findUnique.mockResolvedValue(mockSupplier);

            const result = await service.findOne('1');

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Apple Inc.');
        });

        it("devrait lancer une erreur si le fournisseur n'existe pas", async () => {
            mockPrismaService.supplier.findUnique.mockResolvedValue(null);

            await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        it('devrait mettre à jour un fournisseur', async () => {
            const updateDto = {
                name: 'Apple Corporation',
            };

            const existingSupplier = {
                id: '1',
                name: 'Apple Inc.',
                email: 'contact@apple.com',
                isActive: true,
            };

            const updatedSupplier = {
                ...existingSupplier,
                name: 'Apple Corporation',
                _count: { products: 10 },
            };

            mockPrismaService.supplier.findUnique.mockResolvedValue(
                existingSupplier,
            );
            mockPrismaService.supplier.findFirst.mockResolvedValue(null);
            mockPrismaService.supplier.update.mockResolvedValue(updatedSupplier);

            const result = await service.update('1', updateDto);

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Apple Corporation');
        });

        it("devrait lancer une erreur si le fournisseur n'existe pas", async () => {
            mockPrismaService.supplier.findUnique.mockResolvedValue(null);

            await expect(service.update('999', { name: 'Test' })).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('toggleActive', () => {
        it('devrait activer/désactiver un fournisseur', async () => {
            const supplier = {
                id: '1',
                name: 'Apple Inc.',
                isActive: true,
            };

            const toggledSupplier = {
                ...supplier,
                isActive: false,
                _count: { products: 10 },
            };

            mockPrismaService.supplier.findUnique.mockResolvedValue(supplier);
            mockPrismaService.supplier.update.mockResolvedValue(toggledSupplier);

            const result = await service.toggleActive('1');

            expect(result.success).toBe(true);
            expect(result.data.isActive).toBe(false);
        });
    });

    describe('remove', () => {
        it('devrait supprimer un fournisseur sans produits', async () => {
            const mockSupplier = {
                id: '1',
                name: 'Apple Inc.',
                _count: { products: 0 },
            };

            mockPrismaService.supplier.findUnique.mockResolvedValue(mockSupplier);
            mockPrismaService.supplier.delete.mockResolvedValue(mockSupplier);

            const result = await service.remove('1');

            expect(result.success).toBe(true);
            expect(mockPrismaService.supplier.delete).toHaveBeenCalled();
        });

        it('devrait lancer une erreur si le fournisseur a des produits', async () => {
            const mockSupplier = {
                id: '1',
                name: 'Apple Inc.',
                _count: { products: 5 },
            };

            mockPrismaService.supplier.findUnique.mockResolvedValue(mockSupplier);

            await expect(service.remove('1')).rejects.toThrow(ConflictException);
            expect(mockPrismaService.supplier.delete).not.toHaveBeenCalled();
        });
    });

    describe('getStats', () => {
        it('devrait retourner les statistiques des fournisseurs', async () => {
            mockPrismaService.supplier.count
                .mockResolvedValueOnce(10) // Total
                .mockResolvedValueOnce(8) // Actifs
                .mockResolvedValueOnce(2) // Inactifs
                .mockResolvedValueOnce(6); // Avec produits

            mockPrismaService.supplier.findMany.mockResolvedValue([]);

            const result = await service.getStats();

            expect(result.success).toBe(true);
            expect(result.data.totalSuppliers).toBe(10);
            expect(result.data.activeSuppliers).toBe(8);
            expect(result.data.inactiveSuppliers).toBe(2);
        });
    });

    describe('getCities', () => {
        it('devrait retourner les villes uniques', async () => {
            const mockSuppliers = [
                { city: 'Conakry' },
                { city: 'Paris' },
                { city: 'New York' },
            ];

            mockPrismaService.supplier.findMany.mockResolvedValue(mockSuppliers);

            const result = await service.getCities();

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data).toContain('Conakry');
        });
    });

    describe('getCountries', () => {
        it('devrait retourner les pays uniques', async () => {
            const mockSuppliers = [
                { country: 'Guinée' },
                { country: 'France' },
                { country: 'USA' },
            ];

            mockPrismaService.supplier.findMany.mockResolvedValue(mockSuppliers);

            const result = await service.getCountries();

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data).toContain('Guinée');
        });
    });
});