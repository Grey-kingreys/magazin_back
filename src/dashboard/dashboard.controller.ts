import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  /**
   * Récupérer la vue d'ensemble du dashboard
   */
  @Get('overview')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Vue d\'ensemble du dashboard',
    description:
      'Récupère toutes les statistiques principales pour le tableau de bord : finances, ventes, stocks, produits populaires, etc.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin spécifique',
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
    description: 'Dashboard récupéré avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getOverview(@Query() query: DashboardQueryDto) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.dashboardService.getOverview(
      query.storeId,
      startDate,
      endDate,
    );
  }

  /**
   * Récupérer la comparaison de performance
   */
  @Get('performance')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Comparaison de performance',
    description:
      'Compare les performances de la période actuelle avec la période précédente (même durée)',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin spécifique',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début de la période actuelle (ISO 8601)',
    example: '2024-02-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin de la période actuelle (ISO 8601)',
    example: '2024-02-28T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Comparaison récupérée avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  getPerformanceComparison(@Query() query: DashboardQueryDto) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.dashboardService.getPerformanceComparison(
      query.storeId,
      startDate,
      endDate,
    );
  }

  /**
   * Récupérer le dashboard des caisses
   */
  @Get('cash-registers')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Dashboard des caisses',
    description:
      'Récupère les statistiques des caisses ouvertes et fermées aujourd\'hui',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin spécifique',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard des caisses récupéré',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN, MANAGER ou STORE_MANAGER requis',
  })
  getCashRegisterDashboard(@Query('storeId') storeId?: string) {
    return this.dashboardService.getCashRegisterDashboard(storeId);
  }
}