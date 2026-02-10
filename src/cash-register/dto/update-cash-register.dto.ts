import {
    IsNumber,
    Min,
    IsOptional,
    IsString,
    ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateCashRegisterDto {
    @ApiProperty({
        example: 150000,
        description: 'Nouveau montant d\'ouverture de la caisse (en GNF)',
        required: false,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Le montant d\'ouverture doit être un nombre' })
    @Min(0, { message: 'Le montant d\'ouverture ne peut pas être négatif' })
    @Type(() => Number)
    @ValidateIf(o => o.openingAmount !== undefined)
    openingAmount?: number;


    @ApiProperty({
        example: 150000,
        description: 'Nouveau montant disponible de la caisse (en GNF), c\'est un montant mis automatiquement a jours',
        required: false,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Le montant disponible doit être un nombre' })
    @Min(0, { message: 'Le montant dispoble ne peut pas être négatif' })
    @Type(() => Number)
    @ValidateIf(o => o.openingAmount !== undefined)
    availableAmount?: number;

    @ApiProperty({
        example: 'Mise à jour du fonds de caisse - ajout 50 000 GNF',
        description: 'Notes sur la modification',
        required: false,
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
    notes?: string;
}