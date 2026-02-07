import { IsEmail, IsNotEmpty, Length, Matches, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Email de l\'utilisateur',
        required: true,
    })
    @IsNotEmpty({ message: "L'email est obligatoire" })
    @IsEmail({}, { message: "L'email n'est pas valide" })
    @Matches(/^[^\s<>/:!§;,?~#{}\[\]|`^&'()=+_-]+@[^\s<>/:!§;,?~#{}\[\]|`^&'()=+_-]+\.[^\s<>/:!§;,?~#{}\[\]|`^&'()=+_-]+$/, {
        message: "L'email contient des caractères non autorisés"
    })
    email: string;

    @ApiProperty({
        example: 'SecurePass123!',
        description: 'Mot de passe de l\'utilisateur (min 8 caractères, avec majuscule, minuscule et chiffre)',
        required: true,
        minLength: 8,
        maxLength: 50,
    })
    @IsNotEmpty({ message: "Le mot de passe est obligatoire" })
    @Length(8, 50, {
        message: "Le mot de passe doit contenir entre 8 et 50 caractères",
    })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"
    })
    password: string;

    @ApiProperty({
        example: 'John Doe',
        description: 'Nom complet de l\'utilisateur',
        required: true,
        minLength: 3,
    })
    @IsNotEmpty({ message: "Le nom est obligatoire" })
    @IsString({ message: "Le nom doit être une chaîne de caractères" })
    @Length(3, 100, {
        message: "Le nom doit contenir entre 3 et 100 caractères",
    })
    @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
        message: "Le nom ne doit contenir que des lettres, espaces, apostrophes et tirets"
    })
    name: string;
}