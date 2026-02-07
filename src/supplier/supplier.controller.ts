import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Fournisseurs')
@Controller('supplier')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) { }

  /**
   * Créer un nouveau fournisseur
   */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Créer un fournisseur',
    description: 'Crée un nouveau fournisseur',
  })
  @ApiResponse({
    status: 201,
    description: 'Fournisseur créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  @ApiResponse({
    status: 409,
    description: 'Un fournisseur avec ce nom ou cet email existe déjà',
  })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.supplierService.create(createSupplierDto);
  }

  /**
   * Récupérer tous les fournisseurs
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des fournisseurs',
    description:
      'Récupère la liste de tous les fournisseurs avec pagination et filtres',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de la page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page",
    example: 50,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Rechercher dans nom, email, téléphone ou ville',
    example: 'Apple',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filtrer par statut actif/inactif',
    example: true,
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description: 'Filtrer par ville',
    example: 'Conakry',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'Filtrer par pays',
    example: 'Guinée',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des fournisseurs récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('isActive', new DefaultValuePipe(undefined))
    isActive?: boolean,
    @Query('city') city?: string,
    @Query('country') country?: string,
  ) {
    return this.supplierService.findAll(
      page,
      limit,
      search,
      isActive,
      city,
      country,
    );
  }

  /**
   * Récupérer les statistiques des fournisseurs
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des fournisseurs',
    description: 'Récupère des statistiques globales sur les fournisseurs',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  getStats() {
    return this.supplierService.getStats();
  }

  /**
   * Récupérer les villes uniques
   */
  @Get('cities')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des villes',
    description: 'Récupère la liste unique des villes des fournisseurs',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des villes récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getCities() {
    return this.supplierService.getCities();
  }

  /**
   * Récupérer les pays uniques
   */
  @Get('countries')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des pays',
    description: 'Récupère la liste unique des pays des fournisseurs',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des pays récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getCountries() {
    return this.supplierService.getCountries();
  }

  /**
   * Récupérer un fournisseur par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Détails d'un fournisseur",
    description: "Récupère les détails d'un fournisseur spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du fournisseur',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Fournisseur trouvé',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé',
  })
  findOne(@Param('id') id: string) {
    return this.supplierService.findOne(id);
  }

  /**
   * Récupérer les produits d'un fournisseur
   */
  @Get(':id/products')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Produits d'un fournisseur",
    description: "Récupère tous les produits d'un fournisseur avec pagination",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du fournisseur',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de la page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page",
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Produits du fournisseur récupérés',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé',
  })
  getProducts(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.supplierService.getProducts(id, page, limit);
  }

  /**
   * Mettre à jour un fournisseur
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Modifier un fournisseur',
    description: "Met à jour les informations d'un fournisseur",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du fournisseur',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Fournisseur mis à jour avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Un autre fournisseur avec ce nom ou cet email existe déjà',
  })
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(id, updateSupplierDto);
  }

  /**
   * Activer/Désactiver un fournisseur
   */
  @Patch(':id/toggle-active')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Activer/Désactiver un fournisseur',
    description: 'Change le statut actif/inactif du fournisseur',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du fournisseur',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Statut du fournisseur changé avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé',
  })
  toggleActive(@Param('id') id: string) {
    return this.supplierService.toggleActive(id);
  }

  /**
   * Supprimer un fournisseur
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer un fournisseur',
    description:
      'Supprime un fournisseur (uniquement si aucun produit associé)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du fournisseur',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Fournisseur supprimé avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Impossible de supprimer un fournisseur avec des produits',
  })
  remove(@Param('id') id: string) {
    return this.supplierService.remove(id);
  }
}