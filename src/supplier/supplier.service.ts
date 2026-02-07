import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
    city?: string,
    country?: string,
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

      // Filtre par pays
      if (country) {
        where.country = {
          equals: country,
          mode: 'insensitive',
        };
      }

      // Récupération des fournisseurs avec comptage
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
  async findOne(id: string) {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
          products: {
            take: 10, // Limiter à 10 produits pour la vue détaillée
            select: {
              id: true,
              name: true,
              sku: true,
              costPrice: true,
              sellingPrice: true,
              isActive: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      return {
        data: supplier,
        message: 'Fournisseur trouvé',
        success: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
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
  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    try {
      // Vérifier que le fournisseur existe
      const existingSupplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!existingSupplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
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
          throw new ConflictException(`Cet email est déjà utilisé`);
        }
      }

      // Mettre à jour le fournisseur
      const updatedSupplier = await this.prisma.supplier.update({
        where: { id },
        data: {
          name: updateSupplierDto.name?.trim(),
          email: updateSupplierDto.email?.trim().toLowerCase() || undefined,
          phone: updateSupplierDto.phone?.trim() || undefined,
          address: updateSupplierDto.address?.trim() || undefined,
          city: updateSupplierDto.city?.trim() || undefined,
          country: updateSupplierDto.country?.trim() || undefined,
          taxId: updateSupplierDto.taxId?.trim() || undefined,
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
        message: 'Fournisseur mis à jour avec succès',
        success: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
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
  async toggleActive(id: string) {
    try {
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
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(
        "Erreur lors du changement de statut du fournisseur:",
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
  async remove(id: string) {
    try {
      // Vérifier que le fournisseur existe
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          `Fournisseur avec l'ID "${id}" non trouvé`,
        );
      }

      // Vérifier qu'il n'a pas de produits actifs associés
      if (supplier._count.products > 0) {
        throw new ConflictException(
          `Impossible de supprimer ce fournisseur car il est associé à ${supplier._count.products} produit(s). Veuillez d'abord supprimer ou réaffecter les produits.`,
        );
      }

      // Supprimer le fournisseur (suppression réelle car pas de produits)
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
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error('Erreur lors de la suppression du fournisseur:', error);
      throw new BadRequestException(
        error.message ||
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