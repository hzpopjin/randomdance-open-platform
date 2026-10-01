# 鉴权机制

开放平台采用**本地用户名 / 密码 + JWT** 鉴权，不依赖任何第三方用户系统。受保护接口需在请求头携带 `Authorization: Bearer <token>`。

## 角色模型

用户角色字段 `role` 为整数，共三档：

| 值 | 角色 | 权限边界 |
|----|------|---------|
| `0` | `USER` 普通用户 | 前台提交报名 / 投稿、选位、上传、查看本人数据；无任何 `/admin/*` 访问权 |
| `1` | `ADMIN` 超级管理员 | 全部管理端接口（`/admin/*`），**不受数据隔离限制**，可见并操作全平台数据 |
| `2` | `ORGANIZER` 主办方 | 仅业务管理端接口（场次 / 报名 / 投稿 / 编排 / 个人资料），且**受数据隔离**：仅能访问 `sessions.organizer_id = 自身 id` 的场次及其派生数据 |

- **公开接口**：无需 Token（如注册、登录、公开场次列表、公共主办方列表 `GET /organizers`）。
- **用户接口**：需要有效 JWT（`@UseGuards(AuthGuard('jwt'))`）。
- **业务管理端接口**：需要 JWT 且 `role ∈ {1, 2}`（`@Roles(UserRole.ADMIN, UserRole.ORGANIZER)`），主办方额外受后端数据隔离约束。
- **平台级管理端接口**：需要 JWT 且 `role = 1`（`@Roles(UserRole.ADMIN)`），包括用户 / 主办方管理、对象存储、歌曲库、数据大屏、日志、云端配置等。

::: tip 主办方权限边界
主办方（`role = 2`）是一种管理端角色，但**仅能使用业务互动功能**且只见名下数据；直接调用平台级接口（如 `/admin/users`、`/admin/object-storage`、`/admin/dashboard`）返回 `403`。可访问 / 不可访问的完整能力矩阵、数据隔离与 404 / 403 越权语义见 [主办方](/api/organizer)。`RolesGuard` 采用 `requiredRoles.some(r => user.role === r)` 的精确多值匹配，是后端唯一权威防线。
:::

本文档各接口标注的鉴权级别对应上述分类：<span class="acl acl-public">公开</span> <span class="acl acl-user">用户</span> <span class="acl acl-organizer">管理员 / 主办方</span> <span class="acl acl-admin">仅超级管理员</span>。

## 注册

<span class="m m-post">POST</span> `/auth/register` · <span class="acl acl-public">公开</span>

创建新用户并直接返回 JWT。

**请求体**

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `username` | string | 是 | 3–32 位，仅字母、数字、下划线 |
| `password` | string | 是 | 6–64 位 |
| `nickname` | string | 否 | ≤ 64 位 |
| `phone` | string | 否 | ≤ 20 位 |
| `email` | string | 否 | ≤ 128 位 |

**curl 示例**

```bash
curl -X POST http://localhost:3002/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dancer_01",
    "password": "secret123",
    "nickname": "小舞",
    "phone": "13800000000",
    "email": "dancer@example.com"
  }'
```

## 登录

<span class="m m-post">POST</span> `/auth/login` · <span class="acl acl-public">公开</span>

用户名密码登录，验证通过后返回 JWT。

**请求体**

| 字段 | 类型 | 必填 |
|------|------|------|
| `username` | string | 是 |
| `password` | string | 是 |

**curl 示例**

```bash
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "username": "admin", "password": "admin123" }'
```

**成功响应**（`data` 部分）

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "nickname": "管理员",
    "phone": null,
    "email": null,
    "role": 1,
    "avatar_url": null,
    "status": 1,
    "organizer_name": "系统主办方"
  }
}
```

::: tip 登录返回的用户对象
`serializeUser` 返回体本次**新增** `status`（`1`=启用 / `0`=停用）与 `organizer_name`（主办方对外展示名，非主办方为 `null`）两个字段。
:::

::: tip 管理员登录
`POST /admin/login` 与 `/auth/login` 等价（同一鉴权逻辑），返回相同结构。默认管理员账号为 `admin` / `admin123`（由 `npm run seed:admin` 创建）。
:::

## 游客登录

<span class="m m-post">POST</span> `/auth/guest` · <span class="acl acl-public">公开</span>

创建免注册游客身份。首次响应包含 `guest_id` 与 `guest_secret`；后续请求必须回传两者才能恢复同一游客。`device_id` 仅用于兼容旧客户端，不用于身份验证。旧版游客账号不能靠设备 ID 恢复，详见仓库 `docs/guest-identity-upgrade.md`。

**请求体**：`{ "device_id"?: string, "guest_id"?: number, "guest_secret"?: string }`（恢复时必须同时提供后两项）

```bash
curl -X POST http://localhost:3002/api/v1/auth/guest \
  -H "Content-Type: application/json" \
  -d '{ "device_id": "device-abc-123" }'
```

## Token 使用

获取 `token` 后，在后续请求头携带：

```
Authorization: Bearer <token>
```

**调用受保护接口示例**

```bash
curl http://localhost:3002/api/v1/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**JWT payload 结构**

```json
{
  "sub": 1,             // 用户 ID
  "role": 1,            // 0=普通用户, 1=超级管理员, 2=主办方
  "identityVersion": 2, // 身份版本号；升级后全部旧 JWT 失效，需重新登录
  "iat": 1730000000,
  "exp": 1730604800
}
```

Token 过期时间由环境变量 `JWT_EXPIRES_IN` 控制，默认 `7d`。

## 当前用户信息

<span class="m m-get">GET</span> `/auth/profile` · <span class="acl acl-user">用户</span>

返回当前登录用户信息（含 `created_at` / `updated_at`）。

```bash
curl http://localhost:3002/api/v1/auth/profile \
  -H "Authorization: Bearer <token>"
```

## 更新个人信息

<span class="m m-patch">PATCH</span> `/auth/profile` · <span class="acl acl-user">用户</span>

**请求体**（均可选）

| 字段 | 类型 | 约束 |
|------|------|------|
| `nickname` | string | ≤ 64 位 |
| `phone` | string | ≤ 20 位 |
| `email` | string | ≤ 128 位 |
| `password` | string | ≥ 6 位（修改密码时传入） |

```bash
curl -X PATCH http://localhost:3002/api/v1/auth/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "nickname": "新昵称", "password": "newpass123" }'
```

## 管理端个人接口

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| <span class="m m-post">POST</span> | `/admin/login` | <span class="acl acl-public">公开</span> | 管理员登录（同 `/auth/login`） |
| <span class="m m-get">GET</span> | `/admin/profile` | <span class="acl acl-organizer">管理员 / 主办方</span> | 获取管理员 / 主办方信息 |
| <span class="m m-patch">PATCH</span> | `/admin/profile` | <span class="acl acl-organizer">管理员 / 主办方</span> | 更新个人信息（含改密码） |
| <span class="m m-post">POST</span> | `/admin/logout` | <span class="acl acl-public">公开</span> | 退出登录（返回 `null`，JWT 无状态，仅前端清理） |

## 鉴权失败

未携带 Token、Token 无效或过期时，接口返回 HTTP `401`，业务码 `code = 10002`：

```json
{ "code": 10002, "message": "Unauthorized", "data": null }
```

非管理员访问管理员接口时返回 HTTP `403`。详见 [错误码约定](/api/errors)。

::: warning 账号停用即时失效
账号被置为 `status = 0`（停用）后：登录接口返回 `401` `账号已停用，请联系管理员`；由于 `JwtStrategy.validate()` **每次请求都回查数据库**，已签发的 Token 也会**立即失效**（同样返回 `401` `账号已停用，请联系管理员`），无需等待 Token 过期或提升身份版本号强制全站重登。角色变更（如升 / 降为主办方）同理即时生效。
:::
