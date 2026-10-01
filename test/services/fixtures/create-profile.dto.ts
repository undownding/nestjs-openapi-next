import 'reflect-metadata';
import { ApiProperty } from '../../../lib/decorators/index.js';
import { CreateUserDto } from './create-user.dto.js';

export class CreateProfileDto {
  @ApiProperty()
  firstname: string;

  @ApiProperty()
  lastname: string;

  @ApiProperty({
    type: () => CreateUserDto,
    name: 'parent'
  })
  parent: CreateUserDto;
}
