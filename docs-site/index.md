---
layout: home

hero:
  name: 开放平台
  text: 文档中心
  tagline: 随机舞蹈中文站 · 面向第三方主办方的路演报名 / 选位 / 歌单投稿 API
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: API 参考
      link: /api/overview
    - theme: alt
      text: 鉴权机制
      link: /guide/authentication

features:
  - icon: 🎫
    title: 路演报名
    details: 用户提交表演曲目、成员与联系方式；管理员审核、批量处理并导出 Excel。
    link: /api/roadshow-registration
  - icon: 🎯
    title: 路演选位 · 新增
    details: 场次开放选位通道后，用户实时抢位、幂等取消；管理端可视化编排顺序与位次。
    link: /api/roadshow-position
  - icon: 🎵
    title: 歌单投稿
    details: 从曲库选曲或自定义投稿，支持播放段落、参考链接、审核统计与导出。
    link: /api/submission
  - icon: 📅
    title: 场次管理
    details: 创建、编辑、取消、恢复、删除活动场次，并配置路演选位参数。
    link: /api/session
  - icon: 🗄️
    title: 上传 / TOS 对象存储 · 新增
    details: 本地磁盘与火山 TOS 自动切换，预签名直传三步流程、私有读签名与桶侧 CORS 指引。
    link: /api/upload-tos
  - icon: 🔐
    title: 本地 JWT 鉴权
    details: 用户名/密码注册登录换取 Bearer Token，角色分普通用户与管理员。
    link: /guide/authentication
---

<div class="vp-doc" style="max-width: 720px; margin: 48px auto 0; padding: 0 24px;">

## 关于本文档

本站是**随机舞蹈中文站开放平台**的独立静态文档中心，无需登录、可 CDN 缓存，面向需要对接平台 API 的第三方开发者与主办方。

- **基础路径**：所有接口以 `/api/v1` 为前缀（详见 [API 约定](/api/overview)）。
- **契约来源**：文档内容以平台真实后端 `controller` 实现为唯一事实来源。
- **响应包裹**：统一为 `{ code, message, data }` 结构，成功时 `code = 0`（详见 [错误码约定](/api/errors)）。

::: warning 选位与对象存储接口
「路演选位」与「上传 / TOS 对象存储」相关接口由后端并行实现，路由前缀以本文档标注为准，
其中用户选位面板的真实前缀为 `roadshow/registrations/:id/position(s)`。
:::

</div>
