import { IsNotEmpty, IsString, IsOptional, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Électronique',
    description: 'Nom de la catégorie',
    required: true,
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: "Le nom de la catégorie est obligatoire" })
  @IsString({ message: "Le nom doit être une chaîne de caractères" })
  @Length(2, 100, {
    message: "Le nom doit contenir entre 2 et 100 caractères",
  })
  @Matches(/^[a-zA-Z0-9À-ÿ\s\-'&(),.]+$/, {
    message: "Le nom contient des caractères non autorisés",
  })
  name: string;

  @ApiProperty({
    example: 'Appareils électroniques, smartphones, ordinateurs, etc.',
    description: 'Description détaillée de la catégorie',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: "La description doit être une chaîne de caractères" })
  @Length(0, 500, {
    message: "La description ne peut pas dépasser 500 caractères",
  })
  description?: string;
}