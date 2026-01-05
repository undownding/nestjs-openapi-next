# nestjs-openapi-next

`nestjs-openapi-next` 是 `@nestjs/swagger` 的一个 fork（上游：`nestjs/swagger`），目标是在尽量保持上游使用方式不变的前提下，补齐一些 **OpenAPI 3.2** 能力与常见的 **OpenAPI 扩展字段（x-）**，方便与 Redoc / Swagger UI 等工具协同。

> 注意：本仓库的 `package.json` 目前仍沿用 `@nestjs/swagger` 的包名。如果你的项目同时依赖上游包，请使用 lockfile / overrides / resolutions 等方式避免依赖冲突。

## 与上游的主要区别

- **更完整的 OpenAPI 3.2 类型支持**
  - 例如 `TagObject.summary`、`OAuthFlowsObject.deviceAuthorization` 等。
- **增强的 Tag 能力**
  - `@ApiTagGroup()`：在 class（controller）级别定义 tag 元数据（如 `summary` / `description` / `parent` / `kind`），并合并进最终 `document.tags`。
  - `x-displayName`：对 tag 新增 `x-displayName` 输出，并与 `summary` **等价/互相镜像**（声明任意一个，最终会同时写入两者）。
  - `x-tagGroups`：支持输出根级别 `x-tagGroups`（常用于 Redoc 的分组展示）。当使用 `parent` 建立 tag 关系时，会自动从 `document.tags` 推导生成；也可以在 `DocumentBuilder` 中手动配置（见下方示例）。
- **补充若干 OAS 3.2 行为**
  - HTTP `QUERY` method：`@ApiQueryMethod()` 让某个 handler 生成 `paths['/x'].query`。
  - 流式响应：`@ApiStreamingResponse()` 在 mediaType 下输出 `itemSchema`（例如 SSE `text/event-stream`）。
  - OAuth2 Device Authorization Flow：类型与便捷装饰器 `@ApiSecurityDeviceFlow()`。
- **便利方法**
  - `DocumentBuilder.addServerWithName()`：允许为 server 增加 `name` 字段（非标准，但常见于工具链）。

测试覆盖：`test/openapi-3-2.spec.ts`。

## 兼容性

- **NestJS**：peerDependencies 目标为 `@nestjs/common` / `@nestjs/core` `^11.0.1`
- **运行时依赖**：整体与上游 `@nestjs/swagger` 对齐（`reflect-metadata`、可选的 `class-validator` / `class-transformer` 等）

## 安装

### 从 GitHub 安装（推荐）

```bash
npm i --save github:undownding/nestjs-openapi-next
```

### 从 npm 安装

```bash
npm i --save nestjs-openapi-next
```

## 快速开始（与上游一致）

参考 Nest 官方 OpenAPI 文档：`https://docs.nestjs.com/openapi/introduction`

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const app = await NestFactory.create(AppModule);

const config = new DocumentBuilder()
  .setTitle('Example')
  .setDescription('API description')
  .setVersion('1.0')
  // 如需声明 OAS 3.2，请显式设置：
  .setOpenAPIVersion('3.2.0')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

## 使用说明

### 1) `x-displayName`（与 `summary` 等价）

在 controller 上使用 `@ApiTagGroup()` 定义 tag 元数据时：

- 你可以写 `summary`，也可以写 `'x-displayName'`；
- 最终生成的 `document.tags` 会同时包含 `summary` 与 `'x-displayName'`，两者值保持一致。

```ts
import { Controller, Get } from '@nestjs/common';
import { ApiTagGroup } from '@nestjs/swagger';

@ApiTagGroup({
  name: 'Customers',
  summary: 'Customers' // 或者写 'x-displayName': 'Customers'
})
@Controller('customers')
export class CustomersController {
  @Get()
  list() {
    return [];
  }
}
```

### 2) `x-tagGroups`（按 tag 分组）

#### 自动推导（推荐）

当 tag 使用 `parent` 建立关系时，会自动推导并输出根级别 `x-tagGroups`：

```ts
@ApiTagGroup({ name: 'Customers' })
@Controller('customers')
export class CustomersController {}

@ApiTagGroup({ name: 'Customer Authentication', parent: 'Customers' })
@Controller('auth')
export class AuthController {}
```

生成效果（示意）：

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

#### 手动配置

也可以通过 `DocumentBuilder.addTagGroup()` 直接写入扩展字段：

```ts
const config = new DocumentBuilder()
  .setTitle('t')
  .setVersion('1')
  .addTag('Customers')
  .addTag('Customer Authentication')
  .addTagGroup('Customers', ['Customers', 'Customer Authentication'])
  .build();
```

### 3) HTTP `QUERY` method：`@ApiQueryMethod()`

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

### 4) 流式响应：`@ApiStreamingResponse()`（`itemSchema`）

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

### 5) OAuth2 Device Authorization Flow：`flows.deviceAuthorization` + `@ApiSecurityDeviceFlow()`

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

MIT（见 `LICENSE`）。本仓库是上游 `nestjs/swagger` 的衍生作品，遵循其 MIT 许可证。
