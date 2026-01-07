import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiOkResponse, ApiProperty } from '../lib/decorators';
import { DocumentBuilder } from '../lib/document-builder';
import { SwaggerModule } from '../lib/swagger-module';

describe('OpenAPI 3.1 nullable handling', () => {
  class NullableDto {
    @ApiProperty({ nullable: true })
    value: string;
  }

  @Controller()
  class NullableController {
    @Get('nullable')
    @ApiOkResponse({ type: NullableDto })
    getNullable(): NullableDto {
      return { value: 'test' };
    }
  }

  @Module({ controllers: [NullableController] })
  class AppModule {}

  it('converts nullable flag to type union when OAS version is 3.1+', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('t')
      .setVersion('1')
      .setOpenAPIVersion('3.1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const nullableSchema: any = document.components.schemas.NullableDto as any;
    const propertySchema: any = nullableSchema.properties.value;

    expect(propertySchema.nullable).toBeUndefined();
    expect(propertySchema.type).toEqual(
      expect.arrayContaining(['string', 'null'])
    );

    await app.close();
  });

  it('keeps nullable flag for OAS 3.0 documents', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('t')
      .setVersion('1')
      .setOpenAPIVersion('3.0.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const nullableSchema: any = document.components.schemas.NullableDto as any;
    const propertySchema: any = nullableSchema.properties.value;

    expect(propertySchema.nullable).toBe(true);
    expect(propertySchema.type).toBe('string');

    await app.close();
  });
});
