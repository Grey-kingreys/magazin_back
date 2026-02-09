import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsPositive,
    IsOptional,
    Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRevenueDto {
    // ⭐ NOUVEAU : Ajouter storeId
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du magasin',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId: string;

    @ApiProperty({
        example: 'Vente',
        description: 'Catégorie de recette (Vente, Subvention, Donation, Autre revenu, etc.)',
        required: true,
        maxLength: 100,
    })
    @IsNotEmpty({ message: 'La catégorie est obligatoire' })
    @IsString({ message: 'La catégorie doit être une chaîne de caractères' })
    @Length(2, 100, {
        message: 'La catégorie doit contenir entre 2 et 100 caractères',
    })
    category: string;

    @ApiProperty({
        example: 'Vente exceptionnelle de produits',
        description: 'Description détaillée de la recette',
        required: true,
        maxLength: 500,
    })
    @IsNotEmpty({ message: 'La description est obligatoire' })
    @IsString({ message: 'La description doit être une chaîne de caractères' })
    @Length(3, 500, {
        message: 'La description doit contenir entre 3 et 500 caractères',
    })
    description: string;

    @ApiProperty({
        example: 10000000,
        description: 'Montant de la recette (en GNF)',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Le montant est obligatoire' })
    @IsNumber({}, { message: 'Le montant doit être un nombre' })
    @IsPositive({ message: 'Le montant doit être positif' })
    @Type(() => Number)
    amount: number;

    @ApiProperty({
        example: 'REF-2024-001',
        description: 'Numéro de référence',
        required: false,
        maxLength: 100,
    })
    @IsOptional()
    @IsString({ message: 'La référence doit être une chaîne de caractères' })
    @Length(0, 100, {
        message: 'La référence ne peut pas dépasser 100 caractères',
    })
    reference?: string;

    @ApiProperty({
        example: '2024-02-05T00:00:00.000Z',
        description: 'Date de la recette',
        required: false,
    })
    @IsOptional()
    @Type(() => Date)
    date?: Date;
}