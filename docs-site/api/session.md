# 场次管理

场次（Session）是路演报名、歌单投稿与选位的载体。公开接口供用户浏览，管理端负责增删改与选位配置。用户侧前缀 `sessions`，管理端前缀 `admin/sessions`。

## 公开接口

### 公开场次列表

<span class="m m-get">GET</span> `/sessions` · <span class="acl acl-public">公开</span>

返回未取消的公开场次列表，按 `event_date` 倒序。

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `organizer_id` | number | 否 | 按主办方过滤，仅返回 `organizer_id` 等于该值的场次；非法 / 空值被忽略（等价于不过滤） |

```bash
# 全部公开场次
curl http://localhost:3002/api/v1/sessions

# 仅某主办方的场次（前台「先选主办方 → 再选场次」流程使用）
curl "http://localhost:3002/api/v1/sessions?organizer_id=7"
```

**响应体**（`data`）：`{ list: Session[], total: number }`。每个 `Session` 行**新增** `organizer_id`（归属主办方用户 id，回填前可能为 `null`）与 `organizer_name`（归属主办方对外展示名，无归属时为 `null`）。可选主办方列表见 [主办方 · 公共主办方列表](/api/organizer)。

::: warning 列表布尔字段以 `0` / `1` 返回
本**列表**接口 `GET /sessions` 的 `is_cancelled`、`roadshow_selection_enabled` 历史上一直以 MySQL 原生 **`0` / `1`** 返回（未归一为 JSON 布尔值，该侧未改动）；而**详情**接口 `GET /sessions/:id` 返回标准 `true` / `false`。两者形态不一致，详见下方[场次详情](#场次详情)。
:::

### 场次详情

<span class="m m-get">GET</span> `/sessions/:id` · <span class="acl acl-public">公开</span>

**路径参数**：`id` — 场次 ID。**响应体**：`Session` 对象（同样携带 `organizer_id`、`organizer_name`）。

```bash
curl http://localhost:3002/api/v1/sessions/1
```

**错误响应**：场次不存在（`id` 无对应记录）时返回 `404`，`message` 为 `场次不存在`。

```json
{ "code": 404, "message": "场次不存在", "data": null }
```

::: tip 布尔字段的 JSON 形态
详情接口 `GET /sessions/:id` 的 `is_cancelled`、`roadshow_selection_enabled` 返回标准 JSON 布尔值 **`true` / `false`**。

> **注意形态差异**：**列表**接口 `GET /sessions` 的这两个字段历史上一直以 MySQL 原生 **`0` / `1`** 返回（该侧未改动，如实描述）。因此列表与详情两接口对同一布尔字段的取值形态并不一致：列表为 `0` / `1`，详情为 `false` / `true`。对接时请按接口分别处理，勿假设两接口形态相同。
:::

## 管理端接口

管理端前缀均为 `admin/sessions`，鉴权 <span class="acl acl-organizer">管理员 / 主办方</span>（`@Roles(ADMIN, ORGANIZER)`）。

::: warning 主办方数据隔离
超级管理员（`role = 1`）可见并操作全部场次；主办方（`role = 2`）**仅能访问 `organizer_id = 自身 id` 的场次**：
> - 列表 `GET /admin/sessions` 对主办方静默追加 `WHERE s.organizer_id = ?`，`total` 也按名下场次统计；
> - 更新 / 取消 / 恢复 / 删除对非自身场次一律返回 `404 场次不存在`（不泄露存在性）。
>
> 完整隔离规则与 404 / 403 语义见 [主办方 · 数据隔离规则](/api/organizer)。
:::

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/sessions` | 场次管理列表（含报名 / 投稿数） | `page, page_size` → `{ list, total, page, page_size }` |
| <span class="m m-post">POST</span> | `/admin/sessions` | 创建场次 | 见下方请求体 |
| <span class="m m-put">PUT</span> | `/admin/sessions/:id` | 更新场次 | `Partial<Session>` |
| <span class="m m-put">PUT</span> | `/admin/sessions/:id/cancel` | 取消场次 | → `Session` |
| <span class="m m-put">PUT</span> | `/admin/sessions/:id/restore` | 恢复场次 | → `Session` |
| <span class="m m-delete">DELETE</span> | `/admin/sessions/:id` | 删除场次（无关联数据时） | → `{ id, name }` |

### 创建 / 更新场次请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 场次名称，≤ 128 |
| `event_date` | datetime | 是 | 活动开始时间 |
| `location` | string | 是 | 地点，≤ 256 |
| `registration_start` | datetime | 否 | 报名开始时间 |
| `registration_end` | datetime | 否 | 报名结束时间 |
| `venue_info` | text | 否 | 场地信息 |
| `roadshow_selection_enabled` | boolean | 否 | 是否开启路演选位通道，默认 `false` |
| `roadshow_selection_open_at` | datetime | 否 | 选位开放时间，默认 `null` |
| `roadshow_slot_minutes` | number | 否 | 每组演出时长（分钟），默认 `5` |
| `roadshow_halftime_delay_minutes` | number | 否 | 中场延后分钟数，默认 `60` |
| `organizer_id` | number | 否 | 归属主办方用户 id；**仅超级管理员可显式指定**，缺省为自身（系统主办方）；主办方传入该字段会被忽略 |

::: warning 归属写入规则（organizer_id 由服务端决定）
创建 / 更新场次时，`organizer_id` **不由客户端自由控制**：
> - **主办方（`role = 2`）**：创建时 `organizer_id` **强制**为自身 id，忽略请求体传入值；更新时请求体中的 `organizer_id` 被剔除，不得改归属。
> - **超级管理员（`role = 1`）**：创建时可显式指定 `organizer_id`（将场次指派给某主办方），未指定时默认为自身 id（即系统主办方）；更新时可重新指派归属。
:::

**curl 示例（创建含选位配置的场次）**

```bash
curl -X POST http://localhost:3002/api/v1/admin/sessions \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "夏日随舞路演",
    "event_date": "2026-07-01T14:00:00.000Z",
    "location": "市中心广场",
    "registration_start": "2026-06-01T00:00:00.000Z",
    "registration_end": "2026-06-25T23:59:59.000Z",
    "venue_info": "室内舞台，含音响",
    "roadshow_selection_enabled": true,
    "roadshow_selection_open_at": "2026-06-20T10:00:00.000Z",
    "roadshow_slot_minutes": 5,
    "roadshow_halftime_delay_minutes": 60
  }'
```

::: warning 选位配置校验
创建 / 更新场次时会执行 `assertRoadshowSelectionConfig`：`roadshow_slot_minutes` 必须是 `1`–`60` 的整数，`roadshow_halftime_delay_minutes` 必须是 `0`–`360` 的整数；当 `roadshow_selection_enabled = true` 时，`roadshow_selection_open_at` 必填且必须**早于** `event_date`（活动开始时间），否则返回 `400` 校验错误。未开启选位则不做开放时间约束。
:::

### 场次管理列表

<span class="m m-get">GET</span> `/admin/sessions` · <span class="acl acl-organizer">管理员 / 主办方</span>

**查询参数**：`page`（默认 `1`）、`page_size`（默认 `10`），按 `event_date` 倒序。

```bash
curl "http://localhost:3002/api/v1/admin/sessions?page=1&page_size=10" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list, total, page, page_size }`。`list` 每项为 `Session` 对象，额外携带该场次的统计字段：

| 字段 | 说明 |
|------|------|
| `submission_count` | 该场次歌单投稿数 |
| `registration_count` | 该场次路演报名数 |
| `organizer_name` | 归属主办方对外展示名（`LEFT JOIN users`，无归属时为 `null`） |

`list` 每项同时携带 `Session` 自身的 `organizer_id` 字段。主办方调用时仅返回其名下场次。

### 更新场次

<span class="m m-put">PUT</span> `/admin/sessions/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

**路径参数**：`id` — 场次 ID。**请求体**：`Partial<Session>`（字段同上方「创建 / 更新场次请求体」），仅传需更新字段。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/sessions/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "roadshow_slot_minutes": 6, "roadshow_selection_open_at": "2026-06-18T10:00:00.000Z" }'
```

**响应体**：更新后的 `Session` 对象。场次不存在返回 `404` `场次不存在`；同样执行 `assertRoadshowSelectionConfig` 校验。

### 取消场次

<span class="m m-put">PUT</span> `/admin/sessions/:id/cancel` · <span class="acl acl-organizer">管理员 / 主办方</span>

将场次置为已取消（`is_cancelled = true`，写入 `cancelled_at`）。已取消场次的选位面板返回空位次。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/sessions/1/cancel \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：更新后的 `Session` 对象（含 `is_cancelled` / `cancelled_at`）。场次不存在返回 `404`。

### 恢复场次

<span class="m m-put">PUT</span> `/admin/sessions/:id/restore` · <span class="acl acl-organizer">管理员 / 主办方</span>

撤销取消（`is_cancelled = false`，`cancelled_at = null`）。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/sessions/1/restore \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：更新后的 `Session` 对象。场次不存在返回 `404`。

### 删除场次

<span class="m m-delete">DELETE</span> `/admin/sessions/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

仅当场次**无关联数据**时可删除。

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/sessions/1 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "id": 1, "name": "夏日随舞路演" }`

| HTTP | 触发条件 |
|------|---------|
| `404` | 场次不存在 |
| `409` | 该场次已有路演报名或歌单投稿：`该场次已有 X 条路演报名和 Y 条歌单投稿，无法删除` |

## 数据结构

### Session 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 场次 ID |
| `name` | string | 场次名称 |
| `event_date` | datetime | 活动开始时间 |
| `location` | string | 地点 |
| `registration_start` | datetime \| null | 报名开始时间 |
| `registration_end` | datetime \| null | 报名结束时间 |
| `venue_info` | text \| null | 场地信息 |
| `roadshow_selection_enabled` | boolean | 是否开启选位通道。**详情**接口返回 `true` / `false`；**列表** `GET /sessions` 历史上以 `0` / `1` 返回 |
| `roadshow_selection_open_at` | datetime \| null | 选位开放时间 |
| `roadshow_slot_minutes` | number | 每组演出时长（分钟） |
| `roadshow_halftime_delay_minutes` | number | 中场延后分钟数 |
| `is_cancelled` | boolean | 是否已取消。**详情**接口返回 `true` / `false`；**列表** `GET /sessions` 历史上以 `0` / `1` 返回 |
| `cancelled_at` | datetime \| null | 取消时间 |
| `organizer_id` | number \| null | 归属主办方用户 id（唯一归属真源），回填前可能为 `null` |
| `organizer_name` | string \| null | 归属主办方对外展示名，由 `LEFT JOIN users` 派生（非实体列），无归属时为 `null` |

::: tip 复合索引
`sessions` 除现有 `IDX_sessions_event_date`、`IDX_sessions_visibility_event_date` 外，新增复合索引 `IDX_sessions_organizer_event_date`（`['organizer_id', 'event_date']`），用于加速主办方维度的按活动时间过滤 / 排序查询。`organizer_id` 为可空列，`synchronize` 重启仅做 `ADD COLUMN` / `ADD INDEX`，不锁表。
:::

选位相关的 4 个字段直接驱动 [路演选位](/api/roadshow-position) 的状态机与参考时间计算。

## 相关接口

- 场次下的报名：[路演报名](/api/roadshow-registration)
- 场次选位面板：[路演选位](/api/roadshow-position)
- 场次下的投稿：[歌单投稿](/api/submission)
