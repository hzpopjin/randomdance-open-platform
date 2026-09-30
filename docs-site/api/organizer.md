# 主办方 · 新增

平台支持多主办方（`role = 2`）。主办方是一种**管理端角色**：登录后台后只能使用业务互动功能，且**仅能看到自己名下场次**的数据。场次的归属唯一真源是 `sessions.organizer_id`，路演报名与歌单投稿经既有的 `session` 关联**派生**归属，两者本身不冗余存储 `organizer_id`。

::: tip 三种角色的关系
`role` 取值 `0`=普通用户、`1`=超级管理员、`2`=主办方。超级管理员不受数据隔离限制、可访问全部数据与平台级接口；主办方受隔离约束、仅访问业务接口。角色与权限的鉴权实现见 [鉴权机制](/guide/authentication)，主办方账号的增删改由超级管理员在 [用户](/api/user) 接口完成。
:::

## 一、公共主办方列表

<span class="m m-get">GET</span> `/organizers` · <span class="acl acl-public">公开</span>

无需鉴权，供前台报名 / 投稿流程「先选主办方」时拉取可选主办方。响应经全局拦截器包装为 `{ code, message, data }`。

```bash
curl http://localhost:3002/api/v1/organizers
```

**响应体**（`data`）

```json
{
  "list": [
    { "id": 1, "name": "系统主办方" },
    { "id": 7, "name": "主办方A" }
  ],
  "total": 2
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `list[].id` | number | 主办方对应的用户 ID（`users.id`），即场次的 `organizer_id` |
| `list[].name` | string | 对外展示名，取自 `users.organizer_name` |
| `total` | number | 主办方数量（= `list.length`） |

**入选规则**（三者同时满足，按 `id ASC` 排序）：

- `status = 1`（账号启用，停用账号不出现）；
- `organizer_name IS NOT NULL`（未填写对外展示名的账号不出现）；
- `role IN (1, 2)`（超级管理员若填了 `organizer_name` 也会作为「系统主办方」出现，主办方必然出现）。

::: tip 系统主办方
存量场次回填后归属「系统主办方」= 现有 `admin`（`role = 1`）账号，其 `organizer_name` 为 `系统主办方`，因此它会出现在公共列表中，`id` 即 admin 的用户 id。
:::

## 二、主办方能力矩阵

主办方（`role = 2`）登录后台后，后端 `@Roles` 是**唯一权威防线**：可访问的业务接口放行 `role ∈ {1, 2}`，平台级接口仅放行 `role = 1`。主办方直接调用平台级接口返回 `403`。

### 可访问（`@Roles(ADMIN, ORGANIZER)`，受数据隔离）

| 后台功能 | 代表接口 |
|----------|----------|
| 场次管理 | `GET/POST/PUT/DELETE /admin/sessions`（含 `cancel` / `restore`） |
| 报名管理 | `/admin/roadshow/registrations`（列表 / 详情 / 审核 / 更新 / 删除 / 批量 / `export` / `media-download-manifest`） |
| 路演编排 | `GET/PUT /admin/roadshow/registrations/arrangement/:sessionId` |
| 投稿列表 | `/admin/submissions`（列表 / 详情 / 审核 / 删除 / 批量 / `export`） |
| 投稿统计 | `GET /admin/submissions/statistics` |
| 个人资料 | `GET/PATCH /admin/profile` |

### 不可访问（`@Roles(ADMIN)`，仅超级管理员；主办方访问 → `403`）

| 后台功能 | 代表接口 |
|----------|----------|
| 数据大屏 | `/admin/dashboard` |
| 歌曲管理 | `/admin/songs` |
| 随机舞蹈歌单 | `/admin/playlist` 所调用的后端接口 |
| 主办方管理 / 用户管理 | `/admin/users` |
| 对象存储配置 | `/admin/object-storage` |
| 日志浏览（客户端事件） | `/admin/client-events` |
| 系统日志 | `/admin/system-logs` |
| 云端配置 | `/admin/client-config` |
| API 文档 | 前端页面（超管专属菜单项） |

## 三、数据隔离规则

隔离逻辑集中在后端 `organizer-scope` 工具，第三方无法绕过：

- **超级管理员（`role = 1`）**：不加任何过滤，可查看全部场次 / 报名 / 投稿。
- **主办方（`role = 2`）**：仅能访问 `sessions.organizer_id = 当前用户 id` 的场次及其派生的报名 / 投稿数据。
- **列表类接口**（`GET /admin/sessions`、`GET /admin/roadshow/registrations`、`GET /admin/submissions`、`GET /admin/submissions/statistics`）：对主办方**静默追加** `session.organizer_id = :organizerScopeId` 过滤条件，只返回名下数据，不报错。
- **场次写入类**（`POST/PUT/cancel/restore/DELETE /admin/sessions`）：主办方创建场次时 `organizer_id` **强制**为自身 id，忽略请求体传入值；主办方更新场次时不得通过请求体修改 `organizer_id`。超级管理员可显式指定 `organizer_id`，缺省为自身 id（即系统主办方）。

### 404 vs 403 语义

后端对越权采用两种不同语义，理解它们有助于对接：

| 场景 | 语义 | HTTP | message |
|------|------|------|---------|
| **单条 / 按场次**越权（详情、审核、更新、删除、导出、编排、按 `session_id` 的入口） | 与「资源不存在」保持一致，**不泄露资源是否真实存在** | `404` | `场次不存在` |
| **批量**入口越权（`POST batch`、`DELETE batch`、`POST media-download-manifest`），`ids` 中**含任一**非自身数据 | **fail closed**，不做静默过滤，整批拒绝 | `403` | `无权操作其他主办方的数据` |

::: warning 为什么单条是 404 而不是 403
单条越权返回 `404 场次不存在`（而非 `403`）是**有意为之**：避免通过状态码差异探测「某个报名 / 投稿 / 场次是否存在」。批量入口因为需要明确告知「你混入了别人的数据」，才返回 `403`。
:::

::: tip 报名详情越权的实际表现
主办方访问他人报名详情 `GET /admin/roadshow/registrations/:id` 时：若报名本身不存在返回 `404 报名不存在`；若报名存在但归属其他主办方，则归属校验命中，返回 `404 场次不存在`。两者对外都是 `404`，不泄露存在性。
:::

## 四、越权示例

以下示例中 `<organizer_a_token>` 为主办方 A 的 JWT，目标数据归属主办方 B。

**单条越权 → 404**

```bash
# A 尝试读取 B 名下的报名详情（报名 id=88 属于 B 的场次）
curl http://localhost:3002/api/v1/admin/roadshow/registrations/88 \
  -H "Authorization: Bearer <organizer_a_token>"
```

```json
{ "code": 404, "message": "场次不存在", "data": null }
```

**按场次越权（编排 / 导出）→ 404**

```bash
# A 尝试编排 B 的场次（sessionId=9 属于 B）
curl http://localhost:3002/api/v1/admin/roadshow/registrations/arrangement/9 \
  -H "Authorization: Bearer <organizer_a_token>"
```

```json
{ "code": 404, "message": "场次不存在", "data": null }
```

**批量越权 → 403（fail closed）**

```bash
# A 批量审核，ids 中混入了 B 的报名 88
curl -X POST http://localhost:3002/api/v1/admin/roadshow/registrations/batch \
  -H "Authorization: Bearer <organizer_a_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [12, 88], "status": "approved" }'
```

```json
{ "code": 403, "message": "无权操作其他主办方的数据", "data": null }
```

整批被拒绝，A 名下的 `12` 也不会被处理（不做静默过滤）。

**平台级接口越权 → 403**

```bash
# A 尝试访问用户管理接口
curl http://localhost:3002/api/v1/admin/users \
  -H "Authorization: Bearer <organizer_a_token>"
```

主办方不在 `@Roles(ADMIN)` 白名单内，`RolesGuard` 直接返回 `403`。

## 相关接口

- 主办方账号的创建 / 编辑 / 角色 / 状态：[用户](/api/user)
- 场次归属字段与过滤：[场次管理](/api/session)
- 报名数据范围与报名流程：[路演报名](/api/roadshow-registration)
- 投稿数据范围：[歌单投稿](/api/submission)
- 编排归属校验：[路演选位](/api/roadshow-position)
- 角色与鉴权实现：[鉴权机制](/guide/authentication)
