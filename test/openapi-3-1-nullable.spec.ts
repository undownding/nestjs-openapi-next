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

    @ApiProperty({
      minimum: 1,
      exclusiveMinimum: true,
      maximum: 10,
      exclusiveMaximum: true
    })
    exclusive: number;
  }

  @Controller()
  class NullableController {
    @Get('nullable')
    @ApiOkResponse({ type: NullableDto })
    getNullable(): NullableDto {
      return { value: 'test', exclusive: 5 };
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
    const exclusiveSchema: any = nullableSchema.properties.exclusive;

    expect(propertySchema.nullable).toBeUndefined();
    expect(propertySchema.type).toEqual(
      expect.arrayContaining(['string', 'null'])
    );
    expect(exclusiveSchema.minimum).toBeUndefined();
    expect(exclusiveSchema.maximum).toBeUndefined();
    expect(exclusiveSchema.exclusiveMinimum).toBe(1);
    expect(exclusiveSchema.exclusiveMaximum).toBe(10);

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
    const exclusiveSchema: any = nullableSchema.properties.exclusive;

    expect(propertySchema.nullable).toBe(true);
    expect(propertySchema.type).toBe('string');
    expect(exclusiveSchema.exclusiveMinimum).toBe(true);
    expect(exclusiveSchema.exclusiveMaximum).toBe(true);
    expect(exclusiveSchema.minimum).toBe(1);
    expect(exclusiveSchema.maximum).toBe(10);

    await app.close();
  });
});
