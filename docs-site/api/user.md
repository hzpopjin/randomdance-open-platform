# 用户

用户与主办方管理接口，前缀 `admin/users`，鉴权 <span class="acl acl-admin">仅超级管理员</span>（`role = 1`）。主办方（`role = 2`）访问这些接口一律返回 `403`。用户注册 / 登录 / 个人信息见 [鉴权机制](/guide/authentication)；公共主办方列表与主办方数据隔离规则见 [主办方](/api/organizer)。

::: warning 仅超级管理员
本页所有接口均由 `@Roles(UserRole.ADMIN)` 保护，**仅 `role = 1` 的超级管理员**可调用。主办方（`role = 2`）虽然是「管理端角色」，但**无权**访问用户 / 主办方管理接口。角色与权限边界总览见 [主办方 · 能力矩阵](/api/organizer)。
:::

## 角色与新增字段

用户 `role` 为整数枚举，本次新增 `2 = 主办方`：

| 值 | 角色 | 说明 |
|----|------|------|
| `0` | 普通用户 `USER` | 前台报名 / 投稿 / 选位 |
| `1` | 超级管理员 `ADMIN` | 全部管理端接口，不受数据隔离限制 |
| `2` | 主办方 `ORGANIZER` | 业务管理端接口，仅见名下场次数据 |

用户对象新增两列：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | number | `1`=启用（默认），`0`=停用；停用后禁止登录且已签发 Token 立即失效 |
| `organizer_name` | string \| null | 对外展示的主办方名称；**非空即进入公共主办方列表**（`GET /organizers`） |

## 接口列表

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/users` | 用户列表 | `page, page_size, keyword, role` |
| <span class="m m-get">GET</span> | `/admin/users/:id` | 用户详情 | → `User` 对象 |
| <span class="m m-post">POST</span> | `/admin/users` | 创建用户 / 主办方 | `{ username, password, nickname?, phone?, email?, role?, organizer_name? }` → `User` |
| <span class="m m-put">PUT</span> | `/admin/users/:id` | 编辑用户资料 | `{ nickname?, phone?, email?, organizer_name? }` → `User` |
| <span class="m m-put">PUT</span> | `/admin/users/:id/role` | 修改用户角色 | `{ role: 0\|1\|2, organizer_name? }` → `{ id, role, organizer_name }` |
| <span class="m m-put">PUT</span> | `/admin/users/:id/status` | 启用 / 停用账号 | `{ status: 0\|1 }` → `{ id, status }` |

## 用户列表

<span class="m m-get">GET</span> `/admin/users` · <span class="acl acl-admin">仅超级管理员</span>

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` / `page_size` | number | 否 | 分页，默认 `1` / `10` |
| `keyword` | string | 否 | 按用户名 / 昵称 / 手机号 / 邮箱模糊搜索 |
| `role` | number | 否 | 按角色过滤（`0` / `1` / `2`）；传 `2` 即列出全部主办方 |

```bash
curl "http://localhost:3002/api/v1/admin/users?page=1&page_size=10&role=2" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ list: User[], total, page, page_size }`，按 `created_at` 倒序。`list` 每项为 `User` 对象（含 `status`、`organizer_name`）。

## 用户详情

<span class="m m-get">GET</span> `/admin/users/:id` · <span class="acl acl-admin">仅超级管理员</span>

**路径参数**：`id` — 用户 ID（UID）

```bash
curl http://localhost:3002/api/v1/admin/users/5 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`User` 对象（`{ id, username, nickname, phone, email, role, avatar_url, status, organizer_name, created_at, updated_at }`）。用户不存在时返回 `404` `用户不存在`。

## 创建用户 / 主办方

<span class="m m-post">POST</span> `/admin/users` · <span class="acl acl-admin">仅超级管理员</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名，唯一；缺失返回 `400` `用户名和密码必填` |
| `password` | string | 是 | 明文密码，服务端以 bcrypt（`hash(password, 10)`）存储 |
| `nickname` | string | 否 | 昵称，缺省取 `username` |
| `phone` | string | 否 | 手机号 |
| `email` | string | 否 | 邮箱 |
| `role` | number | 否 | `0` / `1` / `2`，缺省 `0`；非白名单值返回 `400` `角色值无效` |
| `organizer_name` | string | 否 | 对外展示名；**`role = 2` 时必填**，否则 `400` `主办方必须填写对外展示名称` |

```bash
curl -X POST http://localhost:3002/api/v1/admin/users \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "organizer_a",
    "password": "secret123",
    "nickname": "主办方A运营",
    "role": 2,
    "organizer_name": "主办方A"
  }'
```

**响应体**（`data`）：新建的 `User` 对象（`status` 固定为 `1`）。

| HTTP | 触发条件 |
|------|---------|
| `400` | `用户名和密码必填` / `角色值无效` / `主办方必须填写对外展示名称` |
| `409` | 用户名重复：`用户名已被使用` |

## 编辑用户资料

<span class="m m-put">PUT</span> `/admin/users/:id` · <span class="acl acl-admin">仅超级管理员</span>

**请求体**（均可选，显式白名单）：`nickname`、`phone`、`email`、`organizer_name`。**不接受** `role` / `status` / `password`（这些分别走角色、状态接口与个人信息接口）。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/users/5 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "nickname": "新昵称", "organizer_name": "主办方A" }'
```

**响应体**：更新后的 `User` 对象。

| HTTP | 触发条件 |
|------|---------|
| `400` | `:id` 为当前登录管理员自身：`不能修改自己的角色或状态` |
| `404` | 用户不存在：`用户不存在` |

## 修改用户角色

<span class="m m-put">PUT</span> `/admin/users/:id/role` · <span class="acl acl-admin">仅超级管理员</span>

用于在普通用户 / 超级管理员 / 主办方之间切换，也可将现有用户提升为主办方。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | number | 是 | `0`=普通用户，`1`=超级管理员，`2`=主办方；非白名单值返回 `400` `角色值无效` |
| `organizer_name` | string | 否 | 一并写入的对外展示名；升为 `2` 时若目标用户 `organizer_name` 为空且未提供 → `400` `主办方必须填写对外展示名称` |

```bash
curl -X PUT http://localhost:3002/api/v1/admin/users/5/role \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "role": 2, "organizer_name": "主办方A" }'
```

**响应体**：`{ "id": 5, "role": 2, "organizer_name": "主办方A" }`

| HTTP | 触发条件 |
|------|---------|
| `400` | 修改自身：`不能修改自己的角色或状态`；`角色值无效`；`主办方必须填写对外展示名称` |
| `404` | 用户不存在：`用户不存在` |

::: tip 取消主办方身份
将主办方 `role` 改回 `0` 后，该账号不再能登录后台，但其名下场次的 `organizer_id` 归属**保留不删**，超级管理员可通过场次编辑重新指派归属。
:::

## 启用 / 停用账号

<span class="m m-put">PUT</span> `/admin/users/:id/status` · <span class="acl acl-admin">仅超级管理员</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | number | 是 | `1`=启用，`0`=停用；其他值返回 `400` `状态值无效` |

```bash
curl -X PUT http://localhost:3002/api/v1/admin/users/5/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": 0 }'
```

**响应体**：`{ "id": 5, "status": 0 }`

| HTTP | 触发条件 |
|------|---------|
| `400` | 修改自身：`不能修改自己的角色或状态`；`状态值无效` |
| `404` | 用户不存在：`用户不存在` |

::: warning 停用即时生效
账号被置为 `status = 0` 后：
- **登录被拒**：`POST /auth/login`、`POST /auth/guest`、`POST /admin/login` 均返回 `401` `账号已停用，请联系管理员`；
- **已签发 Token 立即失效**：`JwtStrategy.validate()` 每次请求都回查数据库，检测到 `status = 0` 即抛 `401` `账号已停用，请联系管理员`，无需等待 Token 过期或强制全站重登。
:::

::: warning 自我保护规则
`PUT /admin/users/:id`、`PUT /admin/users/:id/role`、`PUT /admin/users/:id/status` 三个写接口，当 `:id` 等于当前登录管理员自身 id 时，**优先**返回 `400` `不能修改自己的角色或状态`（该校验先于「用户是否存在」判定），防止管理员误将自己降级或停用导致自锁。
:::

## 数据结构

### User 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 用户 ID（UID） |
| `username` | string | 用户名，唯一，≤ 64 |
| `nickname` | string \| null | 昵称，≤ 64 |
| `phone` | string \| null | 手机号，≤ 20 |
| `email` | string \| null | 邮箱，≤ 128 |
| `avatar_url` | string \| null | 头像 URL，≤ 512 |
| `role` | number | `0`=普通用户，`1`=超级管理员，`2`=主办方 |
| `status` | number | `1`=启用，`0`=停用 |
| `organizer_name` | string \| null | 对外展示的主办方名称，非空即进入公共主办方列表 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

::: tip 密码字段
`password` 以 bcrypt 哈希存储，接口返回的用户对象**不包含**密码字段。
:::

## 相关接口

- 注册 / 登录 / 个人信息：[鉴权机制](/guide/authentication)
- 公共主办方列表与数据隔离：[主办方](/api/organizer)
- 用户提交的数据：[路演报名](/api/roadshow-registration)、[歌单投稿](/api/submission)
