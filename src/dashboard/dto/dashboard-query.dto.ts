import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DashboardQueryDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp5678efgh',
        description: 'Filtrer par magasin spécifique',
        required: false,
    })
    @IsOptional()
    @IsString({ message: "L'ID du magasin doit être une chaîne de caractères" })
    storeId?: string;

    @ApiProperty({
        example: '2024-02-01T00:00:00.000Z',
        description: 'Date de début pour les statistiques',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'La date de début doit être au format ISO 8601' })
    startDate?: string;

    @ApiProperty({
        example: '2024-02-28T23:59:59.999Z',
        description: 'Date de fin pour les statistiques',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'La date de fin doit être au format ISO 8601' })
    endDate?: string;
}