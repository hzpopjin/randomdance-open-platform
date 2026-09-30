# 歌曲库

歌曲库（Song）为投稿提供曲库来源，全部为管理端接口，前缀 `admin/songs`，鉴权 <span class="acl acl-admin">管理员</span>。

## 接口列表

| 方法 | 路径 | 说明 | 查询 / 请求体 |
|------|------|------|------|
| <span class="m m-get">GET</span> | `/admin/songs` | 歌曲库列表 | `page, page_size, keyword, status` |
| <span class="m m-get">GET</span> | `/admin/songs/pending` | 待审核歌曲 | `page, page_size` |
| <span class="m m-post">POST</span> | `/admin/songs` | 添加歌曲 | `{ song_name, artist_name, alt_title?, remark? }` |
| <span class="m m-put">PUT</span> | `/admin/songs/:id` | 更新歌曲 | `Partial<Song>` |
| <span class="m m-put">PUT</span> | `/admin/songs/:id/status` | 更新歌曲状态 | `{ status: number }` → `{ id, status }` |
| <span class="m m-delete">DELETE</span> | `/admin/songs/:id` | 删除歌曲 | → `{ id }` |

## 歌曲库列表

<span class="m m-get">GET</span> `/admin/songs` · <span class="acl acl-admin">管理员</span>

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 页码，默认 `1` |
| `page_size` | number | 否 | 每页条数，默认 `10` |
| `keyword` | string | 否 | 按 `song_name` / `artist_name` / `alt_title` 模糊搜索 |
| `status` | number | 否 | 按状态筛选（如 `0` 待审核） |

```bash
curl "http://localhost:3002/api/v1/admin/songs?page=1&page_size=10&keyword=Dynamite" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list: Song[], total, page, page_size }`，按 `created_at` 倒序。

## 待审核歌曲

<span class="m m-get">GET</span> `/admin/songs/pending` · <span class="acl acl-admin">管理员</span>

固定返回 `status = 0`（待审核）的歌曲，按 `created_at` 倒序。

**查询参数**：`page`（默认 `1`）、`page_size`（默认 `10`）

```bash
curl "http://localhost:3002/api/v1/admin/songs/pending?page=1&page_size=10" \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**（`data`）：`{ list: Song[], total, page, page_size }`

## 添加歌曲

<span class="m m-post">POST</span> `/admin/songs` · <span class="acl acl-admin">管理员</span>

```bash
curl -X POST http://localhost:3002/api/v1/admin/songs \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "song_name": "Dynamite", "artist_name": "BTS", "alt_title": "炸药", "remark": "热门" }'
```

**响应体**：`Song` 对象。

## 更新歌曲

<span class="m m-put">PUT</span> `/admin/songs/:id` · <span class="acl acl-admin">管理员</span>

**路径参数**：`id` — 歌曲 ID

**请求体**：`Partial<Song>`，仅传需更新字段（如 `song_name` / `artist_name` / `alt_title` / `remark` / `status`）。

```bash
curl -X PUT http://localhost:3002/api/v1/admin/songs/8 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "alt_title": "炸药（Deluxe）", "remark": "已校对" }'
```

**响应体**：更新后的 `Song` 对象。歌曲不存在时返回 `404` `歌曲不存在`。

## 更新歌曲状态

<span class="m m-put">PUT</span> `/admin/songs/:id/status` · <span class="acl acl-admin">管理员</span>

```bash
curl -X PUT http://localhost:3002/api/v1/admin/songs/8/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "status": 1 }'
```

## 删除歌曲

<span class="m m-delete">DELETE</span> `/admin/songs/:id` · <span class="acl acl-admin">管理员</span>

**路径参数**：`id` — 歌曲 ID

```bash
curl -X DELETE http://localhost:3002/api/v1/admin/songs/8 \
  -H "Authorization: Bearer <admin_token>"
```

**响应体**：`{ "id": 8 }`。歌曲不存在时返回 `404` `歌曲不存在`。

## 数据结构

### Song 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 歌曲 ID |
| `song_name` | string | 歌曲名，≤ 256 |
| `artist_name` | string | 歌手，≤ 128 |
| `alt_title` | string \| null | 次要歌名，≤ 256 |
| `remark` | text \| null | 备注 |
| `status` | number | 状态（tinyint，默认 `0`；`0` 待审核 / 其他为已通过等，以业务约定为准） |
| `user_id` | number \| null | 提交用户 ID（用户新增自定义歌曲时记录） |

## 相关接口

- 用户投稿时引用曲库歌曲：[歌单投稿](/api/submission)
- 外部音源检索与播放：见 [API 约定 · 音源服务](/api/overview#音源服务-fastapi-代理)
