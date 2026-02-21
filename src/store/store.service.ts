import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
   * ⭐ MODIFIÉ: Récupérer tous les magasins avec filtrage par rôle
   */
  async findAll(
    page = 1,
    limit = 50,
    search?: string,
    isActive?: boolean,
    userId?: string,
    userRole?: string,
  ) {
    try {
      const skip = (page - 1) * limit;

      const where: any = {};

      // ⭐ FILTRAGE PAR RÔLE
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        // STORE_MANAGER et CASHIER ne voient que leur magasin
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { storeId: true },
        });

        if (!user?.storeId) {
          // Si l'utilisateur n'a pas de magasin assigné
          return {
            data: {
              stores: [],
              pagination: {
                total: 0,
                page,
                limit,
                totalPages: 0,
                hasMore: false,
              },
            },
            message: 'Aucun magasin assigné à votre compte',
            success: true,
          };
        }

        where.id = user.storeId;
      }

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

      // Filtre par statut
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

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
   * ⭐ MODIFIÉ: Récupérer un magasin par ID avec vérification de permission
   */
  async findOne(id: string, userId?: string, userRole?: string) {
    try {
      const store = await this.prisma.store.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
              sales: true,
              purchases: true,
              expenses: true,
            },
          },
        },
      });

      if (!store) {
        throw new NotFoundException(`Magasin avec l'ID "${id}" non trouvé`);
      }

      // ⭐ VÉRIFICATION DES PERMISSIONS
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { storeId: true },
        });

        if (user?.storeId !== id) {
          throw new ForbiddenException(
            'Vous n\'avez pas la permission de consulter ce magasin',
          );
        }
      }

      return {
        data: store,
        message: 'Magasin trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      console.error('Erreur lors de la récupération du magasin:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du magasin',
      );
    }
  }


  /**
   * ⭐ MODIFIÉ: Mettre à jour un magasin avec vérification de permission
   */
  async update(
    id: string,
    updateStoreDto: UpdateStoreDto,
    userId: string,
    userRole: string,
  ) {
    try {
      const existingStore = await this.prisma.store.findUnique({
        where: { id },
      });

      if (!existingStore) {
        throw new NotFoundException(`Magasin avec l'ID "${id}" non trouvé`);
      }

      // ⭐ VÉRIFICATION DES PERMISSIONS
      if (userRole === 'STORE_MANAGER') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { storeId: true },
        });

        if (user?.storeId !== id) {
          throw new ForbiddenException(
            'Vous ne pouvez modifier que votre propre magasin',
          );
        }
      } else if (userRole === 'CASHIER') {
        throw new ForbiddenException(
          'Vous n\'avez pas la permission de modifier un magasin',
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

      const updatedStore = await this.prisma.store.update({
        where: { id },
        data: {
          name: updateStoreDto.name?.trim(),
          address: updateStoreDto.address?.trim() || undefined,
          city: updateStoreDto.city?.trim() || undefined,
          phone: updateStoreDto.phone?.trim() || undefined,
          email: updateStoreDto.email?.trim().toLowerCase() || undefined,
        },
        include: {
          _count: {
            select: {
              users: true,
              stocks: true,
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
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('Erreur lors de la mise à jour du magasin:', error);
      throw new BadRequestException(
        error.message || 'Une erreur est survenue lors de la mise à jour du magasin',
      );
    }
  }

  /**
   * Activer/Désactiver un magasin
   */
  async toggleActive(id: string, userId: string, userRole: string) {
    try {
      // ⭐ VÉRIFICATION: Seuls ADMIN et MANAGER peuvent activer/désactiver
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new ForbiddenException(
          'Seuls les administrateurs et managers peuvent activer/désactiver un magasin',
        );
      }

      const store = await this.prisma.store.findUnique({
        where: { id },
      });

      if (!store) {
        throw new NotFoundException(`Magasin avec l'ID "${id}" non trouvé`);
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
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      console.error('Erreur lors du changement de statut du magasin:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors du changement de statut',
      );
    }
  }


  /**
   * ⭐ MODIFIÉ: Supprimer un magasin (ADMIN uniquement)
   */
  async remove(id: string, userId: string, userRole: string) {
    try {
      // ⭐ VÉRIFICATION DU RÔLE ADMIN
      if (userRole !== 'ADMIN') {
        throw new ForbiddenException(
          'Seuls les administrateurs peuvent supprimer un magasin',
        );
      }

      const store = await this.prisma.store.findUnique({
        where: { id },
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

      if (!store) {
        throw new NotFoundException(`Magasin avec l'ID "${id}" non trouvé`);
      }

      // Vérifier qu'il n'a pas d'utilisateurs assignés
      if (store._count.users > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce magasin car ${store._count.users} utilisateur(s) y sont assignés`,
        );
      }

      // Vérifier qu'il n'a pas de stocks
      if (store._count.stocks > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce magasin car il contient ${store._count.stocks} stock(s)`,
        );
      }

      // Vérifier qu'il n'a pas de ventes
      if (store._count.sales > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce magasin car il a ${store._count.sales} vente(s) associée(s)`,
        );
      }

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
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression du magasin:', error);
      throw new BadRequestException(
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
  * Récupérer les statistiques des magasins
  */
  async getStats() {
    try {
      const [totalStores, activeStores, inactiveStores, storeStats] =
        await Promise.all([
          this.prisma.store.count(),
          this.prisma.store.count({ where: { isActive: true } }),
          this.prisma.store.count({ where: { isActive: false } }),
          this.prisma.store.findMany({
            select: {
              id: true,
              name: true,
              city: true,
              balance: true,
              _count: {
                select: {
                  users: true,
                  stocks: true,
                  sales: true,
                },
              },
            },
            orderBy: {
              name: 'asc',
            },
          }),
        ]);

      return {
        data: {
          totalStores,
          activeStores,
          inactiveStores,
          storeStats,
        },
        message: 'Statistiques des magasins récupérées',
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
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