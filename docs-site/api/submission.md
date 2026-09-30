# 歌单投稿

用户从曲库选曲或自定义歌曲提交随舞歌单投稿；管理员审核、统计与导出。用户侧控制器前缀为 `submissions`，管理端为 `admin/submissions`。

## 用户接口

### 提交投稿

<span class="m m-post">POST</span> `/submissions` · <span class="acl acl-user">用户</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | number | 是 | 场次 ID |
| `songs` | array | 是 | 歌曲列表，见下 |
| `device_info` | object | 否 | 设备信息（可省略） |

`songs[]` 元素：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `song_id` | number | 否 | 曲库歌曲 ID；`null` / 缺省表示自定义歌曲 |
| `song_name` | string | 是 | 歌曲名 |
| `artist_name` | string | 是 | 歌手 |
| `alt_title` | string | 否 | 次要歌名 |
| `full_title` | string | 否 | 歌曲全称 |
| `file_extension` | string | 否 | 文件扩展名 |
| `full_file_path` | string | 否 | 全曲文件路径 |
| `chorus_file_path` | string | 否 | 副歌文件路径 |
| `reference_url` | string | 否 | 参考链接 |
| `play_part` | number | 是 | `0`=全曲，`1`=副歌，`2`=自定义 |
| `custom_part_desc` | string | 否 | 自定义段落描述（`play_part=2` 时） |
| `sort_order` | number | 否 | 排序序号 |

**curl 示例**

```bash
curl -X POST http://localhost:3002/api/v1/submissions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "songs": [
      { "song_id": 8, "song_name": "Dynamite", "artist_name": "BTS", "play_part": 1, "sort_order": 1 },
      { "song_name": "自定义曲目", "artist_name": "佚名", "play_part": 2, "custom_part_desc": "副歌后 30 秒", "sort_order": 2 }
    ]
  }'
```

**响应体**（`data`）

```json
{ "id": 30 }
```

::: tip 防重复提交
与路演报名一致，投稿使用表单指纹 + `(user_id, session_id)` 唯一约束防重，重复提交返回已存在投稿 ID。
:::

::: tip 投稿流程：先选主办方 → 再选场次
与报名一致，前台投稿也按「先选主办方 → 再选该主办方名下场次」进行（[`GET /organizers`](/api/organizer) → [`GET /sessions?organizer_id=`](/api/session)）。**投稿提交体仍只传 `session_id`**，主办方归属由后端从场次 `organizer_id` 派生。
:::

### 我的投稿列表

<span class="m m-get">GET</span> `/submissions/mine` · <span class="acl acl-user">用户</span>

**查询参数**：`page`、`page_size`

```bash
curl "http://localhost:3002/api/v1/submissions/mine?page=1&page_size=10" \
  -H "Authorization: Bearer <token>"
```

**响应体**：`{ list: Submission[], total, page, page_size }`

### 投稿详情

<span class="m m-get">GET</span> `/submissions/:id` · <span class="acl acl-user">用户</span>

**路径参数**：`id` — 投稿 ID。**响应体**：`SubmissionDetail`（含歌曲列表）。

```bash
curl http://localhost:3002/api/v1/submissions/30 \
  -H "Authorization: Bearer <token>"
```

## 管理端接口

管理端前缀均为 `admin/submissions`，鉴权 <span class="acl acl-organizer">管理员 / 主办方</span>（`@Roles(ADMIN, ORGANIZER)`）。

::: warning 主办方数据范围
投稿的主办方归属由其 `session_id` 对应场次的 `organizer_id` 派生。超级管理员（`role = 1`）可见全部；主办方（`role = 2`）仅能访问名下场次的投稿：
> - **列表 / 统计** `GET /admin/submissions`、`GET /admin/submissions/statistics`：对主办方静默追加 `session.organizer_id = :organizerScopeId` 过滤；
> - **单条 / 按场次**入口（详情 `:id`、审核 `:id/status`、删除 `DELETE :id`、导出 `export`）越权 → `404 场次不存在`（不泄露存在性）；
> - **批量**入口（`POST batch` 批量审核、`DELETE batch` 批量删除）若 `ids` 中**含任一**非自身数据 → `403 无权操作其他主办方的数据`（fail closed，整批拒绝）。
>
> 完整语义与越权示例见 [主办方 · 数据隔离规则](/api/organizer)。
:::

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/submissions` | 投稿管理列表 | `page, page_size, status, session_id, keyword` |
| <span class="m m-get">GET</span> | `/admin/submissions/:id` | 投稿管理详情 | 返回 `SubmissionDetail` |
| <span class="m m-put">PUT</span> | `/admin/submissions/:id/status` | 审核投稿 | `{ status: "pending"\|"approved"\|"rejected", review_comment? }` → `{ id, status, review_comment }` |
| <span class="m m-post">POST</span> | `/admin/submissions/batch` | 批量审核 | `{ ids: number[], status, review_comment? }` → `{ affected }` |
| <span class="m m-delete">DELETE</span> | `/admin/submissions/:id` | 删除投稿 | → `{ id }` |
| <span class="m m-delete">DELETE</span> | `/admin/submissions/batch` | 批量删除 | `{ ids: number[] }` → `{ affected }` |
| <span class="m m-get">GET</span> | `/admin/submissions/export` | 导出 Excel | `session_id`（必填） |
| <span class="m m-get">GET</span> | `/admin/submissions/statistics` | 投稿统计 | `session_id?` |

### 投稿管理列表

<span class="m m-get">GET</span> `/admin/submissions` · <span class="acl acl-organizer">管理员 / 主办方</span>

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` / `page_size` | number | 否 | 分页，默认 `1` / `10` |
| `status` | string | 否 | `pending` / `approved` / `rejected` |
| `session_id` | number | 否 | 按场次筛选 |
| `keyword` | string | 否 | 按用户名 / 昵称 / 手机号模糊搜索 |

```bash
curl "http://localhost:3002/api/v1/admin/submissions?page=1&page_size=10&status=pending&session_id=1" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list, total, page, page_size }`。`list` 每项含 `id, user_id, user_nickname, username, user_phone, session_id, session_name, status, review_comment, song_count, custom_song_count, created_at, updated_at`。

### 投稿管理详情

<span class="m m-get">GET</span> `/admin/submissions/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

**路径参数**：`id` — 投稿 ID

```bash
curl http://localhost:3002/api/v1/admin/submissions/30 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`SubmissionDetail`，含投稿人信息、场次信息与按 `sort_order` 排序的 `songs[]`（每首含 `id, song_id, song_name, artist_name, alt_title, full_title, file_extension, reference_url, play_part, custom_part_desc, sort_order`）。投稿不存在返回 `404` `投稿不存在`。

### 审核投稿

<span class="m m-put">PUT</span> `/admin/submissions/:id/status` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 是 | `pending` / `approved` / `rejected` |
| `review_comment` | string | 否 | 审核意见，缺省置 `null` |

```bash
curl -X PUT http://localhost:3002/api/v1/admin/submissions/30/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "approved", "review_comment": "已采纳" }'
```

**响应体**：`{ id, status, review_comment }`

::: warning 审核状态白名单校验
`status` 只接受白名单取值 `pending` / `approved` / `rejected`（源自后端 `SubmissionStatus` 枚举）。传入其他值返回 `400`，`message` 为 `审核状态无效`。单条审核与下方批量审核均执行同一白名单校验。
:::

### 批量审核

<span class="m m-post">POST</span> `/admin/submissions/batch` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**：`{ ids: number[], status: string, review_comment?: string }`

```bash
curl -X POST http://localhost:3002/api/v1/admin/submissions/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [30, 31, 32], "status": "approved" }'
```

**响应体**：`{ "affected": 3 }`

::: warning `affected` 为数据库实际影响行数
`affected` 返回的是本次更新在数据库中**实际影响的行数**，而非请求 `ids` 的个数。若部分 id 因状态未变而未产生写入，`affected` 可能小于 `ids.length`，请以 `affected` 为准。
:::

::: warning 批量 `ids` 校验与权限
批量审核与批量删除共用以下 `ids` 校验规则：

| 情形 | HTTP | message |
|------|------|---------|
| `ids` 为空 / 非数组 / 不含合法正整数 | `400` | `请提供要操作的投稿 ID 列表` |
| `ids` 中含**不存在**的投稿 id | `400` | `部分投稿不存在`（不做静默忽略） |
| `ids` 中含**其他主办方**名下的投稿 | `403` | `无权操作其他主办方的数据`（fail closed，整批拒绝） |

其中主办方越权（`403`）语义见上方「主办方数据范围」提示框；`status` 同样受白名单校验，非法值返回 `400` `审核状态无效`。
:::

### 删除投稿

<span class="m m-delete">DELETE</span> `/admin/submissions/:id` · <span class="acl acl-organizer">管理员 / 主办方</span>

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/submissions/30 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "id": 30 }`

### 批量删除

<span class="m m-delete">DELETE</span> `/admin/submissions/batch` · <span class="acl acl-organizer">管理员 / 主办方</span>

**请求体**：`{ ids: number[] }`

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/submissions/batch \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [30, 31] }'
```

**响应体**：`{ "affected": 2 }`

::: warning `affected` 与 `ids` 校验
`affected` 为数据库**实际删除的行数**（非请求 `ids` 个数）。`ids` 校验与批量审核一致：为空 / 非数组 / 无合法正整数 → `400` `请提供要操作的投稿 ID 列表`；含不存在的 id → `400` `部分投稿不存在`；含其他主办方名下投稿 → `403` `无权操作其他主办方的数据`。
:::

### 导出投稿 Excel

<span class="m m-get">GET</span> `/admin/submissions/export` · <span class="acl acl-organizer">管理员 / 主办方</span>

**查询参数**：`session_id`（**必填**，缺省返回 `400` `请选择要导出的活动场次`）。返回 `.xlsx` 文件流（`Content-Disposition: attachment`），**非** `{code,message,data}` 包裹。详见 [数据导出](/api/export)。

```bash
curl "http://localhost:3002/api/v1/admin/submissions/export?session_id=1" \
  -H "Authorization: Bearer <admin_token>" -OJ
```

### 投稿统计

<span class="m m-get">GET</span> `/admin/submissions/statistics` · <span class="acl acl-organizer">管理员 / 主办方</span>

**查询参数**：`session_id`（可选，缺省统计全部）

**响应体**（`data`）

```json
{
  "hot_songs": [],
  "custom_songs": [],
  "session_stats": [],
  "total_submissions": 0
}
```

| 字段 | 说明 |
|------|------|
| `hot_songs` | 热门（曲库）歌曲统计 |
| `custom_songs` | 自定义歌曲统计 |
| `session_stats` | 按场次维度的统计 |
| `total_submissions` | 投稿总数 |

导出接口详见 [数据导出](/api/export)。

## 数据结构

### Submission 状态

`status` 为字符串枚举（后端 `SubmissionStatus`），合法取值域为：

| 取值 | 含义 |
|------|------|
| `pending` | 待审核（默认） |
| `approved` | 已通过 |
| `rejected` | 已驳回 |

审核（单条 `PUT /admin/submissions/:id/status` 与批量 `POST /admin/submissions/batch`）的 `status` 受白名单校验，传入不在上表内的值返回 `400` `审核状态无效`。

### SubmissionSong 播放段落

| play_part | 含义 |
|-----------|------|
| `0` | 全曲 |
| `1` | 副歌 |
| `2` | 自定义（配合 `custom_part_desc`） |
