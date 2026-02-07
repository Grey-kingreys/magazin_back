import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer un nouveau magasin
   */
  async create(createStoreDto: CreateStoreDto) {
    try {
      const { name, email, phone, address, city } = createStoreDto;

      // Vérifier si un magasin avec ce nom existe déjà
      const existingStore = await this.prisma.store.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingStore) {
        throw new ConflictException(
          `Un magasin avec le nom "${name}" existe déjà`,
        );
      }

      // Vérifier l'email s'il est fourni
      if (email) {
        const storeWithEmail = await this.prisma.store.findFirst({
          where: {
            email: {
              equals: email,
              mode: 'insensitive',
            },
          },
        });

        if (storeWithEmail) {
          throw new ConflictException(
            `Un magasin avec cet email existe déjà`,
          );
        }
      }

      // Créer le magasin
      const store = await this.prisma.store.create({
        data: {
          name: name.trim(),
          email: email?.trim().toLowerCase() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
              sales: true,
            },
          },
        },
      });

      return {
        data: store,
        message: 'Magasin créé avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      console.error('Erreur lors de la création du magasin:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la création du magasin',
      );
    }
  }

  /**
   * Récupérer tous les magasins avec pagination et filtres
   */
  async findAll(
    page = 1,
    limit = 50,
    search?: string,
    isActive?: boolean,
    city?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      // Construction de la clause where
      const where: any = {};

      // Filtre de recherche
      if (search) {
        where.OR = [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            city: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            address: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ];
      }

      // Filtre par statut actif/inactif
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // Filtre par ville
      if (city) {
        where.city = {
          equals: city,
          mode: 'insensitive',
        };
      }

      // Récupération des magasins avec comptage
      const [stores, total] = await Promise.all([
        this.prisma.store.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          include: {
            _count: {
              select: {
                users: true,
                stocks: true,
                sales: true,
              },
            },
          },
        }),
        this.prisma.store.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          stores,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${stores.length} magasin(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des magasins:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des magasins',
      );
    }
  }

  /**
   * Récupérer un magasin par son ID
   */
  async findOne(id: string) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
              sales: true,
              cashRegisters: true,
              stockMovements: true,
              expenses: true,
            },
          },
        },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${id}" non trouvé`,
        );
      }

      return {
        data: store,
        message: 'Magasin trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Erreur lors de la récupération du magasin:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du magasin',
      );
    }
  }

  /**
   * Mettre à jour un magasin
   */
  async update(id: string, updateStoreDto: UpdateStoreDto) {
    try {
      // Vérifier que le magasin existe
      const existingStore = await this.prisma.store.findUnique({
        where: { id },
      });

      if (!existingStore) {
        throw new NotFoundException(
          `Magasin avec l'ID "${id}" non trouvé`,
        );
      }

      // Si le nom est modifié, vérifier qu'il n'existe pas déjà
      if (updateStoreDto.name) {
        const storeWithSameName = await this.prisma.store.findFirst({
          where: {
            name: {
              equals: updateStoreDto.name,
              mode: 'insensitive',
            },
            NOT: {
              id,
            },
          },
        });

        if (storeWithSameName) {
          throw new ConflictException(
            `Un autre magasin avec le nom "${updateStoreDto.name}" existe déjà`,
          );
        }
      }

      // Si l'email est modifié, vérifier qu'il n'existe pas déjà
      if (updateStoreDto.email) {
        const storeWithSameEmail = await this.prisma.store.findFirst({
          where: {
            email: {
              equals: updateStoreDto.email,
              mode: 'insensitive',
            },
            NOT: {
              id,
            },
          },
        });

        if (storeWithSameEmail) {
          throw new ConflictException(`Cet email est déjà utilisé`);
        }
      }

      // Mettre à jour le magasin
      const updatedStore = await this.prisma.store.update({
        where: { id },
        data: {
          name: updateStoreDto.name?.trim(),
          email: updateStoreDto.email?.trim().toLowerCase() || undefined,
          phone: updateStoreDto.phone?.trim() || undefined,
          address: updateStoreDto.address?.trim() || undefined,
          city: updateStoreDto.city?.trim() || undefined,
        },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
              sales: true,
            },
          },
        },
      });

      return {
        data: updatedStore,
        message: 'Magasin mis à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour du magasin:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour du magasin',
      );
    }
  }

  /**
   * Activer/Désactiver un magasin
   */
  async toggleActive(id: string) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${id}" non trouvé`,
        );
      }

      const updatedStore = await this.prisma.store.update({
        where: { id },
        data: {
          isActive: !store.isActive,
        },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
              sales: true,
            },
          },
        },
      });

      return {
        data: updatedStore,
        message: `Magasin ${updatedStore.isActive ? 'activé' : 'désactivé'} avec succès`,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors du changement de statut du magasin:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors du changement de statut',
      );
    }
  }

  /**
   * Supprimer un magasin
   */
  async remove(id: string) {
    try {
      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
              sales: true,
              cashRegisters: true,
              stockMovements: true,
              expenses: true,
            },
          },
        },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${id}" non trouvé`,
        );
      }

      // Vérifier qu'il n'a pas de données associées
      const totalRelations =
        store._count.users +
        store._count.stocks +
        store._count.sales +
        store._count.cashRegisters +
        store._count.stockMovements +
        store._count.expenses;

      if (totalRelations > 0) {
        const details: string[] = [];
        if (store._count.users > 0)
          details.push(`${store._count.users} utilisateur(s)`);
        if (store._count.stocks > 0)
          details.push(`${store._count.stocks} stock(s)`);
        if (store._count.sales > 0)
          details.push(`${store._count.sales} vente(s)`);
        if (store._count.cashRegisters > 0)
          details.push(`${store._count.cashRegisters} caisse(s)`);
        if (store._count.stockMovements > 0)
          details.push(`${store._count.stockMovements} mouvement(s)`);
        if (store._count.expenses > 0)
          details.push(`${store._count.expenses} dépense(s)`);

        throw new ConflictException(
          `Impossible de supprimer ce magasin car il contient : ${details.join(', ')}. Veuillez d'abord supprimer ou réaffecter ces éléments.`,
        );
      }

      // Supprimer le magasin
      await this.prisma.store.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Magasin supprimé avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression du magasin:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la suppression du magasin',
      );
    }
  }

  /**
   * Récupérer tous les utilisateurs d'un magasin
   */
  async getUsers(id: string, page = 1, limit = 20) {
    try {
      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${id}" non trouvé`,
        );
      }

      const skip = (page - 1) * limit;

      // Récupérer les utilisateurs avec pagination
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            storeId: id,
          },
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        this.prisma.user.count({
          where: {
            storeId: id,
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          store,
          users,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${users.length} utilisateur(s) trouvé(s) dans le magasin "${store.name}"`,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors de la récupération des utilisateurs du magasin:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des utilisateurs',
      );
    }
  }

  /**
   * Récupérer tous les stocks d'un magasin
   */
  async getStocks(id: string, page = 1, limit = 50) {
    try {
      // Vérifier que le magasin existe
      const store = await this.prisma.store.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });

      if (!store) {
        throw new NotFoundException(
          `Magasin avec l'ID "${id}" non trouvé`,
        );
      }

      const skip = (page - 1) * limit;

      // Récupérer les stocks avec pagination
      const [stocks, total] = await Promise.all([
        this.prisma.stock.findMany({
          where: {
            storeId: id,
          },
          skip,
          take: limit,
          orderBy: {
            product: {
              name: 'asc',
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                sellingPrice: true,
                minStock: true,
                unit: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.stock.count({
          where: {
            storeId: id,
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Calculer les stocks faibles
      const lowStockCount = stocks.filter(
        (stock) => stock.quantity <= stock.product.minStock,
      ).length;

      return {
        data: {
          store,
          stocks,
          lowStockCount,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${stocks.length} stock(s) trouvé(s) dans le magasin "${store.name}"`,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors de la récupération des stocks du magasin:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des stocks',
      );
    }
  }

  /**
   * Récupérer des statistiques sur les magasins
   */
  async getStats() {
    try {
      const [
        totalStores,
        activeStores,
        inactiveStores,
        storesWithUsers,
        storesWithStocks,
        topStores,
      ] = await Promise.all([
        // Total de magasins
        this.prisma.store.count(),

        // Magasins actifs
        this.prisma.store.count({
          where: {
            isActive: true,
          },
        }),

        // Magasins inactifs
        this.prisma.store.count({
          where: {
            isActive: false,
          },
        }),

        // Magasins avec au moins 1 utilisateur
        this.prisma.store.count({
          where: {
            users: {
              some: {},
            },
          },
        }),

        // Magasins avec au moins 1 stock
        this.prisma.store.count({
          where: {
            stocks: {
              some: {},
            },
          },
        }),

        // Top 5 magasins par nombre de ventes
        this.prisma.store.findMany({
          take: 5,
          where: {
            isActive: true,
          },
          orderBy: {
            sales: {
              _count: 'desc',
            },
          },
          select: {
            id: true,
            name: true,
            city: true,
            _count: {
              select: {
                users: true,
                stocks: true,
                sales: true,
              },
            },
          },
        }),
      ]);

      return {
        data: {
          totalStores,
          activeStores,
          inactiveStores,
          storesWithUsers,
          storesWithStocks,
          storesWithoutUsers: totalStores - storesWithUsers,
          storesWithoutStocks: totalStores - storesWithStocks,
          topStores,
        },
        message: 'Statistiques des magasins récupérées',
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

  /**
   * Récupérer les villes uniques des magasins
   */
  async getCities() {
    try {
      const stores = await this.prisma.store.findMany({
        where: {
          city: {
            not: null,
          },
        },
        select: {
          city: true,
        },
        distinct: ['city'],
        orderBy: {
          city: 'asc',
        },
      });

      const cities = stores
        .map((s) => s.city)
        .filter((city): city is string => city !== null);

      return {
        data: cities,
        message: `${cities.length} ville(s) trouvée(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des villes:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des villes',
      );
    }
  }
}