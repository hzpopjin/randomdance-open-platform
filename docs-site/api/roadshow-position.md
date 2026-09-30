# 路演选位 · 新增

场次开启选位通道后，**已通过审核**的报名用户可在选位面板实时抢位、幂等取消；管理端可对整场演出顺序与位次进行可视化编排。

::: warning 接口状态与真实前缀
路演选位由后端并行实现，契约以本页为准。用户侧选位接口的真实控制器前缀为 **`roadshow/registrations`**（非 `roadshow`），因此完整路径为 `/api/v1/roadshow/registrations/:id/position(s)`。管理端编排前缀为 `admin/roadshow/registrations`。
:::

## 概念模型

- **位次（Position）**：场次内一个可被占用的演出位，分为两个分区：
  - `regular`（普通区）：正常演出顺序位。
  - `halftime`（中场区）：安排在中场休息之后的演出位。
- **分区容量**：由该场次**已通过报名数**动态计算——
  - ≤ 20 组：普通 / 中场各预留 3 个冗余位；
  - \> 20 组：按 15% 向上取整计算冗余位。
  面板会随通过数增长自动补位（动态尾部扩容）。
- **参考时间（reference_time）**：按每组时长 `slot_minutes` 与中场延后 `halftime_delay_minutes` 从活动开始时间推算，仅供用户参考；中场位仅显示时间不强调顺序（`reference_time_only = true`）。
- **占用者公开字段**：位次被占用时，仅公开 `group_name`、`song_name`、`artist_name` 三个字段，不泄露联系方式等隐私。

## 场次选位配置字段

选位行为由场次（Session）上的 4 个配置字段控制，管理员在场次创建 / 更新时设置（详见 [场次管理](/api/session)）：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `roadshow_selection_enabled` | boolean | `false` | 是否开启本场选位通道 |
| `roadshow_selection_open_at` | datetime \| null | `null` | 选位开放时间（须早于活动开始时间） |
| `roadshow_slot_minutes` | number | `5` | 每组演出时长（分钟），用于推算参考时间 |
| `roadshow_halftime_delay_minutes` | number | `60` | 中场相对普通区末尾的延后分钟数 |

### 选位状态机（selection_state）

面板返回的 `selection_state` 取值：

| 状态 | 含义 | 用户能否选位 |
|------|------|------|
| `disabled` | 场次未开启选位通道 | 否（`409`） |
| `not_configured` | 已开启但未配置开放时间 | 否（`409`） |
| `not_open` | 尚未到开放时间 | 否（`403`） |
| `open` | 选位通道已开放 | 是 |
| `cancelled` | 场次已取消 | 否，面板返回空位次 |

---

## 用户选位面板

<span class="m m-get">GET</span> `/roadshow/registrations/:id/positions` · <span class="acl acl-user">用户</span>

拉取指定报名所在场次的完整选位面板。仅**本人报名**可读（管理员放行）。

**路径参数**：`id` — 报名 ID（registration id）

```bash
curl http://localhost:3002/api/v1/roadshow/registrations/12/positions \
  -H "Authorization: Bearer <token>"
```

**响应体**（`data`）

```json
{
  "registration": {
    "id": 12,
    "group_name": "闪光舞团",
    "song_name": "Dynamite",
    "artist_name": "BTS",
    "status": "approved",
    "eligible": true
  },
  "session": {
    "id": 1,
    "name": "夏日随舞路演",
    "event_date": "2026-07-01T14:00:00.000Z",
    "location": "市中心广场",
    "selection_enabled": true,
    "selection_open_at": "2026-06-20T10:00:00.000Z",
    "slot_minutes": 5,
    "halftime_delay_minutes": 60
  },
  "selection_state": "open",
  "selection_state_message": "选位通道已开放",
  "server_time": "2026-06-20T10:05:00.000Z",
  "capacity": {
    "approved_registration_count": 18,
    "reserve_count": 3,
    "calculated_regular_count": 21,
    "calculated_halftime_count": 21,
    "regular_count": 21,
    "halftime_count": 21,
    "total_count": 42
  },
  "current_selection": null,
  "positions": [
    {
      "id": 101,
      "section": "regular",
      "position_no": 1,
      "label": "普通 1",
      "reference_time": "2026-07-01T14:00:00.000Z",
      "reference_time_only": false,
      "status": "available",
      "occupant": null,
      "registration_id": null,
      "selected_at": null
    },
    {
      "id": 102,
      "section": "regular",
      "position_no": 2,
      "label": "普通 2",
      "reference_time": "2026-07-01T14:05:00.000Z",
      "reference_time_only": false,
      "status": "occupied",
      "occupant": {
        "group_name": "夜行者",
        "song_name": "Kick It",
        "artist_name": "NCT 127"
      },
      "registration_id": null,
      "selected_at": null
    }
  ]
}
```

**位次的 `status` 字段**（相对当前登录用户）：

| status | 含义 |
|--------|------|
| `available` | 空闲，可选 |
| `occupied` | 被他人占用（`registration_id` / `selected_at` 对非本人隐藏为 `null`） |
| `mine` | 当前用户本人已选中 |

- `registration.eligible` 为 `true`（报名已通过）才允许选位。
- `current_selection` 为当前用户已选中的位次对象，未选则为 `null`。
- `server_time` 用于客户端校准倒计时，避免本地时钟偏差。

::: tip 前端轮询建议
选位面板建议以 5s 间隔轮询刷新占用状态，并在页面不可见时暂停轮询（`refetchIntervalInBackground: false`）以降低服务端负载。
:::

## 确认选位

<span class="m m-put">PUT</span> `/roadshow/registrations/:id/position` · <span class="acl acl-user">用户</span>

为本人报名抢占一个空闲位次。一个报名同一时刻只能占用一个位次。

**路径参数**：`id` — 报名 ID

**请求体**

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `position_id` | number | 是 | 目标位次 ID，≥ 1 |
| `device_info` | object | 否 | 设备信息（可省略） |

```bash
curl -X PUT http://localhost:3002/api/v1/roadshow/registrations/12/position \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "position_id": 101 }'
```

**成功响应**（`data`）

```json
{ "selected": true, "position_id": 101 }
```

**失败场景**

| HTTP | code | 触发条件 |
|------|------|---------|
| `403` | `403` | 选位通道未到开放时间（`not_open`） |
| `409` | `409` | 通道未开启 / 未配置 / 场次取消，或报名未通过审核 |
| `409` | `409` | 位次已被占用，或该报名已占用另一个位次（并发冲突）：`位次已被占用或该报名已有位次，请刷新后重试` |

重复提交当前已经占用的同一 `position_id` 会幂等返回成功，不会重复写入选位事件。

## 取消选位

<span class="m m-delete">DELETE</span> `/roadshow/registrations/:id/position` · <span class="acl acl-user">用户</span>

释放本人报名当前占用的位次。

**路径参数**：`id` — 报名 ID

**请求体**（可选）：`{ "device_info"?: object }`

```bash
curl -X DELETE http://localhost:3002/api/v1/roadshow/registrations/12/position \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**响应体**（`data`）

```json
{ "cancelled": true, "position_id": 101 }
```

若当前并未占用任何位次，返回幂等结果：

```json
{ "cancelled": false, "position_id": null }
```

::: tip 幂等取消
取消操作是**幂等**的：重复取消、或在未选位时取消都不会报错，仅返回 `cancelled: false`。管理端锁定的位次（`admin_locked`）在取消时会一并解除锁定标记。
:::

## 并发与一致性语义

选位的正确性由后端在数据库事务内保证，第三方无需（也无法）干预，但需理解其对外表现：

- **固定顺序悲观写锁**：选位事务内按 **Session → Registration → Position** 的固定顺序加悲观写锁，锁顺序不可打乱，以避免死锁。
- **双唯一约束**：
  - `UQ_roadshow_positions_session_section_no`（`session_id, section, position_no`）——同一场次同分区同位次号唯一；
  - `UQ_roadshow_positions_registration`（`registration_id` UNIQUE）——一个报名至多占一个位次。
- **兜底与幂等**：即便并发穿透锁，唯一约束冲突也会被 `isUniqueConstraintError` 捕获并转为 HTTP `409`「位次已被占用或该报名已有位次，请刷新后重试」。
- **审计事件**：每次 `select` / `cancel` / `admin_assign` / `admin_cancel` 都会写入位次事件表，含来源设备信息。

::: tip 客户端应对并发
收到 `409` 时，请重新拉取选位面板获取最新占用状态后再决定是否重试，切勿盲目重复提交同一 `position_id`。
:::

---

## 管理端编排

管理端可无视选位开放时间，直接对整场进行顺序与位次编排（拖拽、精确分配、批量顺序排入、锁定）。编排接口鉴权 <span class="acl acl-organizer">管理员 / 主办方</span>（`@Roles(ADMIN, ORGANIZER)`）。

::: warning 编排的归属校验
获取 / 保存编排（`arrangement/:sessionId`）在进入编排服务**之前**先做场次归属校验：主办方（`role = 2`）对**非自身名下**的 `sessionId` 编排时，返回 `404 场次不存在`（与「资源不存在」语义一致，不泄露场次是否存在）；超级管理员（`role = 1`）不受限。详见 [主办方 · 数据隔离规则](/api/organizer)。
:::

### 获取编排视图

<span class="m m-get">GET</span> `/admin/roadshow/registrations/arrangement/:sessionId` · <span class="acl acl-organizer">管理员 / 主办方</span>

**路径参数**：`sessionId` — 场次 ID

```bash
curl http://localhost:3002/api/v1/admin/roadshow/registrations/arrangement/1 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）

```json
{
  "session": {
    "id": 1,
    "name": "夏日随舞路演",
    "event_date": "2026-07-01T14:00:00.000Z",
    "location": "市中心广场",
    "selection_enabled": true,
    "selection_open_at": "2026-06-20T10:00:00.000Z",
    "slot_minutes": 5,
    "halftime_delay_minutes": 60,
    "is_cancelled": false
  },
  "version": "12,13,14|101:12:0,102:0:0",
  "counts": {
    "total_registration_count": 20,
    "approved_count": 18,
    "pending_count": 1,
    "rejected_count": 1,
    "selected_count": 10,
    "unselected_count": 8,
    "reserve_count": 3,
    "regular_position_count": 21,
    "halftime_position_count": 21
  },
  "positions": [
    {
      "id": 101,
      "section": "regular",
      "position_no": 1,
      "reference_time": "2026-07-01T14:00:00.000Z",
      "selected_at": "2026-06-20T10:06:00.000Z",
      "locked": false,
      "registration": {
        "id": 12,
        "group_name": "闪光舞团",
        "song_name": "Dynamite",
        "artist_name": "BTS",
        "additional_requirements": null,
        "owner_username": "dancer_01",
        "owner_user_id": 5,
        "member_count": 2,
        "sort_order": 1,
        "created_at": "2026-06-10T09:00:00.000Z"
      }
    }
  ],
  "unassigned_registrations": []
}
```

::: warning owner 字段适配
源站编排视图中的 `owner_uid` 依赖 WordPress `wp_user_id`。开放平台无此字段，**适配为本地** `owner_user_id`（= `registration.user_id`）与 `owner_username`（= `user.username || user.nickname`）。对接时以 `owner_user_id` / `owner_username` 为准。
:::

- `version`：编排版本号，由已通过报名 ID 与各位次占用 / 锁定状态哈希拼接而成，用于保存时的乐观并发校验。
- `unassigned_registrations`：已通过但尚未分配位次的报名列表，结构与 `positions[].registration` 一致。

### 保存编排

<span class="m m-put">PUT</span> `/admin/roadshow/registrations/arrangement/:sessionId` · <span class="acl acl-organizer">管理员 / 主办方</span>

**路径参数**：`sessionId` — 场次 ID

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `expected_version` | string | 否 | 读取编排时拿到的 `version`；若与服务端当前版本不一致则拒绝保存（版本冲突） |
| `items` | array | 是 | 编排项数组，见下 |

`items[]` 元素：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `registration_id` | number | 是 | 报名 ID |
| `section` | string | 是 | `"regular"` 或 `"halftime"` |
| `position_no` | number | 是 | 位次号，正整数 |
| `locked` | boolean | 否 | 是否锁定该位次，默认 `false`。锁定后写入位次的 `admin_locked`，编排视图中以 `positions[].locked` 回显；**已锁定位次**若被调整（变更 `section` / `position_no`）或未包含在提交项（移回待分配区），保存将返回 `409` |

约束：`items` 必须为数组，否则 `400` `请提供路演编排数据`；`section` 仅允许 `regular`/`halftime`；`position_no` 为正整数；同一 `(section, position_no)` 在提交项内不得重复，且提交项内的报名不得无效或重复，否则 `400` `编排数据中存在无效或重复的组`；当前时段可用位次不足时返回 `400` `当前时段位次不足，请刷新后重试`。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/roadshow/registrations/arrangement/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "expected_version": "12,13,14|101:12:0,102:0:0",
    "items": [
      { "registration_id": 12, "section": "regular", "position_no": 1, "locked": true },
      { "registration_id": 13, "section": "regular", "position_no": 2 },
      { "registration_id": 14, "section": "halftime", "position_no": 1 }
    ]
  }'
```

**响应**：保存成功后返回最新的编排视图（结构同「获取编排视图」）。

- 保存在事务内加行锁，并同步报名的 `sort_order`（用于 Excel 导出顺序）。
- 支持**部分编排**：仅提交需要变更的位次。
- 传入的 `expected_version` 与服务端不一致时返回版本冲突错误，客户端应重新拉取编排视图后再保存。

#### 锁定与并发冲突（`409`）

锁定（`locked` / `admin_locked`）用于固定关键位次，避免被后续编排意外挪动。保存编排时后端按以下顺序校验，任一命中即返回 `409 ConflictException`：

| 触发条件 | HTTP | 提示信息 |
|---------|------|---------|
| 已锁定位次对应的报名**未包含**在本次提交项中（等价于移回待分配区） | `409` | `第 {position_no} 组已锁定，请先解锁再移回待分配区` |
| 已锁定位次的 `section` / `position_no` 被**调整** | `409` | `第 {position_no} 组已锁定，请先解锁再调整` |
| `expected_version` 与服务端当前版本不一致（乐观并发） | `409` | `路演位次已被其他用户或管理员更新，请刷新后重试` |
| 已通过的路演组数发生变化（容量重算） | `409` | `已通过的路演组数已变化，请刷新后重新编排` |

::: tip 解锁方式
如需调整或移除已锁定位次，请在提交项中显式将该位次的 `locked` 置为 `false` 并保持在 `items` 中（原 `section` / `position_no`），先解锁再做后续变更；用户端取消选位时也会一并解除该位次的锁定标记。
:::

## 数据结构参考

### Position（面板位次对象）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 位次 ID（选位时使用） |
| `section` | string | `regular` / `halftime` |
| `position_no` | number | 分区内位次号 |
| `label` | string | 展示标签，如「普通 1」「中场 2」 |
| `reference_time` | string \| null | 推算的参考演出时间（ISO 8601） |
| `reference_time_only` | boolean | 中场位为 `true`（仅显示时间） |
| `status` | string | `available` / `occupied` / `mine` |
| `occupant` | object \| null | 占用者公开字段 `{ group_name, song_name, artist_name }` |
| `registration_id` | number \| null | 仅当为本人位次时返回，否则 `null` |
| `selected_at` | string \| null | 仅当为本人位次时返回选中时间 |

## 相关接口

- 报名与审核：[路演报名](/api/roadshow-registration)
- 场次选位配置：[场次管理](/api/session)
- 导出顺序（含 `sort_order` / 中场分隔 / 选位标签列）：[数据导出](/api/export)
