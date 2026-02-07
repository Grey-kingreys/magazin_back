import {
    IsNotEmpty,
    IsString,
    IsOptional,
    IsEmail,
    Length,
    Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoreDto {
    @ApiProperty({
        example: 'Magasin Central',
        description: 'Nom du magasin',
        required: true,
        minLength: 2,
        maxLength: 100,
    })
    @IsNotEmpty({ message: 'Le nom du magasin est obligatoire' })
    @IsString({ message: 'Le nom doit être une chaîne de caractères' })
    @Length(2, 100, {
        message: 'Le nom doit contenir entre 2 et 100 caractères',
    })
    @Matches(/^[a-zA-Z0-9À-ÿ\s\-'&(),.]+$/, {
        message: 'Le nom contient des caractères non autorisés',
    })
    name: string;

    @ApiProperty({
        example: '123 Avenue de la République, Kaloum',
        description: 'Adresse complète du magasin',
        required: false,
        maxLength: 200,
    })
    @IsOptional()
    @IsString({ message: "L'adresse doit être une chaîne de caractères" })
    @Length(0, 200, {
        message: "L'adresse ne peut pas dépasser 200 caractères",
    })
    address?: string;

    @ApiProperty({
        example: 'Conakry',
        description: 'Ville du magasin',
        required: false,
        maxLength: 100,
    })
    @IsOptional()
    @IsString({ message: 'La ville doit être une chaîne de caractères' })
    @Length(0, 100, {
        message: 'La ville ne peut pas dépasser 100 caractères',
    })
    city?: string;

    @ApiProperty({
        example: '+224 622 00 00 00',
        description: 'Numéro de téléphone',
        required: false,
        maxLength: 20,
    })
    @IsOptional()
    @IsString({ message: 'Le téléphone doit être une chaîne de caractères' })
    @Length(0, 20, {
        message: 'Le téléphone ne peut pas dépasser 20 caractères',
    })
    phone?: string;

    @ApiProperty({
        example: 'central@magasin.com',
        description: 'Email du magasin',
        required: false,
    })
    @IsOptional()
    @IsEmail({}, { message: "L'email n'est pas valide" })
    email?: string;
}