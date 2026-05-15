import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { ApiResponse } from '../../lib/decorators/index.js';
import {
  ReferenceObject,
  SchemaObject
} from '../../lib/interfaces/open-api-spec.interface.js';
import { ResponseObjectFactory } from '../../lib/services/response-object-factory.js';

describe('ResponseObjectFactory', () => {
  let factory: ResponseObjectFactory;

  beforeEach(() => {
    factory = new ResponseObjectFactory(testStandardSchemaConverter);
  });

  const produces = ['application/json'];
  const factories = {
    linkName: () => 'link',
    operationId: () => 'op'
  };

  describe('standard schema responses', () => {
    it('should use a standard schema response override instead of the inferred type', () => {
      const schemas = {};
      const result = factory.create(
        {
          type: Number,
          description: 'OK',
          standardSchema: z.object({
            status: z.enum(['available', 'resting']).meta({
              description: 'Response status enum from Zod',
              example: 'available'
            }),
            result: z
              .union([
                z.string().email(),
                z.object({
                  message: z.string().meta({
                    description: 'Returned message from Zod',
                    example: 'No cat available'
                  })
                })
              ])
              .meta({ description: 'Response union from Zod' })
          })
        } as any,
        produces,
        schemas,
        factories
      ) as any;

      expect(result.content['application/json'].schema).toEqual(
        expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            status: {
              type: 'string',
              enum: ['available', 'resting'],
              description: 'Response status enum from Zod',
              example: 'available'
            },
            result: expect.objectContaining({
              description: 'Response union from Zod'
            })
          })
        })
      );
      expect(result.content['application/json'].schema.type).toBe('object');
      expect(result.content['application/json'].schema).not.toEqual({
        type: 'number'
      });
    });

    it('should preserve a standardSchema passed through ApiResponse metadata', () => {
      class Controller {
        @ApiResponse({
          status: 200,
          standardSchema: z.object({
            status: z.enum(['available', 'resting']).meta({
              description: 'Response status enum from Zod',
              example: 'available'
            })
          })
        })
        handler() {}
      }

      const metadata = Reflect.getMetadata(
        'swagger/apiResponse',
        Controller.prototype.handler
      );

      expect(metadata[200].type).toBeUndefined();
      expect(metadata[200].standardSchema).toBeDefined();
      expect((metadata[200].standardSchema as any)['~standard']?.vendor).toBe(
        'zod'
      );
    });

    it('should keep raw OpenAPI response schemas untouched', () => {
      const result = factory.create(
        {
          description: 'OK',
          schema: {
            type: 'object',
            properties: {
              message: {
                type: 'string'
              }
            }
          }
        } as any,
        produces,
        {},
        factories
      ) as any;

      expect(result.content['application/json'].schema).toEqual({
        type: 'object',
        properties: {
          message: {
            type: 'string'
          }
        }
      });
    });
  });
});

const testStandardSchemaConverter = (schema: unknown, { schemaType }: any) => {
  const vendor = (schema as { '~standard'?: { vendor?: string } })['~standard']
    ?.vendor;

  if (vendor !== 'zod') {
    return undefined;
  }

  const converted = createSchema(schema as never, {
    io: schemaType,
    openapiVersion: '3.0.0'
  });
  return {
    schema: converted.schema as SchemaObject | ReferenceObject,
    components: converted.components as unknown as Record<string, SchemaObject>
  };
};
