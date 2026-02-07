import {
    IsNotEmpty,
    IsString,
    IsArray,
    IsNumber,
    IsPositive,
    IsInt,
    Min,
    IsEnum,
    IsOptional,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Enum pour les méthodes de paiement
export enum PaymentMethod {
    CASH = 'CASH',
    CARD = 'CARD',
    MOBILE_MONEY = 'MOBILE_MONEY',
    CHECK = 'CHECK',
}

// DTO pour un article de vente
export class CreateSaleItemDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp1234abcd',
        description: 'ID du produit',
        required: true,
    })
    @IsNotEmpty({ message: 'Le produit est obligatoire' })
    @IsString({ message: "L'ID du produit doit être une chaîne de caractères" })
    productId: string;

    @ApiProperty({
        example: 2,
        description: 'Quantité achetée',
        required: true,
        minimum: 1,
    })
    @IsNotEmpty({ message: 'La quantité est obligatoire' })
    @IsInt({ message: 'La quantité doit être un nombre entier' })
    @Min(1, { message: 'La quantité doit être au moins 1' })
    @Type(() => Number)
    quantity: number;

    @ApiProperty({
        example: 1200000,
        description: 'Prix unitaire au moment de la vente (en GNF)',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Le prix unitaire est obligatoire' })
    @IsNumber({}, { message: 'Le prix unitaire doit être un nombre' })
    @IsPositive({ message: 'Le prix unitaire doit être positif' })
    @Type(() => Number)
    unitPrice: number;
}

// DTO principal pour créer une vente
export class CreateSaleDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du magasin où la vente est effectuée',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp9012ijkl',
        description: 'ID de la caisse (optionnel)',
        required: false,
    })
    @IsOptional()
    @IsString({ message: "L'ID de la caisse doit être une chaîne de caractères" })
    cashRegisterId?: string;

    @ApiProperty({
        type: [CreateSaleItemDto],
        description: 'Liste des articles vendus',
        required: true,
    })
    @IsNotEmpty({ message: 'Les articles sont obligatoires' })
    @IsArray({ message: 'Les articles doivent être un tableau' })
    @ArrayMinSize(1, { message: 'Au moins un article est requis' })
    @ValidateNested({ each: true })
    @Type(() => CreateSaleItemDto)
    items: CreateSaleItemDto[];

    @ApiProperty({
        example: 0,
        description: 'Montant de la remise (en GNF)',
        required: false,
        default: 0,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber({}, { message: 'La remise doit être un nombre' })
    @Min(0, { message: 'La remise ne peut pas être négative' })
    @Type(() => Number)
    discount?: number;

    @ApiProperty({
        example: 0,
        description: 'Montant de la taxe (en GNF)',
        required: false,
        default: 0,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber({}, { message: 'La taxe doit être un nombre' })
    @Min(0, { message: 'La taxe ne peut pas être négative' })
    @Type(() => Number)
    tax?: number;

    @ApiProperty({
        enum: PaymentMethod,
        example: PaymentMethod.CASH,
        description: 'Méthode de paiement',
        required: true,
    })
    @IsNotEmpty({ message: 'La méthode de paiement est obligatoire' })
    @IsEnum(PaymentMethod, {
        message: 'Méthode de paiement invalide. Valeurs acceptées : CASH, CARD, MOBILE_MONEY, CHECK',
    })
    paymentMethod: PaymentMethod;

    @ApiProperty({
        example: 2500000,
        description: 'Montant payé par le client (en GNF)',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Le montant payé est obligatoire' })
    @IsNumber({}, { message: 'Le montant payé doit être un nombre' })
    @IsPositive({ message: 'Le montant payé doit être positif' })
    @Type(() => Number)
    amountPaid: number;

    @ApiProperty({
        example: 'Vente client régulier',
        description: 'Notes ou commentaires sur la vente',
        required: false,
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
    notes?: string;
}