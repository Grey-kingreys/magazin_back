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
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RequestWithUser } from 'src/auth/jwt.strategy';

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
    description: 'Ouvre une nouvelle caisse. Un utilisateur ne peut avoir qu\'une seule caisse ouverte à la fois. La caisse sera liée à votre compte pour traçabilité.',
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
    status: 409,
    description: 'Vous avez déjà une caisse ouverte',
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
    description: 'Ferme votre caisse. Compare le montant compté avec le montant disponible. Un commentaire est OBLIGATOIRE si une différence est détectée.',
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
    description: 'Commentaire obligatoire si différence détectée',
  })
  @ApiResponse({
    status: 403,
    description: 'Vous ne pouvez fermer que votre propre caisse',
  })
  close(
    @Param('id') id: string,
    @Body() closeCashRegisterDto: CloseCashRegisterDto,
    @Req() request: RequestWithUser,
  ) {
    return this.cashRegisterService.close(id, closeCashRegisterDto, request.user.userId);
  }

  /**
   * Mettre à jour une caisse (ADMIN uniquement - réassignation)
   */
  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Réassigner une caisse (Admin uniquement)',
    description: 'Permet à un admin de réassigner une caisse à un autre utilisateur',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la caisse',
    example: 'clx7b8k9l0000xtqp1234abcd',
  })
  @ApiResponse({
    status: 200,
    description: 'Caisse réassignée avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de modifier une caisse fermée',
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Rôle ADMIN requis',
  })
  @ApiResponse({
    status: 409,
    description: 'Le nouvel utilisateur a déjà une caisse ouverte',
  })
  update(
    @Param('id') id: string,
    @Body() updateCashRegisterDto: UpdateCashRegisterDto,
    @Req() request: RequestWithUser,
  ) {
    return this.cashRegisterService.update(id, updateCashRegisterDto, request.user.userId);
  }

  // Les autres routes restent identiques...

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER')
  @ApiOperation({
    summary: 'Liste des caisses',
    description: 'Récupère la liste de toutes les caisses avec pagination et filtres',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'CLOSED'] })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
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

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Statistiques des caisses',
    description: 'Récupère des statistiques globales sur les caisses',
  })
  @ApiQuery({ name: 'storeId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getStats(
    @Query('storeId') storeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.cashRegisterService.getStats(storeId, start, end);
  }

  @Get('my-open-register')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Ma caisse ouverte',
    description: "Récupère votre caisse actuellement ouverte",
  })
  findMyOpenRegister(@Req() request: RequestWithUser) {
    return this.cashRegisterService.findOpenByUser(request.user.userId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STORE_MANAGER', 'CASHIER')
  @ApiOperation({
    summary: "Détails d'une caisse",
    description: "Récupère les détails d'une caisse spécifique",
  })
  @ApiParam({ name: 'id', description: 'ID de la caisse' })
  findOne(@Param('id') id: string) {
    return this.cashRegisterService.findOne(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Supprimer une caisse',
    description: 'Supprime une caisse (uniquement si aucune vente associée)',
  })
  @ApiParam({ name: 'id', description: 'ID de la caisse' })
  remove(@Param('id') id: string) {
    return this.cashRegisterService.remove(id);
  }
}