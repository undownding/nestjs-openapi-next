import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiOkResponse, ApiProperty } from '../lib/decorators';
import { DocumentBuilder } from '../lib/document-builder';
import { SwaggerModule } from '../lib/swagger-module';

describe('OpenAPI 3.1 exclusiveMinimum/exclusiveMaximum handling', () => {
  class BoundsDto {
    @ApiProperty({
      minimum: 0,
      exclusiveMinimum: true,
      maximum: 100,
      exclusiveMaximum: true
    })
    value: number;
  }

  @Controller()
  class BoundsController {
    @Get('bounds')
    @ApiOkResponse({ type: BoundsDto })
    getBounds(): BoundsDto {
      return { value: 1 };
    }
  }

  @Module({ controllers: [BoundsController] })
  class AppModule {}

  it('converts boolean exclusive bounds into numeric boundaries when OAS version is 3.1+', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('t')
      .setVersion('1')
      .setOpenAPIVersion('3.1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const dtoSchema: any = document.components.schemas.BoundsDto as any;
    const propertySchema: any = dtoSchema.properties.value;

    expect(propertySchema.exclusiveMinimum).toBe(0);
    expect(propertySchema.exclusiveMaximum).toBe(100);
    expect(propertySchema.minimum).toBeUndefined();
    expect(propertySchema.maximum).toBeUndefined();

    await app.close();
  });

  it('keeps boolean exclusive bounds for OAS 3.0 documents', async () => {
    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('t')
      .setVersion('1')
      .setOpenAPIVersion('3.0.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const dtoSchema: any = document.components.schemas.BoundsDto as any;
    const propertySchema: any = dtoSchema.properties.value;

    expect(propertySchema.exclusiveMinimum).toBe(true);
    expect(propertySchema.exclusiveMaximum).toBe(true);
    expect(propertySchema.minimum).toBe(0);
    expect(propertySchema.maximum).toBe(100);

    await app.close();
  });
});

