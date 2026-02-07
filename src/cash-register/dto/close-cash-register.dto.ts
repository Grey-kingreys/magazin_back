import {
    IsNotEmpty,
    IsNumber,
    Min,
    IsOptional,
    IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CloseCashRegisterDto {
    @ApiProperty({
        example: 850000,
        description: 'Montant réel compté dans la caisse à la fermeture (en GNF)',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Le montant de fermeture est obligatoire' })
    @IsNumber({}, { message: 'Le montant de fermeture doit être un nombre' })
    @Min(0, { message: 'Le montant de fermeture ne peut pas être négatif' })
    @Type(() => Number)
    closingAmount: number;

    @ApiProperty({
        example: 'Fermeture de caisse - pas de problème',
        description: 'Notes sur la fermeture',
        required: false,
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
    notes?: string;
}