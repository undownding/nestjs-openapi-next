import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiTag, ApiTags } from '../lib/decorators';
import { DocumentBuilder } from '../lib/document-builder';
import { SwaggerModule } from '../lib/swagger-module';

describe.each(['3.0.0', '3.1.0'] as const)(
  'Document.tags merge behavior (OAS %s)',
  (openapi) => {
    it('keeps @ApiTags() tags when @ApiTag() introduces explicit document.tags', async () => {
      @ApiTags('TagA')
      @Controller('a')
      class AController {
        @Get()
        getA() {
          return { ok: true };
        }
      }

      @ApiTag({
        name: 'TagB',
        description: 'B operations'
      })
      @Controller('b')
      class BController {
        @Get()
        getB() {
          return { ok: true };
        }
      }

      @Module({ controllers: [AController, BController] })
      class AppModule {}

      const app = await NestFactory.create(AppModule, { logger: false });
      await app.init();

      const config = new DocumentBuilder()
        .setTitle('t')
        .setVersion('1')
        .setOpenAPIVersion(openapi)
        .build();

      const document = SwaggerModule.createDocument(app, config);

      expect(document.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'TagA' }),
          expect.objectContaining({ name: 'TagB', description: 'B operations' })
        ])
      );
      expect(document.paths['/a'].get.tags).toEqual(
        expect.arrayContaining(['TagA'])
      );
      expect(document.paths['/b'].get.tags).toEqual(
        expect.arrayContaining(['TagB'])
      );

      await app.close();
    });
  }
);

