import { vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import { z } from 'zod';
import { createSchema } from 'zod-openapi';
import { ApiExtension, ApiProperty, ApiSchema } from '../../lib/decorators/index.js';
import { StandardSchemaConverter } from '../../lib/interfaces/index.js';
import {
  BaseParameterObject,
  ReferenceObject,
  SchemaObject,
  SchemasObject
} from '../../lib/interfaces/open-api-spec.interface.js';
import { ModelPropertiesAccessor } from '../../lib/services/model-properties-accessor.js';
import { ParamWithTypeMetadata } from '../../lib/services/parameter-metadata-accessor.js';
import { SchemaObjectFactory } from '../../lib/services/schema-object-factory.js';
import { SwaggerTypesMapper } from '../../lib/services/swagger-types-mapper.js';
import { CreateUserDto } from './fixtures/create-user.dto.js';

describe('SchemaObjectFactory', () => {
  let modelPropertiesAccessor: ModelPropertiesAccessor;
  let swaggerTypesMapper: SwaggerTypesMapper;
  let schemaObjectFactory: SchemaObjectFactory;

  beforeEach(() => {
    modelPropertiesAccessor = new ModelPropertiesAccessor();
    swaggerTypesMapper = new SwaggerTypesMapper();
    schemaObjectFactory = new SchemaObjectFactory(
      modelPropertiesAccessor,
      swaggerTypesMapper,
      testStandardSchemaConverter
    );
  });

  describe('exploreModelSchema', () => {
    enum Role {
      Admin = 'admin',
      User = 'user'
    }

    enum Group {
      User = 'user',
      Guest = 'guest',
      Family = 'family',
      Neighboard = 'neighboard'
    }

    enum Ranking {
      First = 1,
      Second = 2,
      Third = 3
    }

    enum HairColour {
      Brown = 'Brown',
      Blond = 'Blond',
      Ginger = 'Ginger'
    }

    class CreatePersonDto {
      @ApiProperty()
      name: string;
      @ApiProperty({ enum: Role, enumName: 'Role' })
      role: Role;
    }

    it('should convert zod standard schemas into an OpenAPI override', () => {
      class QueryDto {
        value: number;
      }

      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: QueryDto,
          name: 'filter',
          required: true,
          standardSchema: z.object({
            value: z.string(),
            tags: z.array(z.number())
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          in: 'query',
          name: 'filter',
          required: true,
          schema: expect.objectContaining({
            type: 'object',
            properties: {
              value: { type: 'string' },
              tags: {
                type: 'array',
                items: { type: 'number' }
              }
            },
            required: ['value', 'tags']
          })
        })
      ]);
    });

    it('should preserve OpenAPI metadata on zod overrides', () => {
      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: String,
          name: 'filter',
          required: true,
          standardSchema: z.string().meta({
            description: 'filter description',
            example: 'cats'
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          schema: {
            type: 'string',
            description: 'filter description',
            example: 'cats'
          }
        })
      ]);
    });

    it('should preserve zod unions, enums, and nested OpenAPI metadata on overrides', () => {
      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          name: 'filter',
          type: Object,
          required: true,
          standardSchema: z.object({
            species: z.enum(['cat', 'dog']).meta({
              title: 'Species',
              description: 'Species enum from Zod',
              example: 'cat'
            }),
            contact: z
              .union([
                z.string().email(),
                z.object({
                  phone: z.string().meta({
                    description: 'Phone number from Zod',
                    example: '123-456'
                  })
                })
              ])
              .meta({
                title: 'PreferredContact',
                description: 'Preferred contact from Zod',
                examples: ['owner@example.com']
              }),
            profile: z
              .object({
                nickname: z.string().meta({
                  description: 'Nested nickname from Zod',
                  example: 'Captain Whiskers'
                })
              })
              .meta({
                title: 'CatProfile',
                description: 'Nested cat profile from Zod'
              })
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);
      const parameter = result[0] as any;

      expect(parameter.schema.properties.species).toEqual({
        type: 'string',
        enum: ['cat', 'dog'],
        title: 'Species',
        description: 'Species enum from Zod',
        example: 'cat'
      });
      expect(parameter.schema.properties.contact).toEqual(
        expect.objectContaining({
          title: 'PreferredContact',
          description: 'Preferred contact from Zod'
        })
      );
      expect(parameter.schema.properties.profile).toEqual(
        expect.objectContaining({
          title: 'CatProfile',
          description: 'Nested cat profile from Zod',
          properties: expect.objectContaining({
            nickname: {
              type: 'string',
              description: 'Nested nickname from Zod',
              example: 'Captain Whiskers'
            }
          })
        })
      );
    });

    it('should convert valibot standard schemas into query properties', () => {
      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: Object,
          required: true,
          standardSchema: v.object({
            page: v.number(),
            search: v.optional(v.string())
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          in: 'query',
          name: 'page',
          required: true,
          schema: { type: 'number' }
        }),
        expect.objectContaining({
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string' }
        })
      ]);
    });

    it('should preserve OpenAPI metadata on valibot overrides', () => {
      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: Object,
          required: true,
          standardSchema: v.object({
            name: v.pipe(v.string(), v.description('cat name')),
            search: v.pipe(v.optional(v.string()), v.title('Search term'))
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          name: 'name',
          required: true,
          schema: { type: 'string', description: 'cat name' }
        }),
        expect.objectContaining({
          name: 'search',
          required: false,
          schema: { type: 'string', title: 'Search term' }
        })
      ]);
    });

    it('should expand valibot unions, enums, and nested metadata into query parameters', () => {
      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: Object,
          required: true,
          standardSchema: v.object({
            mode: v.pipe(
              v.picklist(['simple', 'advanced']),
              v.description('Mode enum from Valibot'),
              v.examples(['simple'])
            ),
            filter: v.pipe(
              v.union([
                v.string(),
                v.object({
                  nested: v.pipe(
                    v.string(),
                    v.description('Nested filter from Valibot'),
                    v.examples(['persian'])
                  )
                })
              ]),
              v.title('FilterTitle'),
              v.description('Filter union from Valibot')
            ),
            details: v.pipe(
              v.object({
                label: v.pipe(
                  v.string(),
                  v.description('Nested label from Valibot'),
                  v.examples(['primary'])
                )
              }),
              v.title('Details title from Valibot'),
              v.description('Nested details from Valibot')
            )
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);
      const mode = result.find(
        (parameter: any) => parameter.name === 'mode'
      ) as any;
      const filter = result.find(
        (parameter: any) => parameter.name === 'filter'
      ) as any;
      const details = result.find(
        (parameter: any) => parameter.name === 'details'
      ) as any;

      expect(mode.schema).toEqual(
        expect.objectContaining({
          type: 'string',
          enum: ['simple', 'advanced'],
          description: 'Mode enum from Valibot'
        })
      );
      expect((mode.schema.examples ?? [mode.schema.example])[0]).toBe('simple');
      expect(filter.schema).toEqual(
        expect.objectContaining({
          title: 'FilterTitle',
          description: 'Filter union from Valibot'
        })
      );
      expect(details.schema).toEqual(
        expect.objectContaining({
          type: 'object',
          title: 'Details title from Valibot',
          description: 'Nested details from Valibot',
          properties: expect.objectContaining({
            label: expect.objectContaining({
              type: 'string',
              description: 'Nested label from Valibot'
            })
          })
        })
      );
    });

    class Person {
      @ApiProperty({ enum: Role, enumName: 'Role' })
      role: Role;

      @ApiProperty({ enum: Role, enumName: 'Role', isArray: true })
      roles: Role[];

      @ApiProperty({ enum: Group, enumName: 'Group', isArray: true })
      groups: Group[];

      @ApiProperty({ enum: Ranking, enumName: 'Ranking', isArray: true })
      rankings: Ranking[];

      @ApiProperty({ enum: () => HairColour, enumName: 'HairColour' })
      hairColour: HairColour;

      @ApiProperty({
        enum: () => ['Pizza', 'Burger', 'Salad'],
        enumName: 'Food',
        isArray: true
      })
      favouriteFoods: string[];
    }

    it('should explore enum', () => {
      const schemas: Record<string, SchemasObject> = {};
      schemaObjectFactory.exploreModelSchema(Person, schemas);

      expect(Object.keys(schemas)).toHaveLength(6);

      expect(schemas).toHaveProperty('Role');
      expect(schemas.Role).toEqual({
        type: 'string',
        enum: ['admin', 'user']
      });
      expect(schemas.Group).toEqual({
        type: 'string',
        enum: ['user', 'guest', 'family', 'neighboard']
      });
      expect(schemas.Ranking).toEqual({
        type: 'number',
        enum: [1, 2, 3]
      });
      expect(schemas.HairColour).toEqual({
        type: 'string',
        enum: ['Brown', 'Blond', 'Ginger']
      });
      expect(schemas).toHaveProperty('Person');
      expect(schemas.Person).toEqual({
        type: 'object',
        properties: {
          role: {
            allOf: [
              {
                $ref: '#/components/schemas/Role'
              }
            ]
          },
          roles: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Role'
            }
          },
          groups: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Group'
            }
          },
          rankings: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Ranking'
            }
          },
          favouriteFoods: {
            items: {
              $ref: '#/components/schemas/Food'
            },
            type: 'array'
          },
          hairColour: {
            allOf: [
              {
                $ref: '#/components/schemas/HairColour'
              }
            ]
          }
        },
        required: [
          'role',
          'roles',
          'groups',
          'rankings',
          'hairColour',
          'favouriteFoods'
        ]
      });
      schemaObjectFactory.exploreModelSchema(CreatePersonDto, schemas);

      expect(Object.keys(schemas)).toHaveLength(7);
      expect(schemas).toHaveProperty('CreatePersonDto');
      expect(schemas.CreatePersonDto).toEqual({
        type: 'object',
        properties: {
          name: {
            type: 'string'
          },
          role: {
            allOf: [
              {
                $ref: '#/components/schemas/Role'
              }
            ]
          }
        },
        required: ['name', 'role']
      });
    });

    it('should log an error when detecting duplicate DTOs with different schemas', () => {
      const loggerErrorSpy = vi.spyOn(Logger, 'error').mockImplementation();
      const schemas: Record<string, SchemasObject> = {};

      class DuplicateDTO {
        @ApiProperty()
        property1: string;
      }

      schemaObjectFactory.exploreModelSchema(DuplicateDTO, schemas);

      class DuplicateDTOWithDifferentSchema {
        @ApiProperty()
        property2: string;
      }

      Object.defineProperty(DuplicateDTOWithDifferentSchema, 'name', {
        value: 'DuplicateDTO'
      });

      schemaObjectFactory.exploreModelSchema(
        DuplicateDTOWithDifferentSchema,
        schemas
      );

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Duplicate DTO detected: "DuplicateDTO" is defined multiple times with different schemas.\n` +
          `Consider using unique class names or applying @ApiExtraModels() decorator with custom schema names.\n` +
          `Note: This will throw an error in the next major version.`
      );

      loggerErrorSpy.mockRestore();
    });

    it('should not throw an error or log error when detecting duplicate DTOs with the same schemas', () => {
      const loggerErrorSpy = vi.spyOn(Logger, 'error').mockImplementation();
      const schemas: Record<string, SchemasObject> = {};

      class DuplicateDTO {
        @ApiProperty()
        property1: string;
      }

      schemaObjectFactory.exploreModelSchema(DuplicateDTO, schemas);

      class DuplicateDTOWithSameSchema {
        @ApiProperty()
        property1: string;
      }

      Object.defineProperty(DuplicateDTOWithSameSchema, 'name', {
        value: 'DuplicateDTO'
      });

      schemaObjectFactory.exploreModelSchema(
        DuplicateDTOWithSameSchema,
        schemas
      );

      expect(loggerErrorSpy).not.toHaveBeenCalled();

      loggerErrorSpy.mockRestore();
    });

    it('should create openapi schema', () => {
      const schemas: Record<string, SchemasObject> = {};
      const schemaKey = schemaObjectFactory.exploreModelSchema(
        CreateUserDto,
        schemas
      );

      expect(schemas[schemaKey]).toEqual({
        type: 'object',
        properties: {
          login: {
            type: 'string'
          },
          password: {
            type: 'string',
            example: 'password123'
          },
          houses: {
            items: {
              $ref: '#/components/schemas/House'
            },
            type: 'array'
          },
          age: {
            type: 'number',
            format: 'int64',
            example: 10
          },
          amount: {
            type: 'integer',
            format: 'int64'
          },
          createdAt: {
            format: 'date-time',
            type: 'string'
          },
          custom: {
            readOnly: true,
            type: 'array',
            maxItems: 10,
            minItems: 1,
            items: {
              type: 'array',
              items: {
                type: 'number'
              }
            }
          },
          profile: {
            description: 'Profile',
            nullable: true,
            allOf: [
              {
                $ref: '#/components/schemas/CreateProfileDto'
              }
            ]
          },
          tags: {
            items: {
              type: 'string'
            },
            type: 'array'
          },
          twoDimensionPrimitives: {
            items: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            type: 'array'
          },
          twoDimensionModels: {
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CreateProfileDto'
              }
            },
            type: 'array'
          },
          urls: {
            items: {
              format: 'uri',
              type: 'string'
            },
            type: 'array'
          },
          luckyNumbers: {
            type: 'array',
            items: {
              type: 'integer'
            }
          },
          options: {
            items: {
              properties: {
                isReadonly: {
                  type: 'string'
                }
              },
              type: 'object'
            },
            type: 'array'
          },
          allOf: {
            oneOf: [
              { $ref: '#/components/schemas/Cat' },
              { $ref: '#/components/schemas/Dog' }
            ],
            discriminator: { propertyName: 'pet_type' }
          },
          formatArray: {
            type: 'array',
            items: {
              type: 'string',
              format: 'uuid'
            }
          }
        },
        required: [
          'login',
          'password',
          'profile',
          'tags',
          'twoDimensionPrimitives',
          'twoDimensionModels',
          'urls',
          'luckyNumbers',
          'options',
          'allOf',
          'houses',
          'createdAt',
          'amount',
          'formatArray'
        ]
      });
      expect(schemas['CreateProfileDto']).toEqual({
        type: 'object',
        properties: {
          firstname: {
            type: 'string'
          },
          lastname: {
            type: 'string'
          },
          parent: {
            $ref: '#/components/schemas/CreateUserDto'
          }
        },
        required: ['firstname', 'lastname', 'parent']
      });
    });

    it('should purge linked types from properties', () => {
      class Human {
        @ApiProperty()
        id: string;

        @ApiProperty({ link: () => Human })
        spouseId: string;
      }

      const schemas: Record<string, SchemasObject> = {};

      schemaObjectFactory.exploreModelSchema(Human, schemas);
      expect(schemas[Human.name]).toEqual({
        type: 'object',
        properties: {
          id: {
            type: 'string'
          },
          spouseId: {
            type: 'string'
          }
        },
        required: ['id', 'spouseId']
      });
    });

    it('should override base class metadata', () => {
      class CreatUserDto {
        @ApiProperty({ minLength: 0, required: true })
        name: string;
      }

      class UpdateUserDto extends CreatUserDto {
        @ApiProperty({ minLength: 1, required: false })
        name: string;
      }

      const schemas: Record<string, SchemasObject> = {};

      schemaObjectFactory.exploreModelSchema(CreatUserDto, schemas);
      schemaObjectFactory.exploreModelSchema(UpdateUserDto, schemas);

      expect(schemas[CreatUserDto.name]).toEqual({
        type: 'object',
        properties: { name: { type: 'string', minLength: 0 } },
        required: ['name']
      });

      expect(schemas[UpdateUserDto.name]).toEqual({
        type: 'object',
        properties: { name: { type: 'string', minLength: 1 } }
      });
    });

    describe('@ApiSchema', () => {
      it('should use the class name when no options object was passed', () => {
        @ApiSchema()
        class CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(CreateUserDto, schemas);

        expect(Object.keys(schemas)).toContain('CreateUserDto');
      });

      it('should use the class name when the options object is empty', () => {
        @ApiSchema({})
        class CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(CreateUserDto, schemas);

        expect(Object.keys(schemas)).toContain('CreateUserDto');
      });

      it('should use the schema name instead of class name', () => {
        @ApiSchema({
          name: 'CreateUser'
        })
        class CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(CreateUserDto, schemas);

        expect(Object.keys(schemas)).toContain('CreateUser');
      });

      it('should not use the schema name of the base class', () => {
        @ApiSchema({
          name: 'CreateUser'
        })
        class CreateUserDto {}

        class UpdateUserDto extends CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(UpdateUserDto, schemas);

        expect(Object.keys(schemas)).toContain('UpdateUserDto');
      });

      it('should override the schema name of the base class', () => {
        @ApiSchema({
          name: 'CreateUser'
        })
        class CreateUserDto {}

        @ApiSchema({
          name: 'UpdateUser'
        })
        class UpdateUserDto extends CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(UpdateUserDto, schemas);

        expect(Object.keys(schemas)).toContain('UpdateUser');
      });

      it('should correctly handle recursive schema references in ApiSchema decorator', () => {
        @ApiSchema({ name: 'MenuNode' })
        class MenuNodeDto {
          @ApiProperty({ type: () => MenuNodeDto })
          childNode: MenuNodeDto;
        }

        @ApiSchema({ name: 'Menu' })
        class MenuDto {
          @ApiProperty({ type: () => MenuNodeDto })
          rootNode: MenuNodeDto;
        }

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(MenuDto, schemas);

        expect(schemas['MenuNode'].properties['childNode']['$ref']).toEqual(
          '#/components/schemas/MenuNode'
        );

        expect(schemas['Menu'].properties['rootNode']['$ref']).toEqual(
          '#/components/schemas/MenuNode'
        );
      });

      it('should use the the description if provided', () => {
        @ApiSchema({
          description: 'Represents a user.'
        })
        class CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(CreateUserDto, schemas);

        expect(schemas[CreateUserDto.name].description).toEqual(
          'Represents a user.'
        );
      });

      it('should not use the the description of the base class', () => {
        @ApiSchema({
          description: 'Represents a user.'
        })
        class CreateUserDto {}

        @ApiSchema({
          description: 'Represents a user update.'
        })
        class UpdateUserDto extends CreateUserDto {}

        const schemas: Record<string, SchemasObject> = {};

        schemaObjectFactory.exploreModelSchema(UpdateUserDto, schemas);

        expect(schemas[UpdateUserDto.name].description).toEqual(
          'Represents a user update.'
        );
      });
    });

    it('should include extension properties', () => {
      @ApiExtension('x-test', 'value')
      class CreatUserDto {
        @ApiProperty({ minLength: 0, required: true })
        name: string;
      }

      const schemas: Record<string, SchemasObject> = {};

      schemaObjectFactory.exploreModelSchema(CreatUserDto, schemas);

      expect(schemas[CreatUserDto.name]['x-test']).toEqual('value');
    });

    it('should create arrays of objects', () => {
      class ObjectDto {
        @ApiProperty()
        field: string;
      }

      class TestDto {
        @ApiProperty()
        arrayOfStrings: string[];
      }

      class Test2Dto {
        @ApiProperty({
          isArray: true,
          type: ObjectDto
        })
        arrayOfObjects: ObjectDto[];
      }

      const schemas = {};
      schemaObjectFactory.exploreModelSchema(TestDto, schemas);
      schemaObjectFactory.exploreModelSchema(Test2Dto, schemas);

      expect(schemas[TestDto.name]).toEqual({
        type: 'object',
        properties: {
          arrayOfStrings: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        },
        required: ['arrayOfStrings']
      });
      expect(schemas[Test2Dto.name]).toEqual({
        type: 'object',
        properties: {
          arrayOfObjects: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ObjectDto'
            }
          }
        },
        required: ['arrayOfObjects']
      });
    });

    it('should not use undefined enum', () => {
      class TestDto {
        @ApiProperty({
          type: 'string',
          enum: undefined
        })
        testString: string;
      }

      const schemas = {};
      schemaObjectFactory.exploreModelSchema(TestDto, schemas);
      expect(schemas[TestDto.name]).toEqual({
        type: 'object',
        properties: {
          testString: {
            type: 'string'
          }
        },
        required: ['testString']
      });
    });

    it('should not use undefined enum on array', () => {
      class TestDto {
        @ApiProperty({
          type: 'string',
          isArray: true,
          enum: undefined
        })
        testStringArray: string[];
      }

      const schemas = {};
      schemaObjectFactory.exploreModelSchema(TestDto, schemas);
      expect(schemas[TestDto.name]).toEqual({
        type: 'object',
        properties: {
          testStringArray: {
            type: 'array',
            items: {
              type: 'string'
            }
          }
        },
        required: ['testStringArray']
      });
    });
  });

  describe('createEnumSchemaType', () => {
    it('should assign schema type correctly if enumName is provided', () => {
      const metadata = {
        type: 'number',
        enum: [1, 2, 3],
        enumName: 'MyEnum',
        isArray: false
      } as const;
      const schemas = {};

      schemaObjectFactory.createEnumSchemaType('field', metadata, schemas);

      expect(schemas).toEqual({ MyEnum: { enum: [1, 2, 3], type: 'number' } });
    });
  });

  describe('createEnumParam', () => {
    it('should create an enum schema definition', () => {
      const params: ParamWithTypeMetadata & BaseParameterObject = {
        required: true,
        isArray: false,
        enumName: 'MyEnum',
        enum: ['a', 'b', 'c']
      };
      const schemas = {};
      schemaObjectFactory.createEnumParam(params, schemas);

      expect(schemas['MyEnum']).toEqual({
        enum: ['a', 'b', 'c'],
        type: 'string'
      });
    });

    it('should create an enum schema definition for an array', () => {
      const params: ParamWithTypeMetadata & BaseParameterObject = {
        required: true,
        isArray: true,
        enumName: 'MyEnum',
        schema: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['a', 'b', 'c']
          }
        }
      };
      const schemas = {};
      schemaObjectFactory.createEnumParam(params, schemas);

      expect(schemas['MyEnum']).toEqual({
        enum: ['a', 'b', 'c'],
        type: 'string'
      });
    });
  });

  describe('createFromModel', () => {
    it('should override an inferred named query type with a standard schema', () => {
      class QueryDto {
        value: string;
      }

      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: QueryDto,
          name: 'filter',
          required: true,
          standardSchema: createStandardSchema({
            type: 'string',
            pattern: '^foo'
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          in: 'query',
          name: 'filter',
          schema: {
            type: 'string',
            pattern: '^foo'
          }
        })
      ]);
    });

    it('should override an inferred body type with a standard schema', () => {
      class BodyDto {
        value: number;
      }

      const schemas: Record<string, SchemasObject> = {};
      const bodyParams: ParamWithTypeMetadata[] = [
        {
          in: 'body',
          type: BodyDto,
          required: true,
          standardSchema: z.object({
            value: z.string()
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(bodyParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          in: 'body',
          name: 'BodyDto',
          schema: expect.objectContaining({
            type: 'object',
            properties: {
              value: { type: 'string' }
            },
            required: ['value']
          })
        })
      ]);
    });

    it('should expand unnamed query standard schemas into parameter properties', () => {
      const schemas: Record<string, SchemasObject> = {};
      const queryParams: ParamWithTypeMetadata[] = [
        {
          in: 'query',
          type: Object,
          required: true,
          standardSchema: createStandardSchema({
            type: 'object',
            required: ['limit'],
            properties: {
              limit: {
                type: 'integer',
                minimum: 1
              },
              search: {
                type: 'string'
              }
            }
          })
        } as any
      ];

      const result = schemaObjectFactory.createFromModel(queryParams, schemas);

      expect(result).toEqual([
        expect.objectContaining({
          in: 'query',
          name: 'limit',
          required: true,
          schema: {
            type: 'integer',
            minimum: 1
          }
        }),
        expect.objectContaining({
          in: 'query',
          name: 'search',
          required: false,
          schema: {
            type: 'string'
          }
        })
      ]);
    });
  });

  function createStandardSchema(schema: Record<string, unknown>) {
    return {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) => ({ value }),
        jsonSchema: {
          input: () => schema
        }
      }
    };
  }

  const testStandardSchemaConverter: StandardSchemaConverter = (
    schema,
    { schemaType }
  ) => {
    const vendor = (schema as { '~standard'?: { vendor?: string } })[
      '~standard'
    ]?.vendor;

    switch (vendor) {
      case 'zod': {
        const converted = createSchema(schema as never, {
          io: schemaType,
          openapiVersion: '3.0.0'
        });
        return {
          schema: converted.schema as SchemaObject | ReferenceObject,
          components:
            converted.components as unknown as Record<string, SchemaObject>
        };
      }
      case 'valibot':
        return {
          schema: toJsonSchema(schema as any, {
            target: 'openapi-3.0',
            typeMode: schemaType
          }) as unknown as SchemaObject | ReferenceObject
        };
      default:
        return undefined;
    }
  };

  describe('transformToArraySchemaProperty', () => {
    it('should preserve items schema when metadata.items is already defined and type is string', () => {
      const metadata = {
        type: 'array',
        isArray: true,
        items: {
          type: 'object',
          additionalProperties: {
            type: 'string',
            enum: ['asc', 'desc']
          }
        },
        example: [{ created_on: 'desc' }],
        required: false
      };

      const result = schemaObjectFactory.transformToArraySchemaProperty(
        metadata as any,
        'sort',
        'array'
      );

      expect(result.items).toEqual({
        type: 'object',
        additionalProperties: {
          type: 'string',
          enum: ['asc', 'desc']
        }
      });
      expect(result.type).toBe('array');
      expect(result.example).toEqual([{ created_on: 'desc' }]);
    });

    it('should use type parameter when metadata.items is not defined', () => {
      const metadata = {
        type: 'array',
        isArray: true,
        required: false
      };

      const result = schemaObjectFactory.transformToArraySchemaProperty(
        metadata as any,
        'items',
        'string'
      );

      expect(result.items).toEqual({ type: 'string' });
      expect(result.type).toBe('array');
    });

    it('should use type object when provided', () => {
      const metadata = {
        type: 'array',
        isArray: true,
        required: false
      };

      const result = schemaObjectFactory.transformToArraySchemaProperty(
        metadata as any,
        'items',
        { type: 'object', properties: { name: { type: 'string' } } }
      );

      expect(result.items).toEqual({
        type: 'object',
        properties: { name: { type: 'string' } }
      });
      expect(result.type).toBe('array');
    });
  });
});

