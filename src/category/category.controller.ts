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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catégories')
@Controller('category')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  /**
   * Créer une nouvelle catégorie
   */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Créer une catégorie',
    description: 'Crée une nouvelle catégorie de produits',
  })
  @ApiResponse({
    status: 201,
    description: 'Catégorie créée avec succès',
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
    description: 'Une catégorie avec ce nom existe déjà',
  })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  /**
   * Récupérer toutes les catégories
   */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Liste des catégories',
    description:
      'Récupère la liste de toutes les catégories avec pagination et recherche',
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
    description: 'Rechercher dans le nom ou la description',
    example: 'électronique',
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
    description: 'Accès refusé',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.categoryService.findAll(page, limit, search);
  }

  /**
   * Récupérer les statistiques des catégories
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des catégories',
    description: 'Récupère des statistiques globales sur les catégories',
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
    return this.categoryService.getStats();
  }

  /**
   * Récupérer une catégorie par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Détails d\'une catégorie',
    description: 'Récupère les détails d\'une catégorie spécifique',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Catégorie trouvée',
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
    description: 'Catégorie non trouvée',
  })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  /**
   * Récupérer les produits d'une catégorie
   */
  @Get(':id/products')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Produits d\'une catégorie',
    description: 'Récupère tous les produits d\'une catégorie avec pagination',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
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
    description: 'Nombre d\'éléments par page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Produits de la catégorie récupérés',
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
    description: 'Catégorie non trouvée',
  })
  getProducts(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.categoryService.getProducts(id, page, limit);
  }

  /**
   * Mettre à jour une catégorie
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Modifier une catégorie',
    description: 'Met à jour les informations d\'une catégorie',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Catégorie mise à jour avec succès',
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
    description: 'Catégorie non trouvée',
  })
  @ApiResponse({
    status: 409,
    description: 'Une autre catégorie avec ce nom existe déjà',
  })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  /**
   * Supprimer une catégorie
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer une catégorie',
    description:
      'Supprime une catégorie (uniquement si elle ne contient pas de produits)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Catégorie supprimée avec succès',
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
    description: 'Catégorie non trouvée',
  })
  @ApiResponse({
    status: 409,
    description:
      'Impossible de supprimer une catégorie contenant des produits',
  })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}