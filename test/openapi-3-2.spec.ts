import 'reflect-metadata';
import { Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiProperty,
  ApiQueryMethod,
  ApiSecurityDeviceFlow,
  ApiStreamingResponse,
  ApiTagGroup
} from '../lib/decorators';
import { DocumentBuilder } from '../lib/document-builder';
import { SwaggerModule } from '../lib/swagger-module';

describe('OpenAPI 3.2 extensions', () => {
  it('supports HTTP QUERY method via @ApiQueryMethod()', async () => {
    @Controller()
    class QueryController {
      @Post('search')
      @ApiQueryMethod()
      search() {
        return { ok: true };
      }
    }

    @Module({ controllers: [QueryController] })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths['/search'].query).toBeDefined();
    expect((document.paths['/search'] as any).post).toBeUndefined();

    await app.close();
  });

  it('supports Enhanced Tags (parent/kind) via @ApiTagGroup()', async () => {
    @ApiTagGroup({
      name: 'Cats',
      summary: 'Cats',
      description: 'Cat operations',
      parent: 'Admin',
      kind: 'nav'
    })
    @Controller('cats')
    class CatsController {
      @Get()
      list() {
        return [];
      }
    }

    @Module({ controllers: [CatsController] })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Cats',
          summary: 'Cats',
          description: 'Cat operations',
          parent: 'Admin',
          kind: 'nav'
        })
      ])
    );
    expect(document.paths['/cats'].get.tags).toEqual(
      expect.arrayContaining(['Cats'])
    );

    await app.close();
  });

  it('supports streaming responses via @ApiStreamingResponse() (itemSchema + SSE)', async () => {
    class SseItemDto {
      @ApiProperty()
      id: string;
    }

    @Controller()
    class EventsController {
      @Get('events')
      @ApiStreamingResponse({
        status: 200,
        contentType: 'text/event-stream',
        type: () => SseItemDto
      })
      stream() {
        return null;
      }
    }

    @Module({ controllers: [EventsController] })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder().setTitle('t').setVersion('1').build();
    const document = SwaggerModule.createDocument(app, config);

    const response200 = (document.paths['/events'].get.responses as any)['200'];
    expect(response200.content['text/event-stream']).toBeDefined();
    expect(response200.content['text/event-stream'].itemSchema).toEqual({
      $ref: '#/components/schemas/SseItemDto'
    });
    expect(document.components?.schemas?.SseItemDto).toBeDefined();

    await app.close();
  });

  it('supports OAuth2 deviceAuthorization flow in security schemes + requirements', async () => {
    @Controller()
    class SecuredController {
      @Get('secure')
      @ApiSecurityDeviceFlow('oauth2', ['read'])
      secure() {
        return { ok: true };
      }
    }

    @Module({ controllers: [SecuredController] })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('t')
      .setVersion('1')
      .addOAuth2(
        {
          type: 'oauth2',
          flows: {
            deviceAuthorization: {
              deviceAuthorizationUrl: 'https://example.com/device',
              tokenUrl: 'https://example.com/token',
              scopes: { read: 'Read access' }
            }
          }
        },
        'oauth2'
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    expect(
      (document.components?.securitySchemes as any).oauth2.flows
        .deviceAuthorization
    ).toEqual(
      expect.objectContaining({
        deviceAuthorizationUrl: 'https://example.com/device',
        tokenUrl: 'https://example.com/token',
        scopes: { read: 'Read access' }
      })
    );
    expect(document.paths['/secure'].get.security).toEqual([
      { oauth2: ['read'] }
    ]);

    await app.close();
  });
});

