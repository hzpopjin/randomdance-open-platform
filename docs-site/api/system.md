# 系统日志 / 客户端事件 / 云端配置

平台运维相关接口：系统日志、客户端事件上报与查询、云端配置读写，以及管理端仪表盘概览。

## 仪表盘

<span class="m m-get">GET</span> `/admin/dashboard` · <span class="acl acl-admin">管理员</span>

数据概览，供管理后台首页展示。

```bash
curl http://localhost:3002/api/v1/admin/dashboard \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ summary, pending, trend, upcoming_sessions, recent_activity, system_health, generated_at }`

| 字段 | 说明 |
|------|------|
| `summary` | 关键指标汇总（用户 / 报名 / 投稿 / 场次数等） |
| `pending` | 待审核事项 |
| `trend` | 趋势数据 |
| `upcoming_sessions` | 即将开始的场次 |
| `recent_activity` | 近期活动 |
| `system_health` | 系统健康状态 |
| `generated_at` | 生成时间 |

---

## 系统日志

所有 API 请求与异常由全局拦截器 / 过滤器自动写入系统日志。管理端前缀 `admin/system-logs`，鉴权 <span class="acl acl-admin">管理员</span>。

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/system-logs` | 日志列表 | `page, page_size, level, type, keyword` |
| <span class="m m-get">GET</span> | `/admin/system-logs/:id` | 日志详情 | → `SystemLog` 对象 |
| <span class="m m-delete">DELETE</span> | `/admin/system-logs/:id` | 删除单条日志 | → `{ id }` |
| <span class="m m-delete">DELETE</span> | `/admin/system-logs/batch` | 批量删除 | `{ ids: number[] }` → `{ affected }` |
| <span class="m m-delete">DELETE</span> | `/admin/system-logs/clear-filtered` | 按条件清空 | `{ level?, type? }` |
| <span class="m m-delete">DELETE</span> | `/admin/system-logs/clear` | 清空所有日志 | → `{ cleared: true }` |

::: tip 注意路由顺序
`DELETE /admin/system-logs/batch`、`/clear`、`/clear-filtered` 均在 `DELETE /admin/system-logs/:id` 之前声明，避免被 `:id` 通配匹配。
:::

### 日志列表

<span class="m m-get">GET</span> `/admin/system-logs` · <span class="acl acl-admin">管理员</span>

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` / `page_size` | number | 否 | 分页，默认 `1` / `10` |
| `level` | string | 否 | `info` / `warn` / `error` |
| `type` | string | 否 | `api_request` / `api_error` |
| `keyword` | string | 否 | 模糊匹配 `message` / `path` |

```bash
curl "http://localhost:3002/api/v1/admin/system-logs?page=1&page_size=20&level=error&type=api_error" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list: SystemLog[], total, page, page_size }`，按 `created_at` 倒序。

### 日志详情

<span class="m m-get">GET</span> `/admin/system-logs/:id` · <span class="acl acl-admin">管理员</span>

**路径参数**：`id` — 日志 ID。**响应体**：`SystemLog` 对象（不存在时 `data` 为 `null`）。

```bash
curl http://localhost:3002/api/v1/admin/system-logs/1024 \
  -H "Authorization: Bearer <admin_token>"
```

### 删除单条日志

<span class="m m-delete">DELETE</span> `/admin/system-logs/:id` · <span class="acl acl-admin">管理员</span>

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/system-logs/1024 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "id": 1024 }`

### 批量删除日志

<span class="m m-delete">DELETE</span> `/admin/system-logs/batch` · <span class="acl acl-admin">管理员</span>

**请求体**：`{ ids: number[] }`

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/system-logs/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [1024, 1025] }'
```

**响应体**：`{ "affected": 2 }`

### 按条件清空日志

<span class="m m-delete">DELETE</span> `/admin/system-logs/clear-filtered` · <span class="acl acl-admin">管理员</span>

**请求体**：`{ level?: string, type?: string }`（两者均缺省时等价于清空全部）

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/system-logs/clear-filtered \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "level": "info" }'
```

**响应体**：`{ "affected": 128 }`

### 清空所有日志

<span class="m m-delete">DELETE</span> `/admin/system-logs/clear` · <span class="acl acl-admin">管理员</span>

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/system-logs/clear \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "cleared": true }`

### SystemLog 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint | 日志 ID |
| `level` | string | 级别：`info` / `warn` / `error` |
| `type` | string | 类型：`api_request`（成功请求）/ `api_error`（异常） |
| `method` | string \| null | HTTP 方法 |
| `path` | string \| null | 请求路径 |
| `status_code` | number \| null | HTTP 状态码 |
| `business_code` | number \| null | 业务码（成功 `0`，鉴权失败 `10002` 等） |
| `message` | string \| null | 提示信息 |
| `duration_ms` | number \| null | 处理耗时（毫秒） |
| `ip` / `user_agent` | string \| null | 来源 IP / UA |
| `user_id` | string \| null | 关联用户 ID |
| `request_id` | string \| null | 请求追踪 ID |
| `query_payload` / `request_payload` / `response_payload` | json \| null | 查询 / 请求 / 响应快照 |
| `error_stack` | text \| null | 异常堆栈（仅错误） |
| `created_at` | datetime | 记录时间 |

::: tip 日志自身不记录
对 `/api/v1/admin/system-logs` 的请求本身不会被再次写入日志，避免刷屏。
:::

---

## 客户端事件

客户端（前端 / App）可上报埋点事件。上报为公开接口，查询 / 删除为管理端接口。

### 上报事件

<span class="m m-post">POST</span> `/client-events` · <span class="acl acl-public">公开</span>

**请求体**（主要字段，其余按需附带）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `event_id` | string | 是 | 事件唯一 ID，≤ 64 |
| `event_type` | string | 是 | 事件类型，≤ 128（兼容驼峰 `eventType`） |
| `platform` | string | 否 | 平台标识 |
| `device_id` | string | 否 | 设备 ID |
| `request_id` | string | 否 | 请求追踪 ID |
| `uid` / `auth_user_id` | string | 否 | 用户标识 |
| `resource_type` / `resource_id` | string | 否 | 关联资源（兼容驼峰 `resourceType`） |
| `context_payload` | object | 否 | 事件上下文（JSON） |
| `app_version` / `device_model` / `os_version` | string | 否 | 客户端环境信息 |
| `occurred_at` | datetime | 否 | 事件发生时间 |

```bash
curl -X POST http://localhost:3002/api/v1/client-events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_20260701_001",
    "event_type": "roadshow_position_select",
    "platform": "web",
    "device_id": "device-abc",
    "resource_type": "registration",
    "resource_id": "12",
    "context_payload": { "position_id": 101 }
  }'
```

**响应体**：`{ id }`

### 管理端事件接口

前缀 `admin/client-events`，鉴权 <span class="acl acl-admin">管理员</span>。

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/client-events` | 事件列表 | `page, page_size, event_type, keyword` |
| <span class="m m-get">GET</span> | `/admin/client-events/:id` | 事件详情 | → `ClientEvent` 对象 |
| <span class="m m-delete">DELETE</span> | `/admin/client-events/batch` | 批量删除 | `{ ids: number[] }` → `{ affected }` |
| <span class="m m-delete">DELETE</span> | `/admin/client-events/:id` | 删除事件 | → `{ id }` |

`keyword` 会匹配 `event_id` / `device_id` / `event_type`。

#### 事件列表

<span class="m m-get">GET</span> `/admin/client-events` · <span class="acl acl-admin">管理员</span>

**查询参数**：`page` / `page_size`（默认 `1` / `10`）、`event_type`（精确匹配）、`keyword`。

```bash
curl "http://localhost:3002/api/v1/admin/client-events?page=1&page_size=20&event_type=roadshow_position_select" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list: ClientEvent[], total, page, page_size }`，按 `received_at` 倒序。

#### 事件详情

<span class="m m-get">GET</span> `/admin/client-events/:id` · <span class="acl acl-admin">管理员</span>

**路径参数**：`id` — 事件记录 ID。**响应体**：`ClientEvent` 对象（不存在时 `data` 为 `null`）。

```bash
curl http://localhost:3002/api/v1/admin/client-events/5001 \
  -H "Authorization: Bearer <admin_token>"
```

#### 批量删除事件

<span class="m m-delete">DELETE</span> `/admin/client-events/batch` · <span class="acl acl-admin">管理员</span>

**请求体**：`{ ids: number[] }`

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/client-events/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [5001, 5002] }'
```

**响应体**：`{ "affected": 2 }`

#### 删除事件

<span class="m m-delete">DELETE</span> `/admin/client-events/:id` · <span class="acl acl-admin">管理员</span>

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/client-events/5001 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "id": 5001 }`

#### ClientEvent 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint | 事件记录 ID |
| `event_id` | string | 事件唯一 ID |
| `event_type` | string | 事件类型 |
| `platform` / `device_id` / `request_id` | string \| null | 平台 / 设备 / 追踪 ID |
| `uid` / `auth_user_id` | string \| null | 用户标识 |
| `ip` / `user_agent` | string \| null | 来源 IP / UA |
| `resource_type` / `resource_id` | string \| null | 关联资源 |
| `context_payload` | json \| null | 事件上下文 |
| `app_version` / `device_model` / `os_version` | string \| null | 客户端环境 |
| `occurred_at` | datetime | 事件发生时间 |
| `received_at` | datetime | 服务端接收时间 |

---

## 云端配置

键值型云端配置，供客户端拉取运行时参数。

### 读取单项配置

<span class="m m-get">GET</span> `/client-config/:key` · <span class="acl acl-public">公开</span>

**路径参数**：`key` — 配置键

```bash
curl http://localhost:3002/api/v1/client-config/announcement
```

**响应体**：该配置项的值（结构随 `key` 而定）。

### 管理端配置接口

前缀 `admin/client-config`，鉴权 <span class="acl acl-admin">管理员</span>。

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/client-config` | 全部配置列表 | — |
| <span class="m m-put">PUT</span> | `/admin/client-config` | 设置配置 | `{ config_key: string, config_value: any }` |

#### 全部配置列表

<span class="m m-get">GET</span> `/admin/client-config` · <span class="acl acl-admin">管理员</span>

```bash
curl http://localhost:3002/api/v1/admin/client-config \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`[{ config_key, config_value }]`。

#### 设置配置

<span class="m m-put">PUT</span> `/admin/client-config` · <span class="acl acl-admin">管理员</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `config_key` | string | 是 | 配置键（存在则更新，不存在则新建） |
| `config_value` | any | 是 | 配置值（JSON） |

**设置配置示例**

```bash
curl -X PUT http://localhost:3002/api/v1/admin/client-config \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "config_key": "announcement", "config_value": { "text": "夏季路演开始报名", "enabled": true } }'
```

**响应体**：`{ config_key, config_value }`。

::: tip 与对象存储配置的区别
云端配置（`client-config`）是通用键值下发通道；对象存储（TOS）配置是独立的管理接口 `admin/object-storage`，详见 [上传 / TOS 对象存储](/api/upload-tos)。
:::
