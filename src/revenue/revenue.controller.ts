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
import { RevenueService } from './revenue.service';
import { CreateRevenueDto } from './dto/create-revenue.dto';
import { UpdateRevenueDto } from './dto/update-revenue.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestWithUser } from 'src/auth/jwt.strategy';

@ApiTags('Recettes')
@Controller('revenue')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class RevenueController {
  constructor(private readonly revenueService: RevenueService) { }

  /**
   * Créer une nouvelle recette
   */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Créer une recette',
    description: 'Enregistre une nouvelle recette',
  })
  @ApiResponse({
    status: 201,
    description: 'Recette créée avec succès',
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
  create(@Body() createRevenueDto: CreateRevenueDto, @Req() request: RequestWithUser) {
    return this.revenueService.create(createRevenueDto, request.user.userId);
  }

  /**
   * Récupérer toutes les recettes
   */
  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Liste des recettes',
    description: 'Récupère la liste de toutes les recettes avec pagination et filtres',
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
    name: 'category',
    required: false,
    description: 'Filtrer par catégorie',
    example: 'Vente',
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
    example: 'vente',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des recettes récupérée',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.revenueService.findAll(page, limit, category, start, end, search);
  }

  /**
   * Récupérer les statistiques des recettes
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des recettes',
    description: 'Récupère des statistiques globales sur les recettes',
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.revenueService.getStats(start, end);
  }

  /**
   * Récupérer les catégories de recettes
   */
  @Get('categories')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Liste des catégories',
    description: 'Récupère la liste unique des catégories de recettes',
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
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  getCategories() {
    return this.revenueService.getCategories();
  }

  /**
   * Récupérer une recette par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: "Détails d'une recette",
    description: "Récupère les détails d'une recette spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la recette',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Recette trouvée',
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
    description: 'Recette non trouvée',
  })
  findOne(@Param('id') id: string) {
    return this.revenueService.findOne(id);
  }

  /**
   * Mettre à jour une recette
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Modifier une recette',
    description: "Met à jour les informations d'une recette",
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la recette',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Recette mise à jour avec succès',
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
    description: 'Recette non trouvée',
  })
  update(@Param('id') id: string, @Body() updateRevenueDto: UpdateRevenueDto) {
    return this.revenueService.update(id, updateRevenueDto);
  }

  /**
   * Supprimer une recette
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer une recette',
    description: 'Supprime une recette',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la recette',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Recette supprimée avec succès',
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
    description: 'Recette non trouvée',
  })
  remove(@Param('id') id: string) {
    return this.revenueService.remove(id);
  }
}