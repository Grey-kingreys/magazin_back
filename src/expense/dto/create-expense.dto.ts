import {
    IsNotEmpty,
    IsString,
    IsNumber,
    IsPositive,
    IsOptional,
    IsEnum,
    Length,
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

export class CreateExpenseDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'ID du magasin',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId: string;

    @ApiProperty({
        example: 'clx7b8k9l0000xtqp9012ijkl',
        description: 'ID de la caisse (obligatoire pour les paiements en espèces)',
        required: false,
    })
    @IsOptional()
    @IsString({ message: "L'ID de la caisse doit être une chaîne de caractères" })
    cashRegisterId?: string;

    @ApiProperty({
        example: 'Loyer',
        description: 'Catégorie de dépense (Loyer, Salaires, Électricité, Fournitures, etc.)',
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
        example: 'Loyer du mois de février 2024',
        description: 'Description détaillée de la dépense',
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
        example: 5000000,
        description: 'Montant de la dépense (en GNF)',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Le montant est obligatoire' })
    @IsNumber({}, { message: 'Le montant doit être un nombre' })
    @IsPositive({ message: 'Le montant doit être positif' })
    @Type(() => Number)
    amount: number;

    @ApiProperty({
        example: 'FACT-2024-001',
        description: 'Numéro de référence (facture, reçu, etc.)',
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
        enum: PaymentMethod,
        example: PaymentMethod.CASH,
        description: 'Méthode de paiement utilisée',
        required: false,
    })
    @IsOptional()
    @IsEnum(PaymentMethod, {
        message: 'Méthode de paiement invalide. Valeurs acceptées : CASH, CARD, MOBILE_MONEY, CHECK',
    })
    paymentMethod?: PaymentMethod;

    @ApiProperty({
        example: '2024-02-05T00:00:00.000Z',
        description: 'Date de la dépense',
        required: false,
    })
    @IsOptional()
    @Type(() => Date)
    date?: Date;
}