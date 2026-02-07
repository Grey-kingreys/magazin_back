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
import { ExpenseService } from './expense.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestWithUser } from 'src/auth/jwt.strategy';

@ApiTags('Dépenses')
@Controller('expense')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) { }

  /**
   * Créer une nouvelle dépense
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Créer une dépense',
    description: 'Enregistre une nouvelle dépense pour un magasin',
  })
  @ApiResponse({
    status: 201,
    description: 'Dépense créée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides ou magasin désactivé',
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
    description: 'Magasin non trouvé',
  })
  create(@Body() createExpenseDto: CreateExpenseDto, @Req() request: RequestWithUser) {
    return this.expenseService.create(createExpenseDto, request.user.userId);
  }

  /**
   * Récupérer toutes les dépenses
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des dépenses',
    description: 'Récupère la liste de toutes les dépenses avec pagination et filtres',
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
    name: 'category',
    required: false,
    description: 'Filtrer par catégorie',
    example: 'Loyer',
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
    description: 'Rechercher dans description, référence ou catégorie',
    example: 'loyer',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des dépenses récupérée',
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
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.expenseService.findAll(page, limit, storeId, category, start, end, search);
  }

  /**
   * Récupérer les statistiques des dépenses
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des dépenses',
    description: 'Récupère des statistiques globales sur les dépenses',
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

    return this.expenseService.getStats(storeId, start, end);
  }

  /**
   * Récupérer les catégories de dépenses
   */
  @Get('categories')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des catégories',
    description: 'Récupère la liste unique des catégories de dépenses',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des catégories récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getCategories() {
    return this.expenseService.getCategories();
  }

  /**
   * Récupérer une dépense par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Détails d'une dépense",
    description: "Récupère les détails d'une dépense spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la dépense',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Dépense trouvée',
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
    description: 'Dépense non trouvée',
  })
  findOne(@Param('id') id: string) {
    return this.expenseService.findOne(id);
  }

  /**
   * Mettre à jour une dépense
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Modifier une dépense',
    description: "Met à jour les informations d'une dépense",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la dépense',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Dépense mise à jour avec succès',
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
    description: 'Dépense non trouvée',
  })
  update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
    return this.expenseService.update(id, updateExpenseDto);
  }

  /**
   * Supprimer une dépense
   */
  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Supprimer une dépense',
    description: 'Supprime une dépense',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la dépense',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Dépense supprimée avec succès',
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
    description: 'Dépense non trouvée',
  })
  remove(@Param('id') id: string) {
    return this.expenseService.remove(id);
  }
}