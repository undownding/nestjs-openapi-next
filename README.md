# nestjs-openapi-next

`nestjs-openapi-next` is a fork of `@nestjs/swagger` (upstream: `nestjs/swagger`).
The goal is to keep upstream behavior as compatible as possible while adding a set of **OpenAPI 3.2** features and widely-used **OpenAPI extension fields** (`x-`) that are commonly consumed by tools like Redoc.

> Note: this repository's `package.json` may still use the package name `@nestjs/swagger`. If your project also depends on the upstream package, use lockfiles / overrides / resolutions to avoid dependency conflicts.

## Key differences from upstream

- **Richer OpenAPI 3.2 typings**
  - e.g. `TagObject.summary`, `OAuthFlowsObject.deviceAuthorization`, etc.
- **Enhanced tag support**
  - `@ApiTag(options)` (class/controller-level): defines tag metadata (`summary`, `x-displayName`, `description`, `parent`, `kind`, ...) and merges it into the top-level `document.tags`.
  - `x-displayName` support for tags, mirrored with `summary` (setting either results in both fields being written with the same value).
  - Root-level `x-tagGroups` support (commonly used by Redoc). If you use `parent` to form relationships, `x-tagGroups` is auto-derived; you can also set it explicitly via `DocumentBuilder`.
- **Additional OAS 3.2 behaviors**
  - HTTP `QUERY` method via `@ApiQueryMethod()` (emits `paths['/x'].query`).
  - Streaming responses via `@ApiStreamingResponse()` (`itemSchema`, e.g. SSE `text/event-stream`).
  - OAuth2 Device Authorization Flow typing + `@ApiSecurityDeviceFlow()` helper.
- **Convenience APIs**
  - `DocumentBuilder.addServerWithName()` for a non-standard-but-common `server.name`.

Test coverage: `test/openapi-3-2.spec.ts`.

## Compatibility

- **NestJS**: peerDependencies target `@nestjs/common` / `@nestjs/core` `^11.0.1`
- **Runtime deps**: aligned with upstream `@nestjs/swagger` (`reflect-metadata`, optional `class-validator` / `class-transformer`, etc.)

## Installation

### Install from this fork (recommended)

```bash
npm i --save github:undownding/nestjs-openapi-next
```

### Install from npm

```bash
npm i --save nestjs-openapi-next
```

## Quick start (same as upstream)

See the official Nest OpenAPI tutorial: `https://docs.nestjs.com/openapi/introduction`

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
import { ApiTag } from '@nestjs/swagger';

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
import { ApiQueryMethod } from '@nestjs/swagger';

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
import { ApiProperty, ApiStreamingResponse } from '@nestjs/swagger';

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
import { ApiSecurityDeviceFlow, DocumentBuilder } from '@nestjs/swagger';

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

## License

MIT (see `LICENSE`). This repository is a derivative work of the upstream `nestjs/swagger` project under the MIT license.
