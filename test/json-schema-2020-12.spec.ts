import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiOkResponse, ApiProperty } from '../lib/decorators';
import { DocumentBuilder } from '../lib/document-builder';
import { SwaggerModule } from '../lib/swagger-module';
import { SchemaObject } from '../lib/interfaces/open-api-spec.interface';

describe('JSON Schema Draft 2020-12 interface support', () => {
  describe('SchemaObject interface', () => {
    it('should support $schema keyword', () => {
      const schema: SchemaObject = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object'
      };
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema'
      );
    });

    it('should support $id keyword', () => {
      const schema: SchemaObject = {
        $id: 'https://example.com/schemas/user',
        type: 'object'
      };
      expect(schema.$id).toBe('https://example.com/schemas/user');
    });

    it('should support $defs keyword', () => {
      const schema: SchemaObject = {
        $defs: {
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' }
            }
          }
        },
        type: 'object',
        properties: {
          homeAddress: { $ref: '#/$defs/address' },
          workAddress: { $ref: '#/$defs/address' }
        }
      };
      expect(schema.$defs).toBeDefined();
      expect(schema.$defs?.address).toBeDefined();
    });

    it('should support $dynamicAnchor and $dynamicRef keywords', () => {
      const schema: SchemaObject = {
        $dynamicAnchor: 'node',
        type: 'object',
        properties: {
          children: {
            type: 'array',
            items: { $dynamicRef: '#node' }
          }
        }
      };
      expect(schema.$dynamicAnchor).toBe('node');
      expect(schema.properties?.children).toBeDefined();
    });

    it('should support $anchor keyword', () => {
      const schema: SchemaObject = {
        $anchor: 'my-anchor',
        type: 'string'
      };
      expect(schema.$anchor).toBe('my-anchor');
    });

    it('should support const keyword', () => {
      const schema: SchemaObject = {
        const: 'fixed-value'
      };
      expect(schema.const).toBe('fixed-value');
    });

    it('should support contentMediaType and contentEncoding keywords', () => {
      const schema: SchemaObject = {
        type: 'string',
        contentMediaType: 'image/png',
        contentEncoding: 'base64'
      };
      expect(schema.contentMediaType).toBe('image/png');
      expect(schema.contentEncoding).toBe('base64');
    });

    it('should support contentSchema keyword', () => {
      const schema: SchemaObject = {
        type: 'string',
        contentMediaType: 'application/json',
        contentSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      };
      expect(schema.contentSchema).toBeDefined();
    });

    it('should support if/then/else conditional schema', () => {
      const schema: SchemaObject = {
        type: 'object',
        if: {
          properties: {
            type: { const: 'business' }
          }
        },
        then: {
          properties: {
            taxId: { type: 'string' }
          },
          required: ['taxId']
        },
        else: {
          properties: {
            ssn: { type: 'string' }
          }
        }
      };
      expect(schema.if).toBeDefined();
      expect(schema.then).toBeDefined();
      expect(schema.else).toBeDefined();
    });

    it('should support dependentSchemas keyword', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          creditCard: { type: 'string' }
        },
        dependentSchemas: {
          creditCard: {
            properties: {
              billingAddress: { type: 'string' }
            },
            required: ['billingAddress']
          }
        }
      };
      expect(schema.dependentSchemas).toBeDefined();
      expect(schema.dependentSchemas?.creditCard).toBeDefined();
    });

    it('should support dependentRequired keyword', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          creditCard: { type: 'string' },
          billingAddress: { type: 'string' }
        },
        dependentRequired: {
          creditCard: ['billingAddress']
        }
      };
      expect(schema.dependentRequired).toBeDefined();
      expect(schema.dependentRequired?.creditCard).toEqual(['billingAddress']);
    });

    it('should support prefixItems keyword for tuple validation', () => {
      const schema: SchemaObject = {
        type: 'array',
        prefixItems: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' }
        ],
        items: false
      };
      expect(schema.prefixItems).toBeDefined();
      expect(schema.prefixItems?.length).toBe(3);
    });

    it('should support unevaluatedProperties keyword', () => {
      const schema: SchemaObject = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        unevaluatedProperties: false
      };
      expect(schema.unevaluatedProperties).toBe(false);
    });

    it('should support unevaluatedItems keyword', () => {
      const schema: SchemaObject = {
        type: 'array',
        prefixItems: [{ type: 'string' }],
        unevaluatedItems: false
      };
      expect(schema.unevaluatedItems).toBe(false);
    });

    it('should support contains keyword', () => {
      const schema: SchemaObject = {
        type: 'array',
        contains: { type: 'number' }
      };
      expect(schema.contains).toBeDefined();
    });

    it('should support minContains and maxContains keywords', () => {
      const schema: SchemaObject = {
        type: 'array',
        contains: { type: 'number' },
        minContains: 1,
        maxContains: 5
      };
      expect(schema.minContains).toBe(1);
      expect(schema.maxContains).toBe(5);
    });

    it('should support $comment keyword', () => {
      const schema: SchemaObject = {
        $comment: 'This is a schema comment for developers',
        type: 'string'
      };
      expect(schema.$comment).toBe(
        'This is a schema comment for developers'
      );
    });

    it('should support propertyNames keyword', () => {
      const schema: SchemaObject = {
        type: 'object',
        propertyNames: {
          pattern: '^[a-z]+$'
        }
      };
      expect(schema.propertyNames).toBeDefined();
    });
  });

  describe('JSON Schema 2020-12 integration with OpenAPI', () => {
    class JsonSchema2020Dto {
      @ApiProperty({
        description: 'A property with const value',
        const: 'FIXED_VALUE'
      } as any)
      constProperty: string;

      @ApiProperty({
        description: 'Base64 encoded image',
        contentMediaType: 'image/png',
        contentEncoding: 'base64'
      } as any)
      imageData: string;
    }

    @Controller()
    class JsonSchemaController {
      @Get('schema')
      @ApiOkResponse({ type: JsonSchema2020Dto })
      getSchema(): JsonSchema2020Dto {
        return { constProperty: 'FIXED_VALUE', imageData: '' };
      }
    }

    @Module({ controllers: [JsonSchemaController] })
    class AppModule {}

    it('should accept schemas with JSON Schema 2020-12 keywords in OAS 3.1 document', async () => {
      const app = await NestFactory.create(AppModule, { logger: false });
      await app.init();

      const config = new DocumentBuilder()
        .setTitle('Test API')
        .setVersion('1.0.0')
        .setOpenAPIVersion('3.1.0')
        .build();

      const document = SwaggerModule.createDocument(app, config);

      // Verify the document was created successfully
      expect(document.openapi).toBe('3.1.0');
      expect(document.components?.schemas?.JsonSchema2020Dto).toBeDefined();

      await app.close();
    });
  });
});
