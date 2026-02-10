import {
    IsNotEmpty,
    IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCashRegisterDto {
    @ApiProperty({
        example: 'clx7b8k9l0000xtqp9876mnop',
        description: 'ID du nouvel utilisateur à qui assigner la caisse',
        required: true,
    })
    @IsNotEmpty({ message: "L'ID de l'utilisateur est obligatoire" })
    @IsString({ message: "L'ID de l'utilisateur doit être une chaîne de caractères" })
    userId: string;
}