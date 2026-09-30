# 数据导出

导出接口允许超级管理员和主办方调用；主办方只能导出自己名下场次的数据，越权场次返回 `404 场次不存在`。

管理端提供路演报名与歌单投稿的 Excel 导出，均为超级管理员或主办方接口。

::: tip 不走响应包裹
导出接口标注了 `@SkipResponseWrap()`，**不**返回 `{ code, message, data }` 包裹结构，而是直接返回 `.xlsx` 二进制流（`StreamableFile`）：

- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename*=UTF-8''<编码后的文件名>`

客户端应以文件下载方式处理响应，而非解析 JSON。
:::

## 导出路演报名

<span class="m m-get">GET</span> `/admin/roadshow/registrations/export` · 超级管理员 / 主办方

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | number | 是 | 要导出的场次 ID；缺失时返回 `400`「请选择要导出的活动场次」 |
| `status` | string | 否 | 按报名状态过滤 |

```bash
curl -X GET "http://localhost:3002/api/v1/admin/roadshow/registrations/export?session_id=1" \
  -H "Authorization: Bearer <admin_token>" \
  -o roadshow-registrations.xlsx
```

::: tip 导出顺序与选位
选位功能启用后，导出行顺序由报名的 `sort_order`（空值排后）再按 `id` 决定，并新增**中场分隔行**与**选位标签列**。未编排的场次 `sort_order` 全为 `null`，退化为原 `id` 顺序，向后兼容。导出坚持代码式构建表头，不依赖任何 `.xlsx` 模板资产。
:::

## 导出歌单投稿

<span class="m m-get">GET</span> `/admin/submissions/export` · 超级管理员 / 主办方

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `session_id` | number | 是 | 要导出的场次 ID；缺失时返回 `400`「请选择要导出的活动场次」 |

```bash
curl -X GET "http://localhost:3002/api/v1/admin/submissions/export?session_id=1" \
  -H "Authorization: Bearer <admin_token>" \
  -o submissions.xlsx
```

## 错误处理

导出接口在参数缺失或场次无数据时，仍会抛出 `HttpException`（如 `400`），此时返回的是标准 `{ code, message, data }` 错误结构而非文件流。客户端应先判断响应的 `Content-Type`：

- 为 `application/vnd...sheet` → 保存为文件；
- 为 `application/json` → 按 [错误码约定](/api/errors) 处理。

## 相关接口

- 报名管理列表与字段：[路演报名](/api/roadshow-registration)
- 投稿管理列表与统计：[歌单投稿](/api/submission)
- 编排顺序来源：[路演选位](/api/roadshow-position)
