import { Expose, Transform } from 'class-transformer';
import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '../../../lib/decorators/index.js';
import { METADATA_FACTORY_NAME } from '../../../lib/plugin/plugin-constants.js';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEnum(['admin', 'user'])
  role: string;

  @ApiProperty({ required: true })
  login: string;

  @Expose()
  @Transform((str) => str + '_transformed')
  @IsString()
  @ApiProperty({ minLength: 10 })
  password: string;

  static [METADATA_FACTORY_NAME]() {
    return {
      firstName: { required: true, type: String },
      lastName: { required: true, type: String }
    };
  }
}
