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
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Magasins')
@Controller('store')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class StoreController {
  constructor(private readonly storeService: StoreService) { }

  /**
   * Créer un nouveau magasin
   */
  @Post()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Créer un magasin',
    description: 'Crée un nouveau magasin',
  })
  @ApiResponse({
    status: 201,
    description: 'Magasin créé avec succès',
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
    description: 'Accès refusé - Rôle ADMIN requis',
  })
  @ApiResponse({
    status: 409,
    description: 'Un magasin avec ce nom ou cet email existe déjà',
  })
  create(@Body() createStoreDto: CreateStoreDto) {
    return this.storeService.create(createStoreDto);
  }

  /**
   * Récupérer tous les magasins
   */
  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Liste des magasins',
    description:
      'Récupère la liste de tous les magasins avec pagination et filtres',
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
    description: 'Rechercher dans nom, email, téléphone, ville ou adresse',
    example: 'Central',
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
  @ApiResponse({
    status: 200,
    description: 'Liste des magasins récupérée',
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
    @Query('search') search?: string,
    @Query('isActive', new DefaultValuePipe(undefined))
    isActive?: boolean,
    @Query('city') city?: string,
  ) {
    return this.storeService.findAll(page, limit, search, isActive, city);
  }

  /**
   * Récupérer les statistiques des magasins
   */
  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des magasins',
    description: 'Récupère des statistiques globales sur les magasins',
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
    return this.storeService.getStats();
  }

  /**
   * Récupérer les villes uniques
   */
  @Get('cities')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Liste des villes',
    description: 'Récupère la liste unique des villes des magasins',
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
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  getCities() {
    return this.storeService.getCities();
  }

  /**
   * Récupérer un magasin par ID
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Détails d'un magasin",
    description: "Récupère les détails d'un magasin spécifique",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du magasin',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Magasin trouvé',
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
  findOne(@Param('id') id: string) {
    return this.storeService.findOne(id);
  }

  /**
   * Récupérer les utilisateurs d'un magasin
   */
  @Get(':id/users')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Utilisateurs d'un magasin",
    description: "Récupère tous les utilisateurs d'un magasin avec pagination",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du magasin',
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
    description: 'Utilisateurs du magasin récupérés',
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
  getUsers(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.storeService.getUsers(id, page, limit);
  }

  /**
   * Récupérer les stocks d'un magasin
   */
  @Get(':id/stocks')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: "Stocks d'un magasin",
    description: "Récupère tous les stocks d'un magasin avec pagination",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du magasin',
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
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  @ApiResponse({
    status: 404,
    description: 'Magasin non trouvé',
  })
  getStocks(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.storeService.getStocks(id, page, limit);
  }

  /**
   * Mettre à jour un magasin
   */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Modifier un magasin',
    description: "Met à jour les informations d'un magasin",
  })
  @ApiParam({
    name: 'id',
    description: 'ID du magasin',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Magasin mis à jour avec succès',
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
    description: 'Magasin non trouvé',
  })
  @ApiResponse({
    status: 409,
    description: 'Un autre magasin avec ce nom ou cet email existe déjà',
  })
  update(@Param('id') id: string, @Body() updateStoreDto: UpdateStoreDto) {
    return this.storeService.update(id, updateStoreDto);
  }

  /**
   * Activer/Désactiver un magasin
   */
  @Patch(':id/toggle-active')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Activer/Désactiver un magasin',
    description: 'Change le statut actif/inactif du magasin',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du magasin',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Statut du magasin changé avec succès',
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
    description: 'Magasin non trouvé',
  })
  toggleActive(@Param('id') id: string) {
    return this.storeService.toggleActive(id);
  }

  /**
   * Supprimer un magasin
   */
  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer un magasin',
    description:
      'Supprime un magasin (uniquement si aucune donnée associée)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du magasin',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Magasin supprimé avec succès',
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
    description: 'Magasin non trouvé',
  })
  @ApiResponse({
    status: 409,
    description:
      'Impossible de supprimer un magasin avec des données associées',
  })
  remove(@Param('id') id: string) {
    return this.storeService.remove(id);
  }
}