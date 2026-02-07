import {
    IsNotEmpty,
    IsString,
    IsInt,
    IsEnum,
    IsOptional,
    Min,
    ValidateIf,
    Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

enum MovementType {
    IN = 'IN',
    OUT = 'OUT',
    TRANSFER = 'TRANSFER',
    ADJUSTMENT = 'ADJUSTMENT',
}

export class CreateStockMovementDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp1234abcd',
        description: 'ID du produit',
        required: true,
    })
    @IsNotEmpty({ message: 'Le produit est obligatoire' })
    @IsString({ message: "L'ID du produit doit être une chaîne de caractères" })
    productId: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du magasin (magasin source pour les sorties/transferts)',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId: string;

    @ApiProperty({
        example: 'clxuserid123456789',
        description: "ID de l'utilisateur effectuant le mouvement",
        required: true,
    })
    @IsNotEmpty({ message: "L'utilisateur est obligatoire" })
    @IsString({ message: "L'ID de l'utilisateur doit être une chaîne de caractères" })
    userId: string;

    @ApiProperty({
        enum: MovementType,
        example: 'IN',
        description: 'Type de mouvement: IN (entrée), OUT (sortie), TRANSFER (transfert), ADJUSTMENT (ajustement)',
        required: true,
    })
    @IsNotEmpty({ message: 'Le type de mouvement est obligatoire' })
    @IsEnum(MovementType, {
        message: 'Le type de mouvement doit être IN, OUT, TRANSFER ou ADJUSTMENT',
    })
    type: MovementType;

    @ApiProperty({
        example: 50,
        description: 'Quantité du mouvement (toujours positive)',
        required: true,
        minimum: 1,
    })
    @IsNotEmpty({ message: 'La quantité est obligatoire' })
    @IsInt({ message: 'La quantité doit être un nombre entier' })
    @Min(1, { message: 'La quantité doit être au moins 1' })
    @Type(() => Number)
    quantity: number;

    @ApiProperty({
        example: 'BL-2024-001',
        description: 'Numéro de référence (bon de livraison, facture, etc.)',
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
        example: 'Réception commande fournisseur Apple',
        description: 'Notes ou commentaires sur le mouvement',
        required: false,
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
    @Length(0, 500, {
        message: 'Les notes ne peuvent pas dépasser 500 caractères',
    })
    notes?: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du magasin source (obligatoire pour les transferts)',
        required: false,
    })
    @ValidateIf((o) => o.type === 'TRANSFER')
    @IsNotEmpty({
        message: 'Le magasin source est obligatoire pour un transfert',
    })
    @IsString({ message: "L'ID du magasin source doit être une chaîne de caractères" })
    fromStoreId?: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp9101mnop',
        description: 'ID du magasin destination (obligatoire pour les transferts)',
        required: false,
    })
    @ValidateIf((o) => o.type === 'TRANSFER')
    @IsNotEmpty({
        message: 'Le magasin destination est obligatoire pour un transfert',
    })
    @IsString({ message: "L'ID du magasin destination doit être une chaîne de caractères" })
    toStoreId?: string;
}