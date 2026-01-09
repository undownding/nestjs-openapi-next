# nestjs-openapi-next

`nestjs-openapi-next` is a fork of `@nestjs/swagger` (upstream: `nestjs/swagger`).
The goal is to keep upstream behavior as compatible as possible while adding a set of **OpenAPI 3.1/3.2** features and widely-used **OpenAPI extension fields** (`x-`) that are commonly consumed by tools like Redoc.

## Key differences from upstream

- **Richer OpenAPI 3.1/3.2 typings**
  - e.g. `TagObject.summary`, `OAuthFlowsObject.deviceAuthorization`, `LicenseObject.identifier`, etc.
- **Enhanced tag support**
  - `@ApiTag(options)` (class/controller-level): defines tag metadata (`summary`, `x-displayName`, `description`, `parent`, `kind`, ...) and merges it into the top-level `document.tags`.
  - `x-displayName` support for tags, mirrored with `summary` (setting either results in both fields being written with the same value).
  - Root-level `x-tagGroups` support (commonly used by Redoc). If you use `parent` to form relationships, `x-tagGroups` is auto-derived; you can also set it explicitly via `DocumentBuilder`.
- **OAS 3.1 features**
  - JSON Schema Draft 2020-12 alignment (e.g. `$defs`, `prefixItems`, `const`, `contentEncoding`, `contentMediaType`, `contentSchema`).
  - `type` as array support (e.g. `type: ['string', 'null']`) with automatic `nullable` removal.
  - `LicenseObject.identifier` field support via `DocumentBuilder.setLicense()`.
  - `ReferenceObject` with `summary` and `description` override support.
  - `exclusiveMinimum` / `exclusiveMaximum` as number type (changed from boolean in OAS 3.0).
- **OAS 3.2 features**
  - HTTP `QUERY` method via `@ApiQueryMethod()` (emits `paths['/x'].query`).
  - Streaming responses via `@ApiStreamingResponse()` (`itemSchema`, e.g. SSE `text/event-stream`).
  - OAuth2 Device Authorization Flow typing + `@ApiSecurityDeviceFlow()` helper.
  - `ServerObject.pathPrefix` field support via `DocumentBuilder.addServer()`.
  - `InfoObject.tags` field support via `DocumentBuilder.setInfoTags()`.
- **Convenience APIs**
  - `DocumentBuilder.addServerWithName()` for a non-standard-but-common `server.name`.

Test coverage: `test/openapi-3-1.spec.ts`, `test/openapi-3-2.spec.ts`.

## Compatibility

- **NestJS**: peerDependencies target `@nestjs/common` / `@nestjs/core` `^11.0.1`
- **Runtime deps**: aligned with upstream `@nestjs/swagger` (`reflect-metadata`, optional `class-validator` / `class-transformer`, etc.)

## Installation

### Install from npm

```bash
npm i --save nestjs-openapi-next
```

## Quick start (same as upstream)

See the official Nest OpenAPI tutorial: `https://docs.nestjs.com/openapi/introduction`

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from 'nestjs-openapi-next';

const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Example')
  .setDescription('API description')
  .setVersion('1.0')
  // If you want the document to declare OAS 3.2, set it explicitly:
  .setOpenAPIVersion('3.2.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

## Usage

### 1) `@ApiTag(options)` (recommended) and deprecation of `@ApiTagGroup()`

`@ApiTag(options)` is the primary decorator for defining tag metadata at the controller level.

`@ApiTagGroup(options)` is kept as a backward-compatible alias, but is **deprecated** and may be removed in a future major version.

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiTag } from 'nestjs-openapi-next';

@ApiTag({
  name: 'Customers',
  summary: 'Customers'
  // you may also set: 'x-displayName': 'Customers'
})
@Controller('customers')
export class CustomersController {
  @Get()
  list() {
    return [];
  }
}
```

### 2) Tag `x-displayName` (mirrored with `summary`)

This fork treats tag `summary` and `x-displayName` as equivalent display fields:

- set either one;
- the generated `document.tags` will contain **both** `summary` and `x-displayName` with the same value.

### 3) Root-level `x-tagGroups` (tag grouping)

#### Auto-derived (recommended)

If you use tag `parent` relationships (via `@ApiTag()`), the root-level `x-tagGroups` will be derived automatically:

```ts
@ApiTag({ name: 'Customers' })
@Controller('customers')
export class CustomersController {}

@ApiTag({ name: 'Customer Authentication', parent: 'Customers' })
@Controller('auth')
export class AuthController {}
```

Illustrative output:

```yaml
tags:
  - name: Customers
  - name: Customer Authentication
x-tagGroups:
  - name: Customers
    tags:
      - Customers
      - Customer Authentication
```

#### Manual configuration

You can also set `x-tagGroups` explicitly via `DocumentBuilder.addTagGroup()`:

```ts
const config = new DocumentBuilder()
  .setTitle('t')
  .setVersion('1')
  .addTag('Customers')
  .addTag('Customer Authentication')
  .addTagGroup('Customers', ['Customers', 'Customer Authentication'])
  .build();
```

### 4) HTTP `QUERY` method: `@ApiQueryMethod()`

```ts
import { Controller, Post } from '@nestjs/common';
import { ApiQueryMethod } from 'nestjs-openapi-next';

@Controller()
export class QueryController {
  @Post('search')
  @ApiQueryMethod()
  search() {
    return { ok: true };
  }
}
```

### 5) Streaming responses: `@ApiStreamingResponse()` (`itemSchema`)

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiProperty, ApiStreamingResponse } from 'nestjs-openapi-next';

class SseItemDto {
  @ApiProperty()
  id: string;
}

@Controller()
export class EventsController {
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
```

### 6) OAuth2 Device Authorization Flow: `flows.deviceAuthorization` + `@ApiSecurityDeviceFlow()`

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiSecurityDeviceFlow, DocumentBuilder } from 'nestjs-openapi-next';

@Controller()
export class SecuredController {
  @Get('secure')
  @ApiSecurityDeviceFlow('oauth2', ['read'])
  secure() {
    return { ok: true };
  }
}

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
```

### 7) OpenAPI 3.1 Webhooks: `@ApiWebhook()`

OpenAPI 3.1 introduces a root-level `webhooks` object for out-of-band callbacks
initiated by the API provider.

This fork supports emitting webhook operations via a decorator:

```ts
import { Controller, Post } from '@nestjs/common';
import { ApiWebhook } from '@nestjs/swagger';

@Controller()
export class StripeWebhooksController {
  @Post('stripe')
  @ApiWebhook('stripeEvent')
  stripe() {
    return { ok: true };
  }
}
```

The generated document will contain `document.webhooks.stripeEvent.post`, and the
corresponding route will **not** be emitted under `document.paths`.

### 8) `LicenseObject.identifier` (OAS 3.1)

OAS 3.1 added an `identifier` field to `LicenseObject` for SPDX license identifiers:

```ts
const config = new DocumentBuilder()
  .setTitle('Example')
  .setVersion('1.0')
  .setLicense('MIT', 'https://opensource.org/licenses/MIT', 'MIT')
  .build();
```

This produces:

```yaml
info:
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT
    identifier: MIT
```

### 9) `ServerObject.pathPrefix` (OAS 3.2)

OAS 3.2 added a `pathPrefix` field to `ServerObject`:

```ts
const config = new DocumentBuilder()
  .setTitle('Example')
  .setVersion('1.0')
  .addServer('https://api.example.com', 'Production', {}, '/v1')
  .build();
```

This produces:

```yaml
servers:
  - url: https://api.example.com
    description: Production
    pathPrefix: /v1
```

### 10) `InfoObject.tags` (OAS 3.2)

OAS 3.2 added a `tags` field to `InfoObject` for categorizing the API itself:

```ts
const config = new DocumentBuilder()
  .setTitle('Example')
  .setVersion('1.0')
  .setInfoTags(['payments', 'commerce'])
  .build();
```

This produces:

```yaml
info:
  title: Example
  version: '1.0'
  tags:
    - payments
    - commerce
```

### 11) `ReferenceObject` with `summary` / `description` override (OAS 3.1)

OAS 3.1 allows `$ref` objects to include `summary` and `description` fields that override the referenced schema's values:

```ts
import { ApiProperty } from 'nestjs-openapi-next';

class CreateUserDto {
  @ApiProperty({
    allOf: [
      {
        $ref: '#/components/schemas/BaseUser',
        summary: 'User base fields',
        description: 'Contains the common user properties'
      }
    ]
  })
  user: BaseUser;
}
```

### 12) `type` as array (OAS 3.1)

OAS 3.1 supports `type` as an array for union types. This replaces the `nullable` keyword:

```ts
import { ApiProperty } from 'nestjs-openapi-next';

class UserDto {
  @ApiProperty({ type: ['string', 'null'] })
  nickname: string | null;
}
```

This produces `type: ['string', 'null']` instead of `type: 'string', nullable: true`.

### 13) JSON Schema Draft 2020-12 keywords (OAS 3.1)

OAS 3.1 aligns with JSON Schema Draft 2020-12, adding support for:

- `$defs` - local schema definitions
- `prefixItems` - tuple validation (replaces `items` array form)
- `const` - exact value matching
- `contentEncoding` - encoding for string content (e.g., `base64`)
- `contentMediaType` - media type for string content
- `contentSchema` - schema for decoded content

```ts
import { ApiProperty } from 'nestjs-openapi-next';

class FileDto {
  @ApiProperty({
    contentEncoding: 'base64',
    contentMediaType: 'image/png'
  })
  data: string;
}
```

## License

MIT (see `LICENSE`). This repository is a derivative work of the upstream `nestjs/swagger` project under the MIT license.
