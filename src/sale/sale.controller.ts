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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleStatus } from './dto/update-sale.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestWithUser } from 'src/auth/jwt.strategy';

@ApiTags('Ventes (POS)')
@Controller('sale')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class SaleController {
  constructor(private readonly saleService: SaleService) { }

  /**
   * Créer une nouvelle vente
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Créer une vente',
    description: 'Enregistre une nouvelle vente et met à jour automatiquement le stock',
  })
  @ApiResponse({
    status: 201,
    description: 'Vente créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou stock insuffisant',
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
    description: 'Magasin, produit ou caisse non trouvé',
  })
  create(@Body() createSaleDto: CreateSaleDto, @Req() request: RequestWithUser) {
    return this.saleService.create(createSaleDto, request.user.userId);
  }

  /**
   * Récupérer toutes les ventes
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Liste des ventes',
    description: 'Récupère la liste de toutes les ventes avec pagination et filtres',
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
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrer par statut',
    enum: SaleStatus,
    example: 'COMPLETED',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début (ISO 8601)',
    example: '2024-02-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin (ISO 8601)',
    example: '2024-02-28T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Rechercher par numéro de vente',
    example: 'VNT-2024',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des ventes récupérée',
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
    @Query('storeId') storeId?: string,
    @Query('status') status?: SaleStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.saleService.findAll(page, limit, storeId, status, start, end, search);
  }

  /**
   * Récupérer les statistiques des ventes
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Statistiques des ventes',
    description: 'Récupère des statistiques globales sur les ventes',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début (ISO 8601)',
    example: '2024-02-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin (ISO 8601)',
    example: '2024-02-28T23:59:59.999Z',
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
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getStats(
    @Query('storeId') storeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.saleService.getStats(storeId, start, end);
  }

  /**
   * Récupérer les ventes d'aujourd'hui
   */
  @Get('today')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: "Ventes du jour",
    description: "Récupère toutes les ventes d'aujourd'hui",
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Ventes du jour récupérées',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  getTodaySales(@Query('storeId') storeId?: string) {
    return this.saleService.getTodaySales(storeId);
  }

  /**
   * Rechercher une vente par numéro
   */
  @Get('number/:saleNumber')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Rechercher par numéro',
    description: 'Recherche une vente par son numéro unique',
  })
  @ApiParam({
    name: 'saleNumber',
    description: 'Numéro de la vente',
    example: 'VNT-202402-00001',
  })
  @ApiResponse({
    status: 200,
    description: 'Vente trouvée',
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
    description: 'Vente non trouvée',
  })
  findBySaleNumber(@Param('saleNumber') saleNumber: string) {
    return this.saleService.findBySaleNumber(saleNumber);
  }

  /**
   * Récupérer une vente par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: "Détails d'une vente",
    description: "Récupère les détails d'une vente spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la vente',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Vente trouvée',
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
    description: 'Vente non trouvée',
  })
  findOne(@Param('id') id: string) {
    return this.saleService.findOne(id);
  }

  /**
   * Mettre à jour le statut d'une vente
   */
  @Patch(':id/status/:status')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Modifier le statut',
    description: "Change le statut d'une vente (annulation, remboursement, etc.)",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la vente',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiParam({
    name: 'status',
    description: 'Nouveau statut',
    enum: SaleStatus,
    example: 'CANCELLED',
  })
  @ApiResponse({
    status: 200,
    description: 'Statut mis à jour avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Transition de statut invalide',
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
    description: 'Vente non trouvée',
  })
  updateStatus(
    @Param('id') id: string,
    @Param('status') status: SaleStatus,
    @Req() request: RequestWithUser,
  ) {
    return this.saleService.updateStatus(id, status, request.user.userId);
  }

  /**
   * Annuler une vente
   */
  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Annuler une vente',
    description: "Annule une vente et restaure le stock",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la vente',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Vente annulée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible d\'annuler cette vente',
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
    description: 'Vente non trouvée',
  })
  remove(@Param('id') id: string, @Req() request: RequestWithUser) {
    return this.saleService.remove(id, request.user.userId);
  }
}