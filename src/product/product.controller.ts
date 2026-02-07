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
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Produits')
@Controller('product')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  /**
   * Créer un nouveau produit
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Créer un produit',
    description: 'Crée un nouveau produit avec SKU et code-barres uniques',
  })
  @ApiResponse({
    status: 201,
    description: 'Produit créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou catégorie/fournisseur inexistant',
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
    status: 409,
    description: 'Un produit avec ce SKU ou code-barres existe déjà',
  })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  /**
   * Récupérer tous les produits
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Liste des produits',
    description:
      'Récupère la liste de tous les produits avec pagination et filtres',
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
    description: 'Rechercher dans nom, description, SKU ou code-barres',
    example: 'iPhone',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filtrer par catégorie',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiQuery({
    name: 'supplierId',
    required: false,
    description: 'Filtrer par fournisseur',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filtrer par statut actif/inactif',
    example: true,
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    description: 'Afficher uniquement les produits en stock faible',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des produits récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('isActive', new DefaultValuePipe(undefined))
    isActive?: boolean,
    @Query('lowStock', new DefaultValuePipe(false), ParseBoolPipe)
    lowStock?: boolean,
  ) {
    return this.productService.findAll(
      page,
      limit,
      search,
      categoryId,
      supplierId,
      isActive,
      lowStock,
    );
  }

  /**
   * Récupérer les statistiques des produits
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des produits',
    description: 'Récupère des statistiques globales sur les produits',
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
    return this.productService.getStats();
  }

  /**
   * Récupérer les produits en stock faible
   */
  @Get('low-stock')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Produits en stock faible',
    description:
      "Récupère tous les produits dont le stock total est inférieur ou égal au seuil d'alerte",
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
  @ApiResponse({
    status: 200,
    description: 'Produits en stock faible récupérés',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getLowStockProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.productService.getLowStockProducts(page, limit);
  }

  /**
   * Rechercher un produit par code-barres
   */
  @Get('barcode/:barcode')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Rechercher par code-barres',
    description: 'Recherche un produit par son code-barres',
  })
  @ApiParam({
    name: 'barcode',
    description: 'Code-barres du produit',
    example: '0194253777564',
  })
  @ApiResponse({
    status: 200,
    description: 'Produit trouvé',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit non trouvé',
  })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.productService.findByBarcode(barcode);
  }

  /**
   * Rechercher un produit par SKU
   */
  @Get('sku/:sku')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Rechercher par SKU',
    description: 'Recherche un produit par son SKU',
  })
  @ApiParam({
    name: 'sku',
    description: 'SKU du produit',
    example: 'IPH-15-PM-256-BLK',
  })
  @ApiResponse({
    status: 200,
    description: 'Produit trouvé',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit non trouvé',
  })
  findBySku(@Param('sku') sku: string) {
    return this.productService.findBySku(sku);
  }

  /**
   * Récupérer un produit par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: "Détails d'un produit",
    description: "Récupère les détails d'un produit spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Produit trouvé',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit non trouvé',
  })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  /**
   * Mettre à jour un produit
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Modifier un produit',
    description: "Met à jour les informations d'un produit",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Produit mis à jour avec succès',
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
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Produit non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Un autre produit avec ce SKU ou code-barres existe déjà',
  })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  /**
   * Activer/Désactiver un produit
   */
  @Patch(':id/toggle-active')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Activer/Désactiver un produit',
    description: 'Change le statut actif/inactif du produit',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Statut du produit changé avec succès',
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
    description: 'Produit non trouvé',
  })
  toggleActive(@Param('id') id: string) {
    return this.productService.toggleActive(id);
  }

  /**
   * Supprimer un produit
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer un produit',
    description:
      'Supprime un produit (uniquement si pas de ventes ni de mouvements de stock)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Produit supprimé avec succès',
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
    description: 'Produit non trouvé',
  })
  @ApiResponse({
    status: 409,
    description:
      'Impossible de supprimer un produit avec des ventes ou mouvements de stock',
  })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}