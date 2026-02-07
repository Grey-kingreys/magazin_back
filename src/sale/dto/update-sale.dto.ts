import { PartialType } from '@nestjs/swagger';
import { CreateSaleDto } from './create-sale.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Enum pour le statut de vente
export enum SaleStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    REFUNDED = 'REFUNDED',
}

export class UpdateSaleDto extends PartialType(CreateSaleDto) {
    @ApiProperty({
        enum: SaleStatus,
        example: SaleStatus.COMPLETED,
        description: 'Statut de la vente',
        required: false,
    })
    @IsOptional()
    @IsEnum(SaleStatus, {
        message: 'Statut invalide. Valeurs acceptées : PENDING, COMPLETED, CANCELLED, REFUNDED',
    })
    status?: SaleStatus;
}