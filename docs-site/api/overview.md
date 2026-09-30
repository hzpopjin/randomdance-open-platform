# API 约定

本节汇总开放平台所有接口的通用约定：基础路径、响应包裹结构、分页、鉴权标注与设备信息。

## 基础路径

```
http://<host>:<port>/api/v1
```

后端 `main.ts` 通过 `setGlobalPrefix('api/v1')` 设置。本文档接口路径默认省略该前缀，仅书写资源路径，实际调用需补全。例如 `/auth/login` 的完整地址是 `/api/v1/auth/login`。

## 响应包裹结构

除被 `@SkipResponseWrap()` 标记的接口（如文件下载 / 二进制流）外，所有响应经全局 `ResponseInterceptor` 统一包裹：

```json
{
  "code": 0,
  "message": "success",
  "data": { }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | 业务码，成功恒为 `0`；失败见 [错误码约定](/api/errors) |
| `message` | string | 提示信息，成功为 `"success"` |
| `data` | any | 业务数据，失败时为 `null` |

::: tip 成功判断
客户端应以 `code === 0` 判断业务成功，而非仅依赖 HTTP 状态码。异常时 HTTP 状态码与业务 `code` 可能不同（如鉴权失败 HTTP `401` 对应 `code = 10002`）。
:::

各接口文档中标注的「响应体」均指 `data` 字段内部的结构。

## 分页

列表接口普遍支持分页查询参数（`PaginationDto`）：

| 参数 | 类型 | 默认 | 约束 |
|------|------|------|------|
| `page` | number | `1` | ≥ 1 |
| `page_size` | number | `10` | 1–100 |

分页响应 `data` 结构通常为：

```json
{
  "list": [],
  "total": 0,
  "page": 1,
  "page_size": 10
}
```

## 鉴权级别标注

| 标注 | 含义 | 守卫 |
|------|------|------|
| <span class="acl acl-public">公开</span> | 无需 Token | 无 |
| <span class="acl acl-user">用户</span> | 需有效 JWT | `AuthGuard('jwt')` |
| <span class="acl acl-organizer">管理员 / 主办方</span> | 需 JWT 且 `role ∈ {1, 2}`，主办方仅见名下数据 | `AuthGuard('jwt')` + `RolesGuard` + `@Roles(ADMIN, ORGANIZER)` |
| <span class="acl acl-admin">仅超级管理员</span> | 需 JWT 且 `role = 1` | `AuthGuard('jwt')` + `RolesGuard` + `@Roles(ADMIN)` |

::: tip 角色与数据隔离
`role` 取值 `0`=普通用户、`1`=超级管理员、`2`=主办方。业务管理端接口（场次 / 报名 / 投稿 / 编排 / 个人资料）放行超级管理员与主办方，主办方受**数据隔离**约束，仅能访问 `sessions.organizer_id = 自身 id` 的场次及其派生数据；平台级接口（用户与主办方管理、对象存储、歌曲库、数据大屏、日志、云端配置等）**仅超级管理员**可访问。详见 [主办方](/api/organizer) 与 [鉴权机制](/guide/authentication)。
:::

受保护接口请求头：`Authorization: Bearer <token>`。获取 Token 见 [鉴权机制](/guide/authentication)。

## HTTP 方法徽标

文档中接口以徽标标注方法：<span class="m m-get">GET</span> <span class="m m-post">POST</span> <span class="m m-put">PUT</span> <span class="m m-patch">PATCH</span> <span class="m m-delete">DELETE</span>

## 设备信息（device_info）

路演报名、投稿、选位等写操作支持可选的 `device_info` 对象，用于风控与审计（记录来源设备）。未显式传入时，后端会从请求头自动提取。该字段对所有接口均为**可选**，第三方对接时可忽略。

## 表单防重复提交

路演报名与歌单投稿使用 SHA-256 **表单指纹** + `(user_id, session_id)` 唯一约束防止重复提交：相同内容的重复提交返回**已存在记录的 ID**，不会创建新记录。

## 接口分组索引

| 分组 | 说明 | 链接 |
|------|------|------|
| 路演报名 | 用户提交、我的报名、管理端审核与导出 | [roadshow-registration](/api/roadshow-registration) |
| 路演选位 · 新增 | 用户抢位面板、确认 / 取消选位、管理端编排 | [roadshow-position](/api/roadshow-position) |
| 歌单投稿 | 投稿提交、审核、统计、导出 | [submission](/api/submission) |
| 场次管理 | 公开场次、管理端增删改与选位配置 | [session](/api/session) |
| 歌曲库 | 曲库增删改查与状态管理 | [song](/api/song) |
| 用户 | 用户列表、详情、角色 / 状态变更、主办方管理 | [user](/api/user) |
| 主办方 · 新增 | 公共主办方列表、能力矩阵、数据隔离与越权语义 | [organizer](/api/organizer) |
| 上传 / TOS 对象存储 · 新增 | 本地 / 对象存储上传、预签名直传、桶 CORS | [upload-tos](/api/upload-tos) |
| 数据导出 | 报名 / 投稿 Excel 导出 | [export](/api/export) |
| 系统运维 | 系统日志、客户端事件、云端配置 | [system](/api/system) |
| 错误码约定 | 业务码语义与 HTTP 映射 | [errors](/api/errors) |

## 音源服务（FastAPI 代理）

平台通过 Nginx 代理外部 FastAPI 音源服务，前缀为 `/fa-api`（**不带** `/api/v1`），均为公开接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| <span class="m m-get">GET</span> | `/fa-api/songs` | 歌曲列表（`page, page_size, search, artist`） |
| <span class="m m-get">GET</span> | `/fa-api/songs/:id` | 歌曲详情 |
| <span class="m m-get">GET</span> | `/fa-api/songs/artists` | 歌手列表 |
| <span class="m m-get">GET</span> | `/fa-api/playlists` | 歌单列表 |
| <span class="m m-get">GET</span> | `/fa-api/playlists/:id` | 歌单详情 |
| <span class="m m-get">GET</span> | `/fa-api/songs/stream/:id` | 全曲音频流 |
| <span class="m m-get">GET</span> | `/fa-api/songs/stream/chorus/:id` | 副歌音频流 |

音源服务为外部依赖，具体契约以 FastAPI 服务本身为准。
