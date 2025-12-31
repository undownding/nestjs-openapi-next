# nestjs-openapi-next

本仓库 fork 自 `@nestjs/swagger`（上游仓库：`nestjs/swagger`），并且**不再计划合并回上游**。

它的目标是为 NestJS 的 Swagger/OpenAPI 生成能力补齐一批 **OpenAPI 3.2** 的关键特性（详见 PR #1），同时尽量保持对现有 `@nestjs/swagger` 用法的兼容。

> 注意：目前 `package.json` 仍沿用包名 `@nestjs/swagger`。如果你在项目中同时依赖上游版本，请使用锁文件 / overrides / resolution 等方式避免冲突。

## 这个 fork 增加了什么（PR #1）

- **HTTP `QUERY` method（OAS 3.2）**
  - 新增 `@ApiQueryMethod()`：让某个 handler 在 OpenAPI 文档中以 `query` 操作输出。
- **Enhanced Tags（OAS 3.2）**
  - 新增 `@ApiTagGroup()`：支持 `tag.parent`、`tag.kind`，并将其合并到顶层 `document.tags`。
  - `DocumentBuilder.addTag()` 额外支持 `summary` 字段。
- **Streaming Responses（OAS 3.2）**
  - 新增 `@ApiStreamingResponse()`：在 response 的 media type 下输出 `itemSchema`（例如 SSE：`text/event-stream`）。
- **OAuth 2.0 Device Authorization Flow（OAS 3.2 / RFC 8628）**
  - OpenAPI typings 支持 `flows.deviceAuthorization`。
  - 新增 `@ApiSecurityDeviceFlow()`：便捷地声明 operation/class 的 security requirement。

相关测试覆盖：`test/openapi-3-2.spec.ts`。

## 兼容性

- **NestJS**：当前 peerDependencies 指向 `@nestjs/common` / `@nestjs/core` `^11.0.1`
- **运行时依赖**：与 `@nestjs/swagger` 基本一致（如 `reflect-metadata`、可选的 `class-validator` / `class-transformer` 等）

## 安装

### 从本 fork 仓库安装（推荐用于使用 OAS 3.2 扩展）

```bash
npm i --save github:undownding/nestjs-openapi-next
```

### 从 npm 安装（取决于你如何发布）

如果你已经把这个 fork 发布到了 npm（可能是私有 scope 或 tag），则按你的发布名安装即可。

> 由于当前包名仍是 `@nestjs/swagger`，直接 `npm i @nestjs/swagger` 默认会安装上游版本，除非你已替换 registry / dist-tag 或使用 overrides。

## 快速开始（与上游一致）

请参考 Nest 官方教程（上游文档同样适用）：`https://docs.nestjs.com/openapi/introduction`

典型用法如下（仅展示关键骨架）：

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ...
const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Example')
  .setDescription('API description')
  .setVersion('1.0')
  // 如果你想在文档里声明 OAS 3.2，请显式设置：
  .setOpenAPIVersion('3.2.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);

await app.listen(3000);
```

## OpenAPI 3.2 扩展用法

### 1) HTTP QUERY method：`@ApiQueryMethod()`

OAS 3.2 支持在 `paths` 下使用 `query` 操作。这个装饰器用于**仅在生成的 OpenAPI 文档中**把某个 handler 输出为 `query`。

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

- 生成效果：`document.paths['/search'].query` 存在（同时不会生成 `post` 对应的 operation）。
- 重要说明：**它不会改变 Nest 路由真实的 HTTP method**，只影响 OpenAPI 文档输出。

### 2) Enhanced Tags：`@ApiTagGroup()`

OAS 3.2 的 Enhanced Tags 允许在 `tags` 中描述层级与 kind（例如用于导航/徽章/受众分组）。

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

- `@ApiTagGroup()` 会同时保证 operation 的 `tags` 包含该 `name`（内部等价于应用 `@ApiTags(name)`）。
- 扫描阶段会把这些 tag metadata 合并进顶层 `document.tags`，并与 `DocumentBuilder` 中配置的 tags 进行合并。

#### `DocumentBuilder.addTag()` 支持 `summary`

```ts
new DocumentBuilder()
  .addTag('Cats', 'Cat operations', undefined, 'Cats')
  .build();
```

参数签名（相对上游新增了第 4 个参数）：

- `addTag(name, description?, externalDocs?, summary?)`

### 3) Streaming responses：`@ApiStreamingResponse()`（`itemSchema`）

对于 SSE 等流式响应，OAS 3.2 支持在 media type 下用 `itemSchema` 描述“流中每个 item 的 schema”。

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

生成效果（示意）：

- `responses['200'].content['text/event-stream'].itemSchema` -> `#/components/schemas/SseItemDto`

### 4) OAuth2 Device Authorization Flow：`flows.deviceAuthorization` + `@ApiSecurityDeviceFlow()`

先在 `DocumentBuilder.addOAuth2()` 中声明 security scheme（包含 `flows.deviceAuthorization`），再用装饰器声明某个 endpoint 的 requirement。

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

说明：

- `@ApiSecurityDeviceFlow()` 只是 `@ApiSecurity(name, scopes)` 的便捷封装，用于 requirement。
- 具体 device flow 的 scheme 定义仍然由 `addOAuth2({ flows: { deviceAuthorization: ... } })` 提供。

## 与上游的关系 / 迁移说明

- 本 fork 在 PR #1 中尽量以“增量扩展”的方式实现 OAS 3.2，不希望破坏既有用法。
- 如果你不使用新增装饰器与新字段，行为应与上游 `@nestjs/swagger` 基本一致。

## License

MIT（见 `LICENSE`）。本仓库基于上游 `nestjs/swagger` 的 MIT 许可进行二次开发。  
