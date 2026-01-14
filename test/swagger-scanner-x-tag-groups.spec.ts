import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiTag } from '../lib/decorators';
import { SwaggerScanner } from '../lib/swagger-scanner';

describe('SwaggerScanner', () => {
  it('includes root-level x-tagGroups when scanning Enhanced Tags (parent)', async () => {
    @ApiTag({
      name: 'Customers',
      summary: 'Customers'
    })
    @Controller('customers')
    class CustomersController {
      @Get()
      list() {
        return [];
      }
    }

    @ApiTag({
      name: 'Customer Authentication',
      parent: 'Customers'
    })
    @Controller('auth')
    class CustomerAuthController {
      @Get()
      auth() {
        return { ok: true };
      }
    }

    @ApiTag({
      name: 'AML',
      parent: 'Customers'
    })
    @Controller('aml')
    class AmlController {
      @Get()
      aml() {
        return { ok: true };
      }
    }

    @Module({
      controllers: [CustomersController, CustomerAuthController, AmlController]
    })
    class AppModule {}

    const app = await NestFactory.create(AppModule, { logger: false });
    await app.init();

    const scanner = new SwaggerScanner();
    const scanned = scanner.scanApplication(app, {} as any);

    expect(scanned.tags).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Customers' })])
    );

    const xTagGroups = (scanned as any)['x-tagGroups'];
    expect(xTagGroups).toBeDefined();
    expect(xTagGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Customers',
          tags: expect.arrayContaining(['Customers', 'Customer Authentication', 'AML'])
        })
      ])
    );

    const customersGroup = (xTagGroups || []).find((g: any) => g.name === 'Customers');
    expect(customersGroup?.tags[0]).toBe('Customers');

    await app.close();
  });

  it('includes a standalone x-tagGroups entry for tags without parent but used by operations', async () => {
    @ApiTag({
      name: 'Cats',
      summary: 'Cats'
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

    const scanner = new SwaggerScanner();
    const scanned = scanner.scanApplication(app, {} as any);

    const xTagGroups = (scanned as any)['x-tagGroups'];
    expect(xTagGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Cats',
          tags: ['Cats']
        })
      ])
    );

    await app.close();
  });
});

