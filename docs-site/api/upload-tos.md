# 上传 / TOS 对象存储 · 新增

平台提供两套上传能力：

1. **通用上传** `POST /upload`：小文件音频直接上传（`multipart/form-data`）。未启用对象存储时回退写入本地磁盘 `backend/uploads/`，返回 `/uploads/<filename>`；启用后委托对象存储服务上传，返回体结构 `{ url, filename, originalname }` 保持不变。
2. **路演素材直传 / 本地回退**：音频 / 审核视频先申请上传方式，响应中的 `mode` 决定后续流程——`direct` 走「预签名 PUT 直传 TOS → 完成确认」三步；`local` 走后端 multipart 端点 `POST /roadshow/registrations/:id/media/:type` 中转落盘。

::: warning 接口状态
上传改造与对象存储由后端并行实现。素材直传路由挂在用户报名控制器 `roadshow/registrations` 下，管理端配置在 `admin/object-storage`。是否回退本地由对象存储配置的 `enabled` 决定，两条上传通道的回退行为不同，详见下文「存储模式与回退」。
:::

## 存储模式与回退

对象存储是否启用由管理端配置 `enabled` 决定。**两条上传通道的回退行为不同**，请勿混为一谈：

| 通道 | `enabled = false`（未配置 / 默认） | `enabled = true` 且配置有效 |
|------|-----------------------------------|------------------------------|
| `POST /upload`（通用上传） | 回退写入本地磁盘 `backend/uploads/`，`url` 为 `/uploads/<filename>` | 委托对象存储服务上传到 `roadshow-audio` 目录，`url` 为对象 URL；返回体结构不变 |
| 路演素材 `.../media/:type/upload-url` | 响应 `mode = "local"`，改走后端 multipart 端点 `POST /roadshow/registrations/:id/media/:type` 中转落盘 | 响应 `mode = "direct"`，走预签名 PUT 直传 + `complete` 三步流程 |

::: warning 回退不是「所有接口自动切本地」
`POST /upload` 未启用对象存储时确实回退本地磁盘；但**路演素材直传**并非自动改用本地路径，而是通过 `upload-url` 响应中的 `mode` 字段显式告知客户端走 `direct`（预签名直传）还是 `local`（后端 multipart 中转）。客户端必须先读 `mode` 再决定上传方式。
:::

---

## 对象存储未启用时审核视频上传被禁用

::: danger 审核视频（`review-video`）门禁
当对象存储（TOS）**未启用**（`enabled = false`）时，为避免占用服务器本地空间，**审核视频上传一律被禁用**。以下三个端点在 `type = review-video` 时**一律返回 `403`**，`message` 固定为 `对象存储未启用，暂不支持上传审核视频`：
>
> | 方法 | 路径 |
> |------|------|
> | <span class="m m-post">POST</span> | `/roadshow/registrations/:id/media/review-video/upload-url` |
> | <span class="m m-post">POST</span> | `/roadshow/registrations/:id/media/review-video/complete` |
> | <span class="m m-post">POST</span> | `/roadshow/registrations/:id/media/review-video`（本地 multipart 回退） |
>
> 该门禁先于本地回退的反向判定执行，因此无论走直传还是本地回退，未启用对象存储时审核视频都会被 `403` 拦截。
:::

::: tip 音频上传完全不受影响
上述门禁**仅对 `type = review-video` 生效**。`type = audio` 的审核音频与通用音频端点 `POST /upload` 行为**完全不变**：未启用对象存储时，音频仍可通过 `mode = "local"` 回退本地磁盘正常上传（`url` 为 `/uploads/<filename>`）。
:::

客户端可通过 [`GET /roadshow/registrations/:id/media`](#查询媒体状态) 返回体**顶层**的 `video_upload_enabled: boolean` 字段（= 对象存储 `isEnabled()`）预判审核视频上传是否开放：为 `false` 时应隐藏审核视频上传入口。

**视频被禁用时的响应示例**

```bash
curl -X POST http://localhost:3002/api/v1/roadshow/registrations/12/media/review-video/upload-url \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "file_name": "review.mp4", "content_type": "video/mp4", "file_size": 10485760 }'
```

```json
{ "code": 403, "message": "对象存储未启用，暂不支持上传审核视频", "data": null }
```

---

## 一、通用上传

<span class="m m-post">POST</span> `/upload` · <span class="acl acl-user">用户</span>

`multipart/form-data` 上传单个**音频**文件，字段名为 `file`。上限 **100MB**。仅接受音频扩展名 `.mp3` `.m4a` `.wav` `.flac` `.aac` `.ogg`，其他格式返回 `400` `仅支持 mp3, m4a, wav, flac, aac, ogg 格式`。

**请求**

| 部分 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | binary | 是 | 音频文件（`multipart/form-data`） |
| `sessionId` | number | 否 | 关联场次 ID，用于对象存储目录归类 |

```bash
curl -X POST http://localhost:3002/api/v1/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/audio.mp3" \
  -F "sessionId=1"
```

**响应体**（`data`）

```json
{
  "url": "/uploads/1730000000000-123456789.mp3",
  "filename": "1730000000000-123456789.mp3",
  "originalname": "audio.mp3"
}
```

| 字段 | 说明 |
|------|------|
| `url` | 可访问地址。本地模式为 `/uploads/<filename>`；TOS 模式为对象公开 URL |
| `filename` | 服务端存储文件名 |
| `originalname` | 客户端原始文件名 |

未启用对象存储时，文件写入本地磁盘 `backend/uploads/`，`url` 形如 `/uploads/<filename>`；启用后内部改用内存缓冲并委托对象存储服务上传到 `roadshow-audio` 目录，返回体结构不变。

---

## 二、路演素材上传（直传 / 本地回退）

用于上传较大的**音频**（`audio`，上限 30MB）与**审核视频**（`review-video`，上限 1GB）。第 ① 步申请上传方式后，按响应中的 `mode` 分流：

- `mode = "direct"`：客户端直连 TOS，走「预签名 PUT → 完成确认」三步流程，不受后端 SDK 超时限制。
- `mode = "local"`：对象存储未启用，改走后端 multipart 端点 `POST /roadshow/registrations/:id/media/:type` 中转落盘（见本节末「本地回退上传」）。

媒体类型 `:type` 仅支持 `audio` 与 `review-video`，其他值返回 `400`。

**允许的文件格式**

| 类型 | 扩展名 | Content-Type 前缀 |
|------|--------|-------------------|
| `audio` | `.mp3` `.m4a` `.wav` `.flac` `.aac` `.ogg` | `audio/` |
| `review-video` | `.mp4` `.mov` `.m4v` `.webm` | `video/` |

### 直传三步流程（`mode = "direct"`）

```
① POST :id/media/:type/upload-url   → 读 mode；direct 时拿到预签名 PUT URL 与 object_key
② PUT  <upload_url>                  → 客户端直传文件到 TOS（带 Content-Type 头）
③ POST :id/media/:type/complete      → 服务端 HeadObject 复核大小/目录并落库
```

### 第 ① 步：申请直传 URL

<span class="m m-post">POST</span> `/roadshow/registrations/:id/media/:type/upload-url` · <span class="acl acl-user">用户</span>

**路径参数**：`id` — 报名 ID；`type` — `audio` 或 `review-video`

**请求体**

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `file_name` | string | 是 | ≤ 255，扩展名须在允许列表内 |
| `content_type` | string | 是 | ≤ 128，须匹配类型前缀（`audio/*` 或 `video/*`） |
| `file_size` | number | 是 | ≥ 1，且不超过该类型上限 |

```bash
curl -X POST http://localhost:3002/api/v1/roadshow/registrations/12/media/audio/upload-url \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "file_name": "dynamite-edit.mp3",
    "content_type": "audio/mpeg",
    "file_size": 8388608
  }'
```

**响应体**（`data`）

```json
{
  "mode": "direct",
  "method": "PUT",
  "upload_url": "https://<bucket>.tos-cn-beijing.volces.com/<key>?X-Tos-Algorithm=...&X-Tos-Signature=...",
  "object_key": "roadshow/roadshow/sessions/1/audio/dynamite-edit_a1b2c3d4.mp3",
  "headers": { "Content-Type": "audio/mpeg" },
  "expires_in": 1800,
  "max_size": 31457280
}
```

| 字段 | 说明 |
|------|------|
| `mode` | 上传方式：`direct`（预签名直传 TOS）/ `local`（后端 multipart 中转落盘）。为 `local` 时响应**仅** `{ mode: "local", max_size }`，不含 `upload_url` / `object_key` 等直传字段，客户端应改调用下方「本地回退上传」端点 |
| `method` | 直传方法，固定 `PUT`（仅 `direct`） |
| `upload_url` | 预签名直传 URL，有效期 30 分钟（`expires_in` 秒）（仅 `direct`） |
| `object_key` | 对象键，第 ③ 步完成确认时须回传（仅 `direct`） |
| `headers` | 直传时**必须原样携带**的请求头（当前为 `Content-Type`）（仅 `direct`） |
| `expires_in` | URL 有效期（秒），`1800` = 30 分钟（仅 `direct`） |
| `max_size` | 该类型允许的最大字节数 |

### 第 ② 步：客户端直传

使用第 ① 步返回的 `upload_url` 与 `headers`，以 `PUT` 直接把文件体上传到 TOS（不经过后端）：

```bash
curl -X PUT "<upload_url>" \
  -H "Content-Type: audio/mpeg" \
  --data-binary "@/path/to/dynamite-edit.mp3"
```

前端建议使用 XHR 以获取上传进度（`xhr.upload.onprogress`）。

::: danger 直传依赖桶侧 CORS
浏览器直传（跨域 PUT）要求 TOS 桶已正确配置 CORS，否则会被浏览器拦截。配置方法见本页末尾 [TOS 桶 CORS 配置指引](#tos-桶-cors-配置指引)。
:::

### 第 ③ 步：完成确认

<span class="m m-post">POST</span> `/roadshow/registrations/:id/media/:type/complete` · <span class="acl acl-user">用户</span>

服务端通过 `HeadObject` 复核对象是否存在、大小是否合规、目录是否匹配，然后写入报名记录（音频写 `edited_file_url` 并置 `audio_enabled`、`song_format=1`；审核视频写 `review_video_url` 并置 `review_video_submitted`、`review_video_enabled`）。旧对象在替换成功后异步清理（清理失败仅告警，不阻断）。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `object_key` | string | 是 | 第 ① 步返回的 `object_key`，≤ 1024 |

```bash
curl -X POST http://localhost:3002/api/v1/roadshow/registrations/12/media/audio/complete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "object_key": "roadshow/roadshow/sessions/1/audio/dynamite-edit_a1b2c3d4.mp3" }'
```

**响应体**：返回该报名最新的媒体状态（结构同下方「查询媒体状态」）。

### 本地回退上传（`mode = "local"`）

<span class="m m-post">POST</span> `/roadshow/registrations/:id/media/:type` · <span class="acl acl-user">用户</span>

当第 ① 步返回 `mode = "local"`（对象存储未启用）时，改用该 multipart 端点由后端中转落盘，**无需**预签名 PUT 与 `complete` 两步。

**路径参数**：`id` — 报名 ID；`type` — `audio` 或 `review-video`

**请求**

| 部分 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | binary | 是 | 素材文件；`audio` ≤ 30MB，`review-video` ≤ 1GB，扩展名 / Content-Type 须匹配类型 |

```bash
curl -X POST http://localhost:3002/api/v1/roadshow/registrations/12/media/audio \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/dynamite-edit.mp3"
```

**响应体**：返回该报名最新的媒体状态（结构同下方「查询媒体状态」）；本地模式下 `url` 为 `/uploads/<filename>` 路径，`access_url` 原样返回该本地路径（`availability = unmanaged`）。

### 查询媒体状态

<span class="m m-get">GET</span> `/roadshow/registrations/:id/media` · <span class="acl acl-user">用户</span>

**响应体**（`data`）

```json
{
  "registration_id": 12,
  "video_upload_enabled": false,
  "audio": {
    "uploaded": true,
    "enabled": true,
    "status": "submitted",
    "url": "roadshow/roadshow/sessions/1/audio/dynamite-edit_a1b2c3d4.mp3",
    "access_url": "https://<bucket>.tos-.../<key>?X-Tos-Signature=...",
    "availability": "available",
    "max_size": 31457280
  },
  "review_video": {
    "uploaded": false,
    "enabled": false,
    "status": "not_submitted",
    "url": null,
    "access_url": null,
    "availability": null,
    "max_size": 1073741824
  }
}
```

| 字段 | 说明 |
|------|------|
| `registration_id` | 报名 ID |
| `video_upload_enabled` | **顶层字段**，= 对象存储 `isEnabled()`。为 `false` 时审核视频上传三端点均返回 `403`（见「对象存储未启用时审核视频上传被禁用」）；音频不受影响 |
| `uploaded` | 是否已上传 |
| `enabled` | 是否启用该素材 |
| `status` | `not_submitted`（未启用）/ `approved_without_upload`（已启用未上传）/ `submitted`（已提交） |
| `url` | 存储的原始 URL / 对象键 |
| `access_url` | **私有读签名 URL**（有效期 60 分钟），用于访问私有对象；本地 `/uploads/` 路径原样返回 |
| `availability` | `available`（可读）/ `missing`（对象缺失）/ `unmanaged`（非托管，如本地或外链） |
| `max_size` | 该类型上限字节数 |

::: tip 私有读签名（60 分钟有效）
TOS 私有桶对象不能直接公开访问。`access_url` 是后端用 HMAC 预签名生成的临时可读 URL，**有效期 60 分钟**，客户端应使用它播放 / 下载素材，过期后需重新拉取。`unmanaged` 表示该 URL 非对象存储托管（如 `/uploads/` 本地文件或外部 http(s) 链接），此时直接使用 `url`。**管理端「报名详情」与「导出」返回的素材 `access_url` 同为私有读签名，同样 60 分钟有效。**
:::

---

## 三、管理端对象存储配置

管理端前缀 `admin/object-storage`，鉴权 <span class="acl acl-admin">管理员</span>。

| 方法 | 路径 | 说明 |
|------|------|------|
| <span class="m m-get">GET</span> | `/admin/object-storage` | 获取当前配置（Secret 以密文 / 掩码返回，不明文回显；含 `secretUnreadable` 标记） |
| <span class="m m-put">PUT</span> | `/admin/object-storage` | 更新配置 |
| <span class="m m-post">POST</span> | `/admin/object-storage/test` | 连接测试（`headBucket`） |
| <span class="m m-get">GET</span> | `/admin/object-storage/access?url=<url>` | 为指定对象生成私有读签名（返回 `{ accessUrl, availability }`） |

::: warning secretUnreadable（密钥不可解密）
`GET /admin/object-storage` 返回体含 `secretUnreadable: boolean`。为 `true` 时表示已存的 AccessKeySecret 因**配置加密密钥变化**（如轮换 `JWT_SECRET` 且未显式设置 `OBJECT_STORAGE_CONFIG_ENCRYPTION_KEY`）而无法解密，此时 `hasAccessKeySecret` 为 `false`，需在更新配置时**重新填写** `accessKeySecret`。详见 [快速开始 · 环境变量](/guide/getting-started)。
:::

### 更新配置

<span class="m m-put">PUT</span> `/admin/object-storage` · <span class="acl acl-admin">管理员</span>

**请求体**

| 字段 | 类型 | 必填 | 约束 / 说明 |
|------|------|------|------|
| `enabled` | boolean | 是 | 是否启用对象存储 |
| `accessKeyId` | string | 是 | ≤ 128，TOS AccessKeyId |
| `accessKeySecret` | string | 否 | ≤ 256，TOS AccessKeySecret（不传表示保持不变；AES-256-GCM 加密存储） |
| `region` | string | 是 | 如 `cn-beijing`，格式 `^[a-z]{2,8}-[a-z0-9-]{2,50}$` |
| `endpoint` | string | 是 | TOS 访问域名，如 `tos-cn-beijing.volces.com` |
| `bucket` | string | 是 | 桶名，3–63 位小写字母 / 数字 / 中划线 |
| `publicBaseUrl` | string | 否 | 完整 HTTP(S) 访问域名（用于公开读 URL 拼接） |
| `keyPrefix` | string | 是 | 对象根前缀（可为空串），仅字母 / 数字 / `/` / `-` / `_` |
| `roadshowMediaNameTemplate` | string | 否 | 直传对象名模板，≤ 255 |

```bash
curl -X PUT http://localhost:3002/api/v1/admin/object-storage \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "accessKeyId": "AKLTxxxx",
    "accessKeySecret": "your-secret",
    "region": "cn-beijing",
    "endpoint": "tos-cn-beijing.volces.com",
    "bucket": "chaojifather-media",
    "keyPrefix": "roadshow",
    "publicBaseUrl": "https://media.chaojifather.me"
  }'
```

### 连接测试

<span class="m m-post">POST</span> `/admin/object-storage/test` · <span class="acl acl-admin">管理员</span>

对当前配置执行 `headBucket` 探测桶可达性与凭证有效性，返回测试结果。建议保存配置后立即调用验证。

```bash
curl -X POST http://localhost:3002/api/v1/admin/object-storage/test \
  -H "Authorization: Bearer <admin_token>"
```

### 生成私有读签名

<span class="m m-get">GET</span> `/admin/object-storage/access` · <span class="acl acl-admin">管理员</span>

**查询参数**：`url` — 对象 URL 或对象键

**响应体**：`{ accessUrl, availability }`。当对象为非托管的 http(s) 外链时，`accessUrl` 原样返回该 URL。

::: warning SDK 代理坑
对象存储配置服务内部强制 `client.axiosInst.defaults.proxy = false`，以修复宿主 HTTP/HTTPS 代理导致 TOS SDK 报 `Protocol "http:" not supported` 的问题。此为必须保留的实现细节。
:::

---

## 四、编排素材下载清单

<span class="m m-post">POST</span> `/admin/roadshow/registrations/media-download-manifest` · <span class="acl acl-admin">管理员</span>

编排完成后，批量获取各报名的音频 / 审核视频**签名下载地址清单**，供管理员打包下载。返回的每个 `download_url` 均为私有读签名 URL（60 分钟有效）。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ids` | number[] | 是 | 要下载的报名 ID 列表；为空 / 缺省返回 `400` `请提供要下载的报名 ID 列表` |
| `media_types` | string[] | 否 | 素材类型过滤，取值 `audio` / `review-video`；缺省表示全部类型 |

```bash
curl -X POST http://localhost:3002/api/v1/admin/roadshow/registrations/media-download-manifest \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "ids": [12, 13, 14], "media_types": ["audio", "review-video"] }'
```

**响应体**（`data`）

```json
{
  "items": [
    {
      "registration_id": 12,
      "media_type": "audio",
      "group_order": 1,
      "filename": "dynamite-edit_a1b2c3d4.mp3",
      "download_url": "https://<bucket>.tos-.../<key>?X-Tos-Signature=..."
    }
  ],
  "unavailable": [
    { "registration_id": 13, "media_type": "review-video", "reason": "missing" }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `items[].registration_id` | 报名 ID |
| `items[].media_type` | 素材类型：`audio` / `review-video` |
| `items[].group_order` | 编排后的演出顺序（`sort_order`） |
| `items[].filename` | 建议下载文件名 |
| `items[].download_url` | 私有读签名下载地址（60 分钟有效） |
| `unavailable[].reason` | 不可下载原因：`missing`（对象缺失）/ `unmanaged`（非托管，如本地或外链） |

---

## TOS 桶 CORS 配置指引

**预签名直传（浏览器 `PUT`）依赖桶侧 CORS 放行**，否则跨域请求会被浏览器拦截。请在火山引擎 TOS 控制台为对应桶添加跨域规则：

| 配置项 | 建议值 | 说明 |
|--------|--------|------|
| **允许来源（AllowedOrigin）** | 前端站点域名，如 `https://chaojifather.me`；调试期可临时用 `*` | 精确到协议 + 域名（+ 端口），生产**不建议**长期用 `*` |
| **允许方法（AllowedMethod）** | `GET`、`HEAD`、`PUT` | `PUT` 用于直传，`GET`/`HEAD` 用于私有读签名访问与 `HeadObject` 复核 |
| **允许头（AllowedHeader）** | `*`（或至少 `Content-Type`、`Authorization`、`Content-Length`、`x-tos-*`） | 直传需携带 `Content-Type`；预签名相关头以 `x-tos-` 开头 |
| **暴露头（ExposeHeader）** | `ETag`、`Content-Length`、`x-tos-request-id` | 便于前端读取上传结果与排障 |
| **最大存活时间（MaxAgeSeconds）** | `600` 或更长 | 预检（OPTIONS）结果缓存时间，减少预检请求 |

**控制台配置路径**：TOS 控制台 → 选择桶 → 权限管理 / 数据安全 → 跨域访问 CORS → 添加规则。

对应的 CORS XML（若通过 API / 工具配置）示例：

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://chaojifather.me</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>x-tos-request-id</ExposeHeader>
    <MaxAgeSeconds>600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

::: tip 权限与生命周期
- 私有桶需保证签名账号具备 `HeadObject` 权限，完成确认（第 ③ 步）依赖它复核对象。
- 可为素材目录配置生命周期规则，自动清理过期的未完成直传分片 / 临时对象。
- 若仅需公开读，可配置 `publicBaseUrl` 并使用公开读 URL；否则统一走私有读签名（`access_url`）。
:::

## 相关接口

- 报名与媒体字段：[路演报名](/api/roadshow-registration)
- 编排后的素材批量下载：本页「四、编排素材下载清单」（`POST /admin/roadshow/registrations/media-download-manifest`）
- 编排顺序与 Excel 导出：[数据导出](/api/export)
