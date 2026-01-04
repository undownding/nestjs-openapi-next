# nestjs-openapi-next

This repository is a fork of `@nestjs/swagger` (upstream: `nestjs/swagger`).

Its goal is to add first-class support for key **OpenAPI 3.2** features (see PR #1), while keeping compatibility with existing `@nestjs/swagger` usage as much as possible.

> Note: `package.json` currently still uses the package name `@nestjs/swagger`. If your project also depends on the upstream package, use lockfiles / overrides / resolutions to avoid dependency conflicts.

## What this fork adds (PR #1)

- **HTTP `QUERY` method (OAS 3.2)**
  - `@ApiQueryMethod()` to explicitly emit an OpenAPI `query` operation.
- **Enhanced Tags (OAS 3.2)**
  - `@ApiTagGroup()` to define tag metadata including `parent` and `kind`, merged into top-level `document.tags`.
  - `DocumentBuilder.addTag()` supports an additional `summary` field.
- **Streaming responses (OAS 3.2)**
  - `@ApiStreamingResponse()` to emit per-item schema via `itemSchema` (e.g. SSE `text/event-stream`).
- **OAuth 2.0 Device Authorization Flow (OAS 3.2 / RFC 8628)**
  - OpenAPI typings include `flows.deviceAuthorization`.
  - `@ApiSecurityDeviceFlow()` convenience decorator for security requirements.

Test coverage: `test/openapi-3-2.spec.ts`.

## Compatibility

- **NestJS**: peerDependencies target `@nestjs/common` / `@nestjs/core` `^11.0.1`
- **Runtime deps**: generally aligned with `@nestjs/swagger` (e.g. `reflect-metadata`, optional `class-validator` / `class-transformer`, etc.)

## Installation

### Install from this fork (recommended for OAS 3.2 extensions)

```bash
npm i --save github:undownding/nestjs-openapi-next
```

### Install from npm

```bash
npm i --save nestjs-openapi-next
```

## Quick start (same as upstream)

See the official Nest OpenAPI tutorial: `https://docs.nestjs.com/openapi/introduction`

Typical setup (minimal skeleton):

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ...
const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Example')
  .setDescription('API description')
  .setVersion('1.0')
  // If you want to declare OAS 3.2 in the document, set it explicitly:
  .setOpenAPIVersion('3.2.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);

await app.listen(3000);
```

## OpenAPI 3.2 extensions

### 1) HTTP QUERY method: `@ApiQueryMethod()`

OAS 3.2 supports a `query` operation under `paths`. This decorator makes a Nest handler emit a `query` operation **in the generated OpenAPI document**.

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

- Output: `document.paths['/search'].query` is defined (and `post` is not emitted for that handler).
- Important: this does **not** change Nest routing at runtime — it only affects the generated OpenAPI document.

### 2) Enhanced Tags: `@ApiTagGroup()`

OAS 3.2 Enhanced Tags allow nesting and classification via `parent` and `kind`.

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiTagGroup } from '@nestjs/swagger';

@ApiTagGroup({
  name: 'Cats',
  summary: 'Cats',
  description: 'Cat operations',
  parent: 'Admin',
  kind: 'nav'
})
@Controller('cats')
export class CatsController {
  @Get()
  list() {
    return [];
  }
}
```

- `@ApiTagGroup()` also ensures operations are tagged (internally it behaves like applying `@ApiTags(name)`).
- During scanning, tag group metadata is merged into top-level `document.tags` and then merged with tags coming from `DocumentBuilder`.

#### `DocumentBuilder.addTag()` supports `summary`

```ts
new DocumentBuilder()
  .addTag('Cats', 'Cat operations', undefined, 'Cats')
  .build();
```

Signature (adds the 4th argument compared to upstream):

- `addTag(name, description?, externalDocs?, summary?)`

### 3) Streaming responses: `@ApiStreamingResponse()` (`itemSchema`)

For streaming responses (e.g. SSE), OAS 3.2 supports describing each streamed item via `itemSchema` under the media type.

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

Result (illustrative):

- `responses['200'].content['text/event-stream'].itemSchema` -> `#/components/schemas/SseItemDto`

### 4) OAuth2 Device Authorization Flow: `flows.deviceAuthorization` + `@ApiSecurityDeviceFlow()`

Define the OAuth2 scheme (with `flows.deviceAuthorization`) via `DocumentBuilder.addOAuth2()`, then declare per-operation requirements with the decorator.

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

Notes:

- `@ApiSecurityDeviceFlow()` is a convenience wrapper around `@ApiSecurity(name, scopes)` for requirements.
- The device flow scheme definition still comes from `addOAuth2({ flows: { deviceAuthorization: ... } })`.

### 5) Named servers: `DocumentBuilder.addServerWithName()`

This fork extends the `ServerObject` typing with an optional `name?: string`, and provides a convenience builder method to populate it.

```ts
import { DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('t')
  .setVersion('1')
  .addServerWithName('prod', 'https://api.example.com', 'Production')
  .addServerWithName('local', 'https://{host}', 'Local', {
    host: { default: 'localhost' }
  })
  .build();
```

Signature:

- `addServerWithName(name, url, description?, variables?)`

## Upstream relationship / migration notes

- The OAS 3.2 support in PR #1 is implemented as an additive extension to minimize breaking changes.
- If you don’t use the new decorators/fields, behavior should be broadly compatible with upstream `@nestjs/swagger`.

## License

MIT (see `LICENSE`). This repository is a derivative work of the upstream `nestjs/swagger` project under the MIT license.
