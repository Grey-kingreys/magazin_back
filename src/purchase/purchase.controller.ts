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
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestWithUser } from 'src/auth/jwt.strategy';

@ApiTags('Achats')
@Controller('purchase')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) { }

  /**
   * Créer un nouvel achat
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Créer un achat',
    description:
      "Enregistre un nouvel achat chez un fournisseur. Met à jour automatiquement les stocks du magasin.",
  })
  @ApiResponse({
    status: 201,
    description: 'Achat créé avec succès, stocks mis à jour automatiquement',
  })
  @ApiResponse({
    status: 400,
    description:
      'Données invalides ou fournisseur/magasin/produit(s) inexistant(s) ou désactivé(s)',
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
    description: 'Fournisseur, magasin ou produit non trouvé',
  })
  create(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @Req() request: RequestWithUser,
  ) {
    return this.purchaseService.create(
      createPurchaseDto,
      request.user.userId,
    );
  }

  /**
   * Récupérer tous les achats
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des achats',
    description:
      'Récupère la liste de tous les achats avec pagination et filtres',
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
    name: 'supplierId',
    required: false,
    description: 'Filtrer par fournisseur',
    example: 'clx7b8k9l0000xtqp1234abcd',
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
    description:
      'Rechercher dans numéro d\'achat, facture ou notes',
    example: 'ACH-2024',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des achats récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description:
      'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('storeId') storeId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.purchaseService.findAll(
      page,
      limit,
      storeId,
      supplierId,
      start,
      end,
      search,
    );
  }

  /**
   * Récupérer les statistiques des achats
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des achats',
    description: 'Récupère des statistiques globales sur les achats',
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
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  getStats(
    @Query('storeId') storeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.purchaseService.getStats(storeId, start, end);
  }

  /**
   * Récupérer un achat par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Détails d'un achat",
    description: "Récupère les détails d'un achat spécifique",
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'achat",
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Achat trouvé',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description:
      'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Achat non trouvé',
  })
  findOne(@Param('id') id: string) {
    return this.purchaseService.findOne(id);
  }

  /**
   * Mettre à jour un achat
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Modifier un achat',
    description:
      "Met à jour les informations d'un achat (facture, notes, date). Ne modifie pas les stocks.",
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'achat",
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Achat mis à jour avec succès',
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
    description: 'Achat non trouvé',
  })
  update(
    @Param('id') id: string,
    @Body() updatePurchaseDto: UpdatePurchaseDto,
  ) {
    return this.purchaseService.update(id, updatePurchaseDto);
  }

  /**
   * Supprimer un achat
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer un achat',
    description:
      "Supprime un achat et ses mouvements de stock associés",
  })
  @ApiParam({
    name: 'id',
    description: "ID de l'achat",
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Achat supprimé avec succès',
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
    description: 'Achat non trouvé',
  })
  remove(@Param('id') id: string) {
    return this.purchaseService.remove(id);
  }
}