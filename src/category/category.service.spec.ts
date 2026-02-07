import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';

describe('CategoryService', () => {
    let service: CategoryService;
    let prisma: PrismaService;

    const mockPrismaService = {
        category: {
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
                CategoryService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<CategoryService>(CategoryService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('devrait créer une catégorie avec succès', async () => {
            const createDto = {
                name: 'Électronique',
                description: 'Appareils électroniques',
            };

            const mockCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { products: 0 },
            };

            mockPrismaService.category.findFirst.mockResolvedValue(null);
            mockPrismaService.category.create.mockResolvedValue(mockCategory);

            const result = await service.create(createDto);

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Électronique');
            expect(mockPrismaService.category.findFirst).toHaveBeenCalledWith({
                where: {
                    name: {
                        equals: 'Électronique',
                        mode: 'insensitive',
                    },
                },
            });
            expect(mockPrismaService.category.create).toHaveBeenCalled();
        });

        it('devrait lancer une erreur si la catégorie existe déjà', async () => {
            const createDto = {
                name: 'Électronique',
                description: 'Appareils électroniques',
            };

            const existingCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.category.findFirst.mockResolvedValue(existingCategory);

            await expect(service.create(createDto)).rejects.toThrow(
                ConflictException,
            );
            expect(mockPrismaService.category.create).not.toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('devrait retourner toutes les catégories avec pagination', async () => {
            const mockCategories = [
                {
                    id: '1',
                    name: 'Électronique',
                    description: 'Appareils électroniques',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { products: 5 },
                },
                {
                    id: '2',
                    name: 'Vêtements',
                    description: 'Vêtements et accessoires',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { products: 10 },
                },
            ];

            mockPrismaService.category.findMany.mockResolvedValue(mockCategories);
            mockPrismaService.category.count.mockResolvedValue(2);

            const result = await service.findAll(1, 50);

            expect(result.success).toBe(true);
            expect(result.data.categories).toHaveLength(2);
            expect(result.data.pagination.total).toBe(2);
            expect(result.data.pagination.page).toBe(1);
        });

        it('devrait filtrer les catégories par recherche', async () => {
            const mockCategories = [
                {
                    id: '1',
                    name: 'Électronique',
                    description: 'Appareils électroniques',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    _count: { products: 5 },
                },
            ];

            mockPrismaService.category.findMany.mockResolvedValue(mockCategories);
            mockPrismaService.category.count.mockResolvedValue(1);

            const result = await service.findAll(1, 50, 'électro');

            expect(result.success).toBe(true);
            expect(result.data.categories).toHaveLength(1);
            expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: expect.any(Array),
                    },
                }),
            );
        });
    });

    describe('findOne', () => {
        it('devrait retourner une catégorie par ID', async () => {
            const mockCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { products: 5 },
                products: [],
            };

            mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

            const result = await service.findOne('1');

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Électronique');
            expect(mockPrismaService.category.findUnique).toHaveBeenCalledWith({
                where: { id: '1' },
                include: expect.any(Object),
            });
        });

        it('devrait lancer une erreur si la catégorie n\'existe pas', async () => {
            mockPrismaService.category.findUnique.mockResolvedValue(null);

            await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('update', () => {
        it('devrait mettre à jour une catégorie', async () => {
            const updateDto = {
                name: 'Électronique Moderne',
            };

            const existingCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedCategory = {
                ...existingCategory,
                name: 'Électronique Moderne',
                _count: { products: 5 },
            };

            mockPrismaService.category.findUnique.mockResolvedValue(
                existingCategory,
            );
            mockPrismaService.category.findFirst.mockResolvedValue(null);
            mockPrismaService.category.update.mockResolvedValue(updatedCategory);

            const result = await service.update('1', updateDto);

            expect(result.success).toBe(true);
            expect(result.data.name).toBe('Électronique Moderne');
        });

        it('devrait lancer une erreur si la catégorie n\'existe pas', async () => {
            mockPrismaService.category.findUnique.mockResolvedValue(null);

            await expect(service.update('999', { name: 'Test' })).rejects.toThrow(
                NotFoundException,
            );
        });

        it('devrait lancer une erreur si le nouveau nom existe déjà', async () => {
            const existingCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const categoryWithSameName = {
                id: '2',
                name: 'Vêtements',
                description: 'Vêtements et accessoires',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrismaService.category.findUnique.mockResolvedValue(
                existingCategory,
            );
            mockPrismaService.category.findFirst.mockResolvedValue(
                categoryWithSameName,
            );

            await expect(
                service.update('1', { name: 'Vêtements' }),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('remove', () => {
        it('devrait supprimer une catégorie sans produits', async () => {
            const mockCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { products: 0 },
            };

            mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
            mockPrismaService.category.delete.mockResolvedValue(mockCategory);

            const result = await service.remove('1');

            expect(result.success).toBe(true);
            expect(result.data.id).toBe('1');
            expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
                where: { id: '1' },
            });
        });

        it('devrait lancer une erreur si la catégorie contient des produits', async () => {
            const mockCategory = {
                id: '1',
                name: 'Électronique',
                description: 'Appareils électroniques',
                createdAt: new Date(),
                updatedAt: new Date(),
                _count: { products: 5 },
            };

            mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);

            await expect(service.remove('1')).rejects.toThrow(ConflictException);
            expect(mockPrismaService.category.delete).not.toHaveBeenCalled();
        });

        it('devrait lancer une erreur si la catégorie n\'existe pas', async () => {
            mockPrismaService.category.findUnique.mockResolvedValue(null);

            await expect(service.remove('999')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getProducts', () => {
        it('devrait retourner les produits d\'une catégorie', async () => {
            const mockCategory = {
                id: '1',
                name: 'Électronique',
            };

            const mockProducts = [
                {
                    id: '1',
                    name: 'iPhone 15',
                    sku: 'IPH-15-BLK',
                    barcode: '1234567890',
                    costPrice: 800,
                    sellingPrice: 1000,
                    minStock: 5,
                    unit: 'pièce',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    supplier: {
                        id: '1',
                        name: 'Apple Inc.',
                    },
                },
            ];

            mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
            mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
            mockPrismaService.product.count.mockResolvedValue(1);

            const result = await service.getProducts('1', 1, 20);

            expect(result.success).toBe(true);
            expect(result.data.products).toHaveLength(1);
            expect(result.data.category.name).toBe('Électronique');
        });

        it('devrait lancer une erreur si la catégorie n\'existe pas', async () => {
            mockPrismaService.category.findUnique.mockResolvedValue(null);

            await expect(service.getProducts('999', 1, 20)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getStats', () => {
        it('devrait retourner les statistiques des catégories', async () => {
            const mockTopCategories = [
                {
                    id: '1',
                    name: 'Électronique',
                    _count: { products: 10 },
                },
                {
                    id: '2',
                    name: 'Vêtements',
                    _count: { products: 8 },
                },
            ];

            mockPrismaService.category.count
                .mockResolvedValueOnce(5) // Total de catégories
                .mockResolvedValueOnce(3); // Catégories avec produits

            mockPrismaService.category.findMany.mockResolvedValue(mockTopCategories);

            const result = await service.getStats();

            expect(result.success).toBe(true);
            expect(result.data.totalCategories).toBe(5);
            expect(result.data.categoriesWithProducts).toBe(3);
            expect(result.data.emptyCategories).toBe(2);
            expect(result.data.topCategories).toHaveLength(2);
        });
    });
});