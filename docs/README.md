# 随机舞蹈中文站开放平台 - 开发文档

## 文档索引

| 文档 | 说明 |
|------|------|
| [backend.md](./backend.md) | 后端开发文档 |
| [frontend.md](./frontend.md) | 前端开发文档 |
| [DEPLOYMENT_REPORT.md](./DEPLOYMENT_REPORT.md) | 部署报告 |

## 项目概述

随机舞蹈中文站开放平台是为线下随机舞蹈活动提供信息化管理的独立平台。

### 核心功能

- **路演报名**：用户提交路演表演报名（歌曲、组合、成员、联系方式），管理员审核
- **歌单投稿**：用户从曲库选择歌曲或添加自定义歌曲投稿，管理员审核与统计
- **场次管理**：管理员管理活动场次
- **用户系统**：本地注册/登录，JWT 鉴权，管理员/普通用户角色
- **数据导出**：路演报名和歌单投稿支持 Excel 导出

### 技术架构

```
用户/管理员 → Nginx → React SPA (admin-web/dist)
                   → NestJS API (backend, port 3002)
                   → FastAPI 音源服务 (外部代理)
                   → MySQL (chaojifather_me)
```

### 服务地址

| 服务 | 地址 |
|------|------|
| 前端 | http://chaojifather.me |
| API | http://chaojifather.me/api/v1 |
| FastAPI 音源 | 通过 /fa-api 代理 |
| 后端直连 | http://localhost:3002 |

## 数据库

- 数据库名：chaojifather_me
- 表由 TypeORM `synchronize: true` 自动创建
- 核心表：users, sessions, roadshow_registrations, registration_members, submissions, submission_songs, songs, system_logs, client_events, client_config
