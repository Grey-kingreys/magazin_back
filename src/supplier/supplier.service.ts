import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/services/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Créer un nouveau fournisseur
   */
  async create(createSupplierDto: CreateSupplierDto) {
    try {
      const { name, email, phone, address, city, country, taxId } =
        createSupplierDto;

      // Vérifier si un fournisseur avec ce nom existe déjà
      const existingSupplier = await this.prisma.supplier.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existingSupplier) {
        throw new ConflictException(
          `Un fournisseur avec le nom "${name}" existe déjà`,
        );
      }

      // Vérifier l'email s'il est fourni
      if (email) {
        const supplierWithEmail = await this.prisma.supplier.findFirst({
          where: {
            email: {
              equals: email,
              mode: 'insensitive',
            },
          },
        });

        if (supplierWithEmail) {
          throw new ConflictException(
            `Un fournisseur avec cet email existe déjà`,
          );
        }
      }

      // Créer le fournisseur
      const supplier = await this.prisma.supplier.create({
        data: {
          name: name.trim(),
          email: email?.trim().toLowerCase() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          country: country?.trim() || null,
          taxId: taxId?.trim() || null,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      return {
        data: supplier,
        message: 'Fournisseur créé avec succès',
        success: true,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      console.error('Erreur lors de la création du fournisseur:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la création du fournisseur',
      );
    }
  }

  /**
   * Récupérer tous les fournisseurs avec pagination et filtres
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

      // ⭐ FILTRAGE PAR RÔLE ET MAGASIN
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        // Récupérer le magasin de l'utilisateur
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { storeId: true },
        });

        if (!user?.storeId) {
          return {
            data: {
              suppliers: [],
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

        // STORE_MANAGER et CASHIER voient uniquement les fournisseurs
        // qui ont des produits en stock dans leur magasin
        where.products = {
          some: {
            stocks: {
              some: {
                storeId: user.storeId,
              },
            },
          },
        };
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
        ];
      }

      // Filtre par statut
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [suppliers, total] = await Promise.all([
        this.prisma.supplier.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          include: {
            _count: {
              select: {
                products: true,
                purchases: true,
              },
            },
          },
        }),
        this.prisma.supplier.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          suppliers,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${suppliers.length} fournisseur(s) trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des fournisseurs:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des fournisseurs',
      );
    }
  }


  /**
   * Récupérer un fournisseur par son ID
   */
  async findOne(id: string, userId?: string, userRole?: string) {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          products: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  stocks: true,
                },
              },
            },
          },
          _count: {
            select: {
              purchases: true,
            },
          },
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      // ⭐ VÉRIFICATION DES PERMISSIONS
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { storeId: true },
        });

        if (!user?.storeId) {
          throw new ForbiddenException('Aucun magasin assigné à votre compte');
        }

        // Vérifier que le fournisseur a des produits en stock dans le magasin de l'utilisateur
        const hasProductsInUserStore = await this.prisma.product.findFirst({
          where: {
            supplierId: id,
            stocks: {
              some: {
                storeId: user.storeId,
              },
            },
          },
        });

        if (!hasProductsInUserStore) {
          throw new ForbiddenException(
            'Vous n\'avez pas la permission de consulter ce fournisseur',
          );
        }

        // Filtrer les produits pour ne montrer que ceux en stock dans son magasin
        supplier.products = supplier.products.filter((product) =>
          product._count.stocks > 0
        );
      }

      return {
        data: supplier,
        message: 'Fournisseur trouvé',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('Erreur lors de la récupération du fournisseur:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération du fournisseur',
      );
    }
  }

  /**
   * Mettre à jour un fournisseur
   */
  async update(
    id: string,
    updateSupplierDto: UpdateSupplierDto,
    userId: string,
    userRole: string,
  ) {
    try {
      const existingSupplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!existingSupplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      // ⭐ VÉRIFICATION DES PERMISSIONS
      if (userRole === 'STORE_MANAGER') {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { storeId: true },
        });

        if (!user?.storeId) {
          throw new ForbiddenException('Aucun magasin assigné à votre compte');
        }

        // Vérifier que le fournisseur a des produits en stock dans le magasin
        const hasProductsInUserStore = await this.prisma.product.findFirst({
          where: {
            supplierId: id,
            stocks: {
              some: {
                storeId: user.storeId,
              },
            },
          },
        });

        if (!hasProductsInUserStore) {
          throw new ForbiddenException(
            'Vous ne pouvez modifier que les fournisseurs liés à votre magasin',
          );
        }
      } else if (userRole === 'CASHIER') {
        throw new ForbiddenException(
          'Vous n\'avez pas la permission de modifier un fournisseur',
        );
      }

      // Si le nom est modifié, vérifier qu'il n'existe pas déjà
      if (updateSupplierDto.name) {
        const supplierWithSameName = await this.prisma.supplier.findFirst({
          where: {
            name: {
              equals: updateSupplierDto.name,
              mode: 'insensitive',
            },
            NOT: {
              id,
            },
          },
        });

        if (supplierWithSameName) {
          throw new ConflictException(
            `Un autre fournisseur avec le nom "${updateSupplierDto.name}" existe déjà`,
          );
        }
      }

      // Si l'email est modifié, vérifier qu'il n'existe pas déjà
      if (updateSupplierDto.email) {
        const supplierWithSameEmail = await this.prisma.supplier.findFirst({
          where: {
            email: {
              equals: updateSupplierDto.email,
              mode: 'insensitive',
            },
            NOT: {
              id,
            },
          },
        });

        if (supplierWithSameEmail) {
          throw new ConflictException(
            `Un autre fournisseur avec l'email "${updateSupplierDto.email}" existe déjà`,
          );
        }
      }

      const updatedSupplier = await this.prisma.supplier.update({
        where: { id },
        data: {
          name: updateSupplierDto.name?.trim(),
          phone: updateSupplierDto.phone?.trim() || undefined,
          email: updateSupplierDto.email?.trim().toLowerCase() || undefined,
          address: updateSupplierDto.address?.trim() || undefined,
        },
        include: {
          _count: {
            select: {
              products: true,
              purchases: true,
            },
          },
        },
      });

      return {
        data: updatedSupplier,
        message: 'Fournisseur mis à jour avec succès',
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

      console.error('Erreur lors de la mise à jour du fournisseur:', error);
      throw new BadRequestException(
        error.message ||
        'Une erreur est survenue lors de la mise à jour du fournisseur',
      );
    }
  }

  /**
   * Activer/Désactiver un fournisseur
   */
  async toggleActive(id: string, userId: string, userRole: string) {
    try {
      // ⭐ VÉRIFICATION: Seuls ADMIN et MANAGER peuvent activer/désactiver
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
        throw new ForbiddenException(
          'Seuls les administrateurs et managers peuvent activer/désactiver un fournisseur',
        );
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      const updatedSupplier = await this.prisma.supplier.update({
        where: { id },
        data: {
          isActive: !supplier.isActive,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      return {
        data: updatedSupplier,
        message: `Fournisseur ${updatedSupplier.isActive ? 'activé' : 'désactivé'} avec succès`,
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error(
        'Erreur lors du changement de statut du fournisseur:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors du changement de statut',
      );
    }
  }

  /**
   * Supprimer un fournisseur (soft delete via isActive)
   */
  async remove(id: string, userId: string, userRole: string) {
    try {
      // ⭐ VÉRIFICATION DU RÔLE ADMIN
      if (userRole !== 'ADMIN') {
        throw new ForbiddenException(
          'Seuls les administrateurs peuvent supprimer un fournisseur',
        );
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
              purchases: true,
            },
          },
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      // Vérifier qu'il n'a pas de produits associés
      if (supplier._count.products > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce fournisseur car ${supplier._count.products} produit(s) lui sont associés`,
        );
      }

      // Vérifier qu'il n'a pas d'achats
      if (supplier._count.purchases > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce fournisseur car il a ${supplier._count.purchases} achat(s) associé(s)`,
        );
      }

      await this.prisma.supplier.delete({
        where: { id },
      });

      return {
        data: { id },
        message: 'Fournisseur supprimé avec succès',
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

      console.error('Erreur lors de la suppression du fournisseur:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la suppression du fournisseur',
      );
    }
  }

  /**
   * Récupérer tous les produits d'un fournisseur
   */
  async getProducts(id: string, page = 1, limit = 20) {
    try {
      // Vérifier que le fournisseur existe
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      const skip = (page - 1) * limit;

      // Récupérer les produits avec pagination
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            supplierId: id,
          },
          skip,
          take: limit,
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            description: true,
            sku: true,
            barcode: true,
            costPrice: true,
            sellingPrice: true,
            minStock: true,
            unit: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        this.prisma.product.count({
          where: {
            supplierId: id,
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: {
          supplier,
          products,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        message: `${products.length} produit(s) trouvé(s) pour le fournisseur "${supplier.name}"`,
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        'Erreur lors de la récupération des produits du fournisseur:',
        error,
      );
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des produits',
      );
    }
  }

  /**
   * Récupérer des statistiques sur les fournisseurs
   */
  async getStats() {
    try {
      const [
        totalSuppliers,
        activeSuppliers,
        inactiveSuppliers,
        suppliersWithProducts,
        topSuppliers,
      ] = await Promise.all([
        // Total de fournisseurs
        this.prisma.supplier.count(),

        // Fournisseurs actifs
        this.prisma.supplier.count({
          where: {
            isActive: true,
          },
        }),

        // Fournisseurs inactifs
        this.prisma.supplier.count({
          where: {
            isActive: false,
          },
        }),

        // Fournisseurs avec au moins 1 produit
        this.prisma.supplier.count({
          where: {
            products: {
              some: {},
            },
          },
        }),

        // Top 5 fournisseurs par nombre de produits
        this.prisma.supplier.findMany({
          take: 5,
          where: {
            isActive: true,
          },
          orderBy: {
            products: {
              _count: 'desc',
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            country: true,
            _count: {
              select: {
                products: true,
              },
            },
          },
        }),
      ]);

      return {
        data: {
          totalSuppliers,
          activeSuppliers,
          inactiveSuppliers,
          suppliersWithProducts,
          suppliersWithoutProducts:
            totalSuppliers - suppliersWithProducts,
          topSuppliers,
        },
        message: 'Statistiques des fournisseurs récupérées',
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
   * Récupérer les villes uniques des fournisseurs
   */
  async getCities() {
    try {
      const suppliers = await this.prisma.supplier.findMany({
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

      const cities = suppliers
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

  /**
   * Récupérer les pays uniques des fournisseurs
   */
  async getCountries() {
    try {
      const suppliers = await this.prisma.supplier.findMany({
        where: {
          country: {
            not: null,
          },
        },
        select: {
          country: true,
        },
        distinct: ['country'],
        orderBy: {
          country: 'asc',
        },
      });

      const countries = suppliers
        .map((s) => s.country)
        .filter((country): country is string => country !== null);

      return {
        data: countries,
        message: `${countries.length} pays trouvé(s)`,
        success: true,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des pays:', error);
      throw new BadRequestException(
        'Une erreur est survenue lors de la récupération des pays',
      );
    }
  }
}