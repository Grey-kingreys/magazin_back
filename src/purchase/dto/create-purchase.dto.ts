import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsPositive,
    IsOptional,
    IsArray,
    ValidateNested,
    IsInt,
    Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class PurchaseItemDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp1234abcd',
        description: 'ID du produit',
        required: true,
    })
    @IsNotEmpty({ message: 'Le produit est obligatoire' })
    @IsString()
    productId: string;

    @ApiProperty({
        example: 50,
        description: 'Quantité achetée',
        required: true,
        minimum: 1,
    })
    @IsNotEmpty({ message: 'La quantité est obligatoire' })
    @IsInt()
    @Min(1, { message: 'La quantité doit être au moins 1' })
    @Type(() => Number)
    quantity: number;

    @ApiProperty({
        example: 950000,
        description: "Prix d'achat unitaire (en GNF)",
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: "Le prix d'achat est obligatoire" })
    @IsNumber()
    @IsPositive({ message: "Le prix d'achat doit être positif" })
    @Type(() => Number)
    unitPrice: number;
}

export class CreatePurchaseDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du fournisseur',
        required: true,
    })
    @IsNotEmpty({ message: 'Le fournisseur est obligatoire' })
    @IsString()
    supplierId: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp9012ijkl',
        description: 'ID du magasin destinataire',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString()
    storeId: string;

    @ApiProperty({
        type: [PurchaseItemDto],
        description: 'Liste des articles achetés',
        required: true,
    })
    @IsNotEmpty({ message: 'Les articles sont obligatoires' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PurchaseItemDto)
    items: PurchaseItemDto[];

    @ApiProperty({
        example: 'FACT-2024-001',
        description: 'Numéro de facture du fournisseur',
        required: false,
    })
    @IsOptional()
    @IsString()
    invoiceNumber?: string;

    @ApiProperty({
        example: 'Achat de stock pour le trimestre',
        description: 'Notes ou commentaires',
        required: false,
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({
        example: '2024-02-11T00:00:00.000Z',
        description: "Date de l'achat",
        required: false,
    })
    @IsOptional()
    @Type(() => Date)
    purchaseDate?: Date;
}