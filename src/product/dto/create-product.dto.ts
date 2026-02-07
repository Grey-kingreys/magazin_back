import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsNumber,
    IsPositive,
    IsInt,
    Min,
    Length,
    Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateProductDto {
    @ApiProperty({
        example: 'iPhone 15 Pro Max',
        description: 'Nom du produit',
        required: true,
        minLength: 2,
        maxLength: 200,
    })
    @IsNotEmpty({ message: 'Le nom du produit est obligatoire' })
    @IsString({ message: 'Le nom doit être une chaîne de caractères' })
    @Length(2, 200, {
        message: 'Le nom doit contenir entre 2 et 200 caractères',
    })
    @Matches(/^[a-zA-Z0-9À-ÿ\s\-'&(),.°#+/]+$/, {
        message: 'Le nom contient des caractères non autorisés',
    })
    name: string;

    @ApiProperty({
        example: 'Smartphone Apple avec écran Super Retina XDR de 6.7 pouces',
        description: 'Description détaillée du produit',
        required: false,
        maxLength: 1000,
    })
    @IsOptional()
    @IsString({ message: 'La description doit être une chaîne de caractères' })
    @Length(0, 1000, {
        message: 'La description ne peut pas dépasser 1000 caractères',
    })
    description?: string;

    @ApiProperty({
        example: '0194253777564',
        description: 'Code-barres du produit (unique)',
        required: false,
        maxLength: 50,
    })
    @IsOptional()
    @IsString({ message: 'Le code-barres doit être une chaîne de caractères' })
    @Length(0, 50, {
        message: 'Le code-barres ne peut pas dépasser 50 caractères',
    })
    @Matches(/^[0-9A-Za-z\-]+$/, {
        message: 'Le code-barres ne peut contenir que des chiffres, lettres et tirets',
    })
    barcode?: string;

    @ApiProperty({
        example: 'IPH-15-PM-256-BLK',
        description: 'SKU (Stock Keeping Unit) - unique',
        required: true,
        maxLength: 100,
    })
    @IsNotEmpty({ message: 'Le SKU est obligatoire' })
    @IsString({ message: 'Le SKU doit être une chaîne de caractères' })
    @Length(2, 100, {
        message: 'Le SKU doit contenir entre 2 et 100 caractères',
    })
    @Matches(/^[A-Z0-9\-_]+$/, {
        message: 'Le SKU ne peut contenir que des majuscules, chiffres, tirets et underscores',
    })
    sku: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp1234abcd',
        description: 'ID de la catégorie',
        required: true,
    })
    @IsNotEmpty({ message: 'La catégorie est obligatoire' })
    @IsString({ message: "L'ID de la catégorie doit être une chaîne de caractères" })
    categoryId: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du fournisseur',
        required: false,
    })
    @IsOptional()
    @IsString({ message: "L'ID du fournisseur doit être une chaîne de caractères" })
    supplierId?: string;

    @ApiProperty({
        example: 950000,
        description: "Prix d'achat (coût) en GNF",
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: "Le prix d'achat est obligatoire" })
    @IsNumber({}, { message: "Le prix d'achat doit être un nombre" })
    @IsPositive({ message: "Le prix d'achat doit être positif" })
    @Type(() => Number)
    costPrice: number;

    @ApiProperty({
        example: 1200000,
        description: 'Prix de vente en GNF',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Le prix de vente est obligatoire' })
    @IsNumber({}, { message: 'Le prix de vente doit être un nombre' })
    @IsPositive({ message: 'Le prix de vente doit être positif' })
    @Type(() => Number)
    sellingPrice: number;

    @ApiProperty({
        example: 5,
        description: "Seuil d'alerte de stock minimum",
        required: false,
        default: 0,
        minimum: 0,
    })
    @IsOptional()
    @IsInt({ message: 'Le stock minimum doit être un nombre entier' })
    @Min(0, { message: 'Le stock minimum ne peut pas être négatif' })
    @Type(() => Number)
    minStock?: number;

    @ApiProperty({
        example: 'pièce',
        description: 'Unité de mesure (pièce, kg, litre, mètre, etc.)',
        required: false,
        default: 'pièce',
        maxLength: 20,
    })
    @IsOptional()
    @IsString({ message: "L'unité doit être une chaîne de caractères" })
    @Length(1, 20, {
        message: "L'unité doit contenir entre 1 et 20 caractères",
    })
    unit?: string;
}