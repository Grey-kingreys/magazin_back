import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsPositive,
    IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OpenCashRegisterDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du magasin',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId: string;

    @ApiProperty({
        example: 100000,
        description: 'Montant d\'ouverture de la caisse (en GNF)',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: "Le montant d'ouverture est obligatoire" })
    @IsNumber({}, { message: "Le montant d'ouverture doit être un nombre" })
    @IsPositive({ message: "Le montant d'ouverture doit être positif" })
    @Type(() => Number)
    openingAmount: number;

    @ApiProperty({
        example: 'Ouverture de caisse du matin',
        description: 'Notes sur l\'ouverture',
        required: false,
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
    notes?: string;
}