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
import { CashRegisterService } from './cash-register.service';
import { OpenCashRegisterDto } from './dto/open-cash-register.dto';
import { CloseCashRegisterDto } from './dto/close-cash-register.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestWithUser } from 'src/auth/jwt.strategy';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';

@ApiTags('Caisse (POS)')
@Controller('cash-register')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) { }

  /**
   * Ouvrir une nouvelle caisse
   */
  @Post('open')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Ouvrir une caisse',
    description: 'Ouvre une nouvelle caisse pour un magasin',
  })
  @ApiResponse({
    status: 201,
    description: 'Caisse ouverte avec succès',
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
    description: 'Accès refusé',
  })
  @ApiResponse({
    status: 404,
    description: 'Magasin non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Une caisse est déjà ouverte',
  })
  open(
    @Body() openCashRegisterDto: OpenCashRegisterDto,
    @Req() request: RequestWithUser,
  ) {
    return this.cashRegisterService.open(
      openCashRegisterDto,
      request.user.userId,
    );
  }

  /**
   * Fermer une caisse
   */
  @Patch(':id/close')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Fermer une caisse',
    description: 'Ferme une caisse et calcule les différences',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la caisse',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Caisse fermée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou caisse déjà fermée',
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
    description: 'Caisse non trouvée',
  })
  close(@Param('id') id: string, @Body() closeCashRegisterDto: CloseCashRegisterDto) {
    return this.cashRegisterService.close(id, closeCashRegisterDto);
  }

  /**
   * Récupérer toutes les caisses
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des caisses',
    description: 'Récupère la liste de toutes les caisses avec pagination et filtres',
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
    enum: ['OPEN', 'CLOSED'],
    example: 'OPEN',
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
    description: 'Liste des caisses récupérée',
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
    @Query('storeId') storeId?: string,
    @Query('status') status?: 'OPEN' | 'CLOSED',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.cashRegisterService.findAll(page, limit, storeId, status, start, end);
  }

  /**
   * Récupérer les statistiques des caisses
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des caisses',
    description: 'Récupère des statistiques globales sur les caisses',
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

    return this.cashRegisterService.getStats(storeId, start, end);
  }

  /**
   * Récupérer la caisse ouverte de l'utilisateur connecté
   */
  @Get('my-open-register')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Ma caisse ouverte',
    description: "Récupère la caisse actuellement ouverte de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Caisse ouverte récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  findMyOpenRegister(@Req() request: RequestWithUser) {
    return this.cashRegisterService.findOpenByUser(request.user.userId);
  }

  /**
 * Mettre à jour une caisse ouverte
 */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Mettre à jour une caisse ouverte',
    description: 'Met à jour une caisse ouverte (fonds de caisse ou notes)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la caisse',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Caisse mise à jour avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou caisse fermée',
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
    description: 'Caisse non trouvée',
  })
  @ApiResponse({
    status: 409,
    description: 'Solde insuffisant',
  })
  update(
    @Param('id') id: string,
    @Body() updateCashRegisterDto: UpdateCashRegisterDto,
    @Req() request: RequestWithUser,
  ) {
    return this.cashRegisterService.update(id, updateCashRegisterDto, request.user.userId);
  }

  /**
   * Récupérer une caisse par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: "Détails d'une caisse",
    description: "Récupère les détails d'une caisse spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la caisse',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Caisse trouvée',
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
    description: 'Caisse non trouvée',
  })
  findOne(@Param('id') id: string) {
    return this.cashRegisterService.findOne(id);
  }

  /**
   * Supprimer une caisse
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer une caisse',
    description: 'Supprime une caisse (uniquement si aucune vente associée)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la caisse',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Caisse supprimée avec succès',
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
    description: 'Caisse non trouvée',
  })
  @ApiResponse({
    status: 409,
    description: 'Impossible de supprimer une caisse avec des ventes',
  })
  remove(@Param('id') id: string) {
    return this.cashRegisterService.remove(id);
  }
}