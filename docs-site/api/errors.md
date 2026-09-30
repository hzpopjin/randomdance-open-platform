# 错误码约定

开放平台的所有异常经全局 `AllExceptionsFilter` 捕获，统一返回 `{ code, message, data }` 结构，与成功响应保持一致的包裹格式，`data` 恒为 `null`。

## 响应结构

**成功**

```json
{ "code": 0, "message": "success", "data": { } }
```

**失败**

```json
{ "code": 10002, "message": "Unauthorized", "data": null }
```

## code 语义

业务码 `code` 的取值规则（源自响应拦截器与异常过滤器）：

| 场景 | code 取值 | 说明 |
|------|-----------|------|
| 成功 | `0` | 由 `ApiResponseUtil.success()` 固定返回 |
| 鉴权失败（HTTP 401） | `10002` | 未携带 / 无效 / 过期 Token，过滤器强制置为 `10002` |
| 抛出带 `code` 的 `HttpException` | 异常自带的 `code` | 业务自定义码优先 |
| 其他 `HttpException` | 对应 **HTTP 状态码** | 如 `400` / `403` / `404` / `409` |
| 校验失败（ValidationPipe） | `400` | `message` 为字段错误列表以 `; ` 拼接 |
| 未捕获的服务端异常 | `1` | HTTP `500`，`message` 为「服务器内部错误」或异常信息 |

::: tip 判断成功的正确方式
以 `code === 0` 判断业务成功。失败时 `code` 可能等于 HTTP 状态码，也可能是业务专用码（如 `10002`），两者不一定相同。
:::

## 常见 HTTP 状态码与含义

| HTTP 状态 | 典型 code | 含义 | 常见触发场景 |
|-----------|-----------|------|--------------|
| `200` | `0` | 成功 | 正常请求 |
| `400` | `400` | 请求参数错误 | DTO 校验失败、非法入参 |
| `401` | `10002` | 未鉴权 | Token 缺失 / 无效 / 过期；账号已停用 |
| `403` | `403` | 无权限 | 非管理员访问管理端接口；主办方越权批量操作 / 访问平台级接口；选位通道未开放；对象存储未启用时上传审核视频 |
| `404` | `404` | 资源不存在 | 场次 / 报名 / 位次不存在 |
| `409` | `409` | 冲突 | 选位「位次已被占用或该报名已有位次」；重复提交；场次已取消 / 选位未配置 |
| `500` | `1` | 服务器内部错误 | 未预期的异常 |

## 校验错误示例

请求体字段不合法时，`ValidationPipe`（`whitelist: true`）返回 HTTP `400`：

```json
{
  "code": 400,
  "message": "username must be longer than or equal to 3 characters; password should not be empty",
  "data": null
}
```

::: warning 白名单裁剪
全局 `ValidationPipe` 开启 `whitelist: true`，请求体中未在 DTO 声明的字段会被**自动剔除**，不会报错但也不会生效。对接时请严格遵循各接口的请求体定义。
:::

## 鉴权错误示例

```json
{ "code": 10002, "message": "Unauthorized", "data": null }
```

处理建议：清除本地 Token，引导用户重新登录（`POST /auth/login`）。

## 选位并发冲突示例

路演选位在事务内使用悲观写锁 + 双唯一约束保证一致性，并发抢位失败时返回 HTTP `409`：

```json
{ "code": 409, "message": "位次已被占用或该报名已有位次，请刷新后重试", "data": null }
```

处理建议：重新拉取选位面板（`GET /roadshow/registrations/:id/positions`）获取最新占用状态后再试。详见 [路演选位](/api/roadshow-position)。

## 主办方与视频上传管控相关错误

以下为多主办方体系与审核视频管控新增的业务错误文案（均以实际代码文案为准）：

| HTTP | code | message | 触发场景 |
|------|------|---------|---------|
| `401` | `10002` | `账号已停用，请联系管理员` | `status = 0` 的账号登录（`/auth/login`、`/auth/guest`、`/admin/login`），或携带已签发 Token 请求任意受保护接口（`JwtStrategy.validate` 每请求回查数据库，停用即时生效） |
| `403` | `403` | `无权操作其他主办方的数据` | 主办方批量入口（`POST batch` / `DELETE batch` / `media-download-manifest`）的 `ids` 中含任一非自身名下数据（fail closed，整批拒绝） |
| `403` | `403` | `对象存储未启用，暂不支持上传审核视频` | 对象存储未启用时，审核视频（`review-video`）上传三端点一律拒绝；音频不受影响 |
| `400` | `400` | `不能修改自己的角色或状态` | 超级管理员对**自身** id 调用 `PUT /admin/users/:id`、`/role`、`/status`（自我保护，防自锁） |
| `400` | `400` | `主办方必须填写对外展示名称` | 创建用户或升为主办方（`role = 2`）时 `organizer_name` 为空 |
| `400` | `400` | `角色值无效` | `POST /admin/users` 或 `PUT /admin/users/:id/role` 的 `role` 不在 `{0, 1, 2}` |
| `400` | `400` | `状态值无效` | `PUT /admin/users/:id/status` 的 `status` 不为 `0` / `1` |
| `400` | `400` | `用户名和密码必填` | `POST /admin/users` 缺少 `username` 或 `password` |
| `409` | `409` | `用户名已被使用` | `POST /admin/users` 创建用户时 `username` 与已有账号重复 |

::: tip 主办方单条 / 按场次越权是 404 而非 403
主办方访问非自身名下的**单条**资源（报名 / 投稿详情、审核、删除、导出、编排等）时，为不泄露资源是否存在，返回 `404 场次不存在`（而非 `403`）；仅**批量**入口才返回 `403 无权操作其他主办方的数据`。详见 [主办方 · 数据隔离规则](/api/organizer)。
:::

## 场次与投稿审核相关错误

以下为场次详情与投稿批量 / 审核相关的业务错误文案（均以实际代码文案为准）：

| HTTP | code | message | 触发场景 |
|------|------|---------|---------|
| `400` | `400` | `请提供要操作的投稿 ID 列表` | 投稿批量接口（`POST /admin/submissions/batch`、`DELETE /admin/submissions/batch`）的 `ids` 为空 / 非数组 / 不含合法正整数 |
| `400` | `400` | `部分投稿不存在` | 投稿批量接口的 `ids` 中含不存在的投稿（不做静默忽略） |
| `400` | `400` | `审核状态无效` | 投稿审核（单条 `PUT /admin/submissions/:id/status` 或批量）的 `status` 不在白名单 `pending` / `approved` / `rejected` 内 |
| `404` | `404` | `场次不存在` | 公共 `GET /sessions/:id` 场次不存在；或管理端访问不存在 / **不属于自己**的场次（主办方越权统一用 404，不泄露资源是否存在） |

## 系统日志

所有请求与异常都会写入系统日志（`type = api_request` / `api_error`），管理员可通过 `GET /admin/system-logs` 查询，字段包含 `status_code`、`business_code`、`message`、`duration_ms` 等，详见 [系统运维接口](/api/system)。
