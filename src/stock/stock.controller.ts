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
import { StockService } from './stock.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Stocks')
@Controller('stock')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class StockController {
  constructor(private readonly stockService: StockService) { }

  /**
   * Créer un nouveau stock
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Créer un stock',
    description: 'Initialise le stock d\'un produit dans un magasin',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou produit/magasin inexistant ou désactivé',
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
    description: 'Un stock existe déjà pour ce produit dans ce magasin',
  })
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  /**
   * Récupérer tous les stocks
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Liste des stocks',
    description: 'Récupère la liste de tous les stocks avec pagination et filtres',
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
    description: 'Nombre d\'éléments par page',
    example: 50,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Rechercher dans nom du produit, SKU ou code-barres',
    example: 'iPhone',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filtrer par produit',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    description: 'Afficher uniquement les stocks faibles',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des stocks récupérée',
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
    @Query('storeId') storeId?: string,
    @Query('productId') productId?: string,
    @Query('lowStock', new DefaultValuePipe(false), ParseBoolPipe)
    lowStock?: boolean,
  ) {
    return this.stockService.findAll(
      page,
      limit,
      search,
      storeId,
      productId,
      lowStock,
    );
  }

  /**
   * Récupérer les statistiques des stocks
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des stocks',
    description: 'Récupère des statistiques globales sur les stocks',
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
    return this.stockService.getStats();
  }

  /**
   * Récupérer les stocks faibles
   */
  @Get('low-stock')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Stocks faibles',
    description: 'Récupère tous les stocks dont la quantité est inférieure ou égale au seuil d\'alerte',
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
    description: 'Nombre d\'éléments par page',
    example: 50,
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Stocks faibles récupérés',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getLowStocks(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('storeId') storeId?: string,
  ) {
    return this.stockService.getLowStocks(page, limit, storeId);
  }

  /**
   * Récupérer les stocks d'un magasin
   */
  @Get('store/:storeId')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Stocks par magasin',
    description: 'Récupère tous les stocks d\'un magasin spécifique',
  })
  @ApiParam({
    name: 'storeId',
    description: 'ID du magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
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
    description: 'Nombre d\'éléments par page',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Stocks du magasin récupérés',
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
    description: 'Magasin non trouvé',
  })
  getStocksByStore(
    @Param('storeId') storeId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.stockService.getStocksByStore(storeId, page, limit);
  }

  /**
   * Récupérer le stock d'un produit dans un magasin
   */
  @Get('product/:productId/store/:storeId')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Stock d\'un produit dans un magasin',
    description: 'Récupère le stock d\'un produit spécifique dans un magasin spécifique',
  })
  @ApiParam({
    name: 'productId',
    description: 'ID du produit',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiParam({
    name: 'storeId',
    description: 'ID du magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock trouvé',
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
    description: 'Stock non trouvé',
  })
  findByProductAndStore(
    @Param('productId') productId: string,
    @Param('storeId') storeId: string,
  ) {
    return this.stockService.findByProductAndStore(productId, storeId);
  }

  /**
   * Récupérer un stock par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Détails d\'un stock',
    description: 'Récupère les détails d\'un stock spécifique',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du stock',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock trouvé',
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
    description: 'Stock non trouvé',
  })
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  /**
   * Mettre à jour un stock
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Modifier un stock',
    description: 'Met à jour la quantité d\'un stock (ajustement manuel)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du stock',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock mis à jour avec succès',
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
    description: 'Stock non trouvé',
  })
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(id, updateStockDto);
  }

  /**
   * Supprimer un stock
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer un stock',
    description: 'Supprime un stock (uniquement si quantité = 0)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du stock',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock supprimé avec succès',
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
    description: 'Stock non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Impossible de supprimer un stock avec une quantité > 0',
  })
  remove(@Param('id') id: string) {
    return this.stockService.remove(id);
  }
}