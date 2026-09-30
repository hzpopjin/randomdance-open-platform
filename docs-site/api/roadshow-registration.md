# 路演报名

用户提交表演曲目、成员与联系方式；管理员审核、批量处理、更新与导出。用户侧控制器前缀为 `roadshow/registrations`，管理端为 `admin/roadshow/registrations`。

## 用户接口

### 提交报名

<span class="m m-post">POST</span> `/roadshow/registrations` · <span class="acl acl-user">用户</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | number | 是 | 场次 ID |
| `song_name` | string | 是 | 表演歌曲名 |
| `artist_name` | string | 是 | 歌手 / 艺人 |
| `group_name` | string | 是 | 组合 / 队伍名 |
| `song_format` | number | 是 | `0`=原版，`1`=自己剪辑 |
| `edited_file_url` | string | 否 | 剪辑版音频链接（`song_format=1` 时使用） |
| `contact_phone` | string | 是 | 联系方式 |
| `has_other_performance` | number | 是 | 是否有其他表演，`0`/`1` |
| `other_performance_detail` | string | 否 | 其他表演说明 |
| `additional_requirements` | string | 否 | 更多需求 |
| `members` | array | 是 | 成员列表，见下 |
| `device_info` | object | 否 | 设备信息（可省略，自动提取） |

`members[]` 元素：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `member_name` | string | 是 | 成员名 |
| `position` | string | 否 | 队内位置 |
| `sort_order` | number | 是 | 排序序号 |

**curl 示例**

```bash
curl -X POST http://localhost:3002/api/v1/roadshow/registrations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "song_name": "Dynamite",
    "artist_name": "BTS",
    "group_name": "闪光舞团",
    "song_format": 0,
    "contact_phone": "13800000000",
    "has_other_performance": 0,
    "members": [
      { "member_name": "小舞", "position": "领舞", "sort_order": 1 },
      { "member_name": "小跳", "sort_order": 2 }
    ]
  }'
```

**响应体**（`data`）

```json
{ "id": 12 }
```

::: tip 防重复提交
相同内容（SHA-256 表单指纹）+ 同 `(user_id, session_id)` 的重复提交不会新建记录，而是返回已存在的报名 ID。
:::

::: tip 报名流程：先选主办方 → 再选场次
前台报名按「先选主办方 → 再选该主办方名下场次」的顺序进行：先调 [`GET /organizers`](/api/organizer) 拉取可选主办方，再以选中的主办方 id 调 [`GET /sessions?organizer_id=`](/api/session) 拉取其场次。

**报名提交体仍只传 `session_id`**（不传 `organizer_id`）：报名的主办方归属由后端从 `session_id` 对应的场次 `organizer_id` **派生**，客户端无需也无法直接指定归属。
:::

### 我的报名列表

<span class="m m-get">GET</span> `/roadshow/registrations/mine` · <span class="acl acl-user">用户</span>

**查询参数**：`page`（默认 1）、`page_size`（默认 10，≤100）

```bash
curl "http://localhost:3002/api/v1/roadshow/registrations/mine?page=1&page_size=10" \
  -H "Authorization: Bearer <token>"
```

**响应体**：`{ list: Registration[], total, page, page_size }`

### 报名详情

<span class="m m-get">GET</span> `/roadshow/registrations/:id` · <span class="acl acl-user">用户</span>

**路径参数**：`id` — 报名 ID

```bash
curl http://localhost:3002/api/v1/roadshow/registrations/12 \
  -H "Authorization: Bearer <token>"
```

**响应体**：`RegistrationDetail`（含成员列表）。

::: warning 所有权校验
按移植后的语义，该接口收窄为**仅本人可读**（`findById(id, userId)`），管理员角色放行。读取他人报名将返回 `404` / 无权限。
:::

## 管理端接口

管理端前缀均为 `admin/roadshow/registrations`，鉴权 <span class="acl acl-organizer">管理员 / 主办方</span>（`@Roles(ADMIN, ORGANIZER)`）。

::: warning 主办方数据范围
报名的主办方归属由其 `session_id` 对应场次的 `organizer_id` 派生。超级管理员（`role = 1`）可见全部；主办方（`role = 2`）仅能访问名下场次的报名：
> - **列表** `GET /admin/roadshow/registrations`：对主办方静默追加 `session.organizer_id = :organizerScopeId` 过滤，只返回名下报名；
> - **单条 / 按场次**入口（详情 `:id`、审核 `:id/status`、更新 `PUT :id`、删除 `DELETE :id`、导出 `export`、编排 `arrangement/:sessionId`）越权 → `404 场次不存在`（不泄露存在性）；
> - **批量**入口（`POST batch` 批量审核、`DELETE batch` 批量删除、`POST media-download-manifest`）若 `ids` 中**含任一**非自身数据 → `403 无权操作其他主办方的数据`（fail closed，整批拒绝，不做静默过滤）。
>
> 完整语义与越权示例见 [主办方 · 数据隔离规则](/api/organizer)。
:::

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/roadshow/registrations` | 报名管理列表 | `page, page_size, status, session_id, keyword, sort_by, sort_order` |
| <span class="m m-get">GET</span> | `/admin/roadshow/registrations/:id` | 报名管理详情 | 返回 `RegistrationDetail`（含成员列表） |
| <span class="m m-put">PUT</span> | `/admin/roadshow/registrations/:id/status` | 审核报名 | `{ status: "pending"\|"approved"\|"rejected", review_comment? }` |
| <span class="m m-post">POST</span> | `/admin/roadshow/registrations/batch` | 批量审核 | `{ ids: number[], status, review_comment? }` → `{ affected }` |
| <span class="m m-put">PUT</span> | `/admin/roadshow/registrations/:id` | 更新报名信息 | `Partial<Registration>` → `{ id }` |
| <span class="m m-delete">DELETE</span> | `/admin/roadshow/registrations/:id` | 删除报名 | → `{ id }` |
| <span class="m m-delete">DELETE</span> | `/admin/roadshow/registrations/batch` | 批量删除 | `{ ids: number[] }` → `{ affected }` |
| <span class="m m-get">GET</span> | `/admin/roadshow/registrations/export` | 导出 Excel | `session_id`（必填）、`status?` |

### 报名管理列表

<span class="m m-get">GET</span> `/admin/roadshow/registrations` · <span class="acl acl-organizer">管理员 / 主办方</span>

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` / `page_size` | number | 否 | 分页，默认 `1` / `10` |
| `status` | string \| number | 否 | `pending` / `approved` / `rejected`（或 `0` / `1` / `2`） |
| `session_id` | number | 否 | 按场次筛选 |
| `keyword` | string | 否 | 模糊匹配 `group_name` / `song_name` / `artist_name` / `contact_phone` / 用户名 / 昵称 |
| `sort_by` | string | 否 | 排序列：`id` / `created_at` / `updated_at` / `song_name` / `artist_name` / `group_name` / `contact_phone` / `session_name` / `status` / `sort_order`，默认 `created_at` |
| `sort_order` | string | 否 | `ASC` / `ascend` 升序，其余为降序（默认） |

```bash
curl "http://localhost:3002/api/v1/admin/roadshow/registrations?page=1&page_size=10&status=approved&session_id=1&sort_by=sort_order&sort_order=ASC" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list, total, page, page_size }`。`list` 每项含 `id, user_id, user_nickname, username, session_id, session_name, song_name, artist_name, group_name, song_format, edited_file_url, audio_access_url, review_video_url, review_video_access_url, contact_phone, member_count, has_other_performance, other_performance_detail, additional_requirements, status, review_comment, sort_order, position_section, position_no, members[], created_at, updated_at`（`status` 以字符串枚举返回；列表的 `*_access_url` 为 unchecked 签名，不做对象存在性校验）。

### 报名管理详情

<span class="m m-get">GET</span> `/admin/roadshow/registrations/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

**路径参数**：`id` — 报名 ID

```bash
curl http://localhost:3002/api/v1/admin/roadshow/registrations/12 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`RegistrationDetail`，含报名人 / 场次信息、`members[]`（按 `sort_order`）、选位字段 `sort_order`，以及素材字段 `edited_file_url` / `audio_access_url` / `review_video_url` / `review_video_access_url`。报名不存在返回 `404` `报名不存在`。

::: tip 素材签名地址（私有读，60 分钟）
管理端报名**详情与列表**均追加三个素材字段：`audio_access_url`（音频私有读签名）、`review_video_url`（审核视频原始 URL / 对象键）与 `review_video_access_url`（审核视频私有读签名）。其中 `*_access_url` 为私有读签名 URL（**60 分钟有效**），用于直接播放 / 下载托管在 TOS 私有桶的素材，过期需重新拉取；导出（Excel）的音乐 / 审核视频链接列同样使用这些签名地址。批量素材下载地址见 [上传 / TOS 对象存储](/api/upload-tos) 的「编排素材下载清单」。
:::

### 审核报名

<span class="m m-put">PUT</span> `/admin/roadshow/registrations/:id/status` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 是 | `pending` / `approved` / `rejected` |
| `review_comment` | string | 否 | 审核意见，缺省置 `null` |

```bash
curl -X PUT http://localhost:3002/api/v1/admin/roadshow/registrations/12/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "approved", "review_comment": "通过" }'
```

**响应体**：`{ id, status, review_comment }`（`status` 以字符串返回）。报名不存在返回 `404`。

### 批量审核

<span class="m m-post">POST</span> `/admin/roadshow/registrations/batch` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**：`{ ids: number[], status: string, review_comment?: string }`

```bash
curl -X POST http://localhost:3002/api/v1/admin/roadshow/registrations/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [12, 13, 14], "status": "approved" }'
```

**响应体**：`{ "affected": 3 }`

### 更新报名信息

<span class="m m-put">PUT</span> `/admin/roadshow/registrations/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**：`Partial<Registration>`，仅传需更新字段（如 `song_name` / `group_name` / `contact_phone` / `song_format` 等）。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/roadshow/registrations/12 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "contact_phone": "13900000000" }'
```

**响应体**：`{ "id": 12 }`。报名不存在返回 `404` `报名不存在`。

### 删除报名

<span class="m m-delete">DELETE</span> `/admin/roadshow/registrations/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

删除前会先清理该报名的对象存储素材与成员数据（素材清理失败仅告警，不阻断删除）。

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/roadshow/registrations/12 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "id": 12 }`。报名不存在返回 `404` `报名不存在`。

### 批量删除

<span class="m m-delete">DELETE</span> `/admin/roadshow/registrations/batch` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**：`{ ids: number[] }`（为空返回 `400` `请提供要删除的ID列表`）。同样会逐个清理素材与成员数据。

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/roadshow/registrations/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [12, 13] }'
```

**响应体**：`{ "affected": 2 }`

### 导出报名 Excel

<span class="m m-get">GET</span> `/admin/roadshow/registrations/export` · <span class="acl acl-organizer">管理员 / 主办方</span>

**查询参数**：`session_id`（**必填**，缺省返回 `400` `请选择要导出的活动场次`）、`status`（可选）。返回 `.xlsx` 文件流（`Content-Disposition: attachment`），**非** `{code,message,data}` 包裹；导出列含编排顺序 `sort_order`、中场分隔与选位标签。详见 [数据导出](/api/export)。

```bash
curl "http://localhost:3002/api/v1/admin/roadshow/registrations/export?session_id=1&status=approved" \
  -H "Authorization: Bearer <admin_token>" -OJ
```

## 数据结构

### Registration 状态

| status | 含义 |
|--------|------|
| `0` / `"pending"` | 待审核 |
| `1` / `"approved"` | 已通过 |
| `2` / `"rejected"` | 已驳回 |

::: tip 状态表示
用户端与管理端在不同接口中可能以数字或字符串枚举返回状态；管理端审核接口 `status` 接受字符串 `"pending" | "approved" | "rejected"`。
:::

### 选位与媒体扩展字段

报名实体在选位与对象存储功能启用后会附带以下字段（详见 [路演选位](/api/roadshow-position) 与 [上传 / TOS 对象存储](/api/upload-tos)）：

| 字段 | 说明 |
|------|------|
| `sort_order` | 编排后的演出顺序（`null` 表示未编排） |
| `halftime_after` | 是否安排在中场之后 |
| `audio_enabled` | 是否启用音频直传 |
| `review_video_url` / `review_video_submitted` / `review_video_enabled` | 审核视频相关 |
| `song_format_manually_set` | 歌曲形式是否手动设置 |

## 相关接口

- 报名通过后的选位操作：[路演选位](/api/roadshow-position)
- 路演素材（音频 / 审核视频）上传：[上传 / TOS 对象存储](/api/upload-tos)
- Excel 导出：[数据导出](/api/export)
