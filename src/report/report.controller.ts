import {
  Controller,
  Get,
  UseGuards,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportService } from './report.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Rapports & Exports')
@Controller('report')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ReportController {
  constructor(private readonly reportService: ReportService) { }

  /**
   * Rapport de ventes
   */
  @Get('sales')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Rapport de ventes',
    description:
      'Génère un rapport détaillé des ventes avec possibilité de groupement',
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
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    description: 'Grouper par période',
    enum: ['day', 'week', 'month'],
    example: 'day',
  })
  @ApiResponse({
    status: 200,
    description: 'Rapport généré avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  getSalesReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.reportService.getSalesReport(
      start,
      end,
      storeId,
      groupBy || 'day',
    );
  }

  /**
   * Rapport de stock
   */
  @Get('stock')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Rapport de stock',
    description: "Génère un rapport de l'état actuel des stocks",
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiQuery({
    name: 'lowStockOnly',
    required: false,
    description: 'Afficher uniquement les stocks faibles',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Rapport généré avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  getStockReport(
    @Query('storeId') storeId?: string,
    @Query('lowStockOnly') lowStockOnly?: boolean,
  ) {
    return this.reportService.getStockReport(storeId, lowStockOnly || false);
  }

  /**
   * Rapport de mouvements de stock
   */
  @Get('stock-movements')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Rapport de mouvements de stock',
    description: 'Génère un rapport des mouvements de stock',
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
  @ApiResponse({
    status: 200,
    description: 'Rapport généré avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  getStockMovementsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
    @Query('productId') productId?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.reportService.getStockMovementsReport(
      start,
      end,
      storeId,
      productId,
    );
  }

  /**
   * Rapport financier (Compte de résultat)
   */
  @Get('financial')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Rapport financier',
    description: 'Génère un compte de résultat détaillé',
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
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Rapport généré avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN ou MANAGER requis',
  })
  getFinancialReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.reportService.getFinancialReport(start, end, storeId);
  }

  /**
   * Export Excel - Ventes
   */
  @Get('export/sales/excel')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOperation({
    summary: 'Export Excel - Ventes',
    description: 'Exporte le rapport de ventes au format Excel',
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
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Export Excel généré',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  async exportSalesToExcel(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const buffer = await this.reportService.exportSalesToExcel(
      start,
      end,
      storeId,
    );

    const filename = `rapport_ventes_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }

  /**
   * Export Excel - Stock
   */
  @Get('export/stock/excel')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOperation({
    summary: 'Export Excel - Stock',
    description: 'Exporte le rapport de stock au format Excel',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filtrer par magasin',
    example: 'clx7b8k9l0000xtqp5678efgh',
  })
  @ApiResponse({
    status: 200,
    description: 'Export Excel généré',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé',
  })
  async exportStockToExcel(
    @Res() res: Response,
    @Query('storeId') storeId?: string,
  ) {
    const buffer = await this.reportService.exportStockToExcel(storeId);

    const filename = `rapport_stock_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }
}