import {
    IsNotEmpty,
    IsString,
    IsInt,
    Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateStockDto {
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
        description: 'ID du magasin',
        required: true,
    })
    @IsNotEmpty({ message: 'Le magasin est obligatoire' })
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId: string;

    @ApiProperty({
        example: 50,
        description: 'Quantité initiale en stock',
        required: true,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'La quantité est obligatoire' })
    @IsInt({ message: 'La quantité doit être un nombre entier' })
    @Min(0, { message: 'La quantité ne peut pas être négative' })
    @Type(() => Number)
    quantity: number;
}