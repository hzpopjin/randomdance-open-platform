# 后端开发文档

## 技术栈

NestJS 11 + TypeORM + MySQL + JWT (passport-jwt) + bcryptjs

## API 端点清单

> 基础路径：`/api/v1`

### 认证模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/auth/register` | 注册新用户 | 无 |
| POST | `/auth/login` | 用户名密码登录 | 无 |
| GET | `/auth/profile` | 获取当前用户信息 | 需要 |
| PATCH | `/auth/profile` | 更新个人信息 | 需要 |
| POST | `/admin/login` | 管理员登录（同 /auth/login） | 无 |
| GET | `/admin/profile` | 获取管理员信息 | 管理员 |
| PATCH | `/admin/profile` | 更新管理员信息 | 管理员 |

### 场次模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/sessions` | 公开场次列表 | 无 |
| GET | `/sessions/:id` | 场次详情 | 无 |
| GET | `/admin/sessions` | 场次管理列表 | 管理员 |
| POST | `/admin/sessions` | 创建场次 | 管理员 |
| PUT | `/admin/sessions/:id` | 更新场次 | 管理员 |
| PUT | `/admin/sessions/:id/cancel` | 取消场次 | 管理员 |
| PUT | `/admin/sessions/:id/restore` | 恢复场次 | 管理员 |
| DELETE | `/admin/sessions/:id` | 删除场次（无关联数据时） | 管理员 |

### 路演报名模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/roadshow/registrations` | 提交报名 | 需要 |
| GET | `/roadshow/registrations/mine` | 我的报名列表 | 需要 |
| GET | `/roadshow/registrations/:id` | 报名详情 | 需要 |
| GET | `/admin/roadshow/registrations` | 报名管理列表 | 管理员 |
| GET | `/admin/roadshow/registrations/:id` | 报名管理详情 | 管理员 |
| PUT | `/admin/roadshow/registrations/:id/status` | 审核报名 | 管理员 |
| POST | `/admin/roadshow/registrations/batch` | 批量审核 | 管理员 |
| DELETE | `/admin/roadshow/registrations/:id` | 删除报名 | 管理员 |
| DELETE | `/admin/roadshow/registrations/batch` | 批量删除 | 管理员 |
| GET | `/admin/roadshow/registrations/export` | 导出 Excel | 管理员 |

### 歌单投稿模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/submissions` | 提交投稿 | 需要 |
| GET | `/submissions/mine` | 我的投稿列表 | 需要 |
| GET | `/submissions/:id` | 投稿详情 | 需要 |
| GET | `/admin/submissions` | 投稿管理列表 | 管理员 |
| GET | `/admin/submissions/:id` | 投稿管理详情 | 管理员 |
| PUT | `/admin/submissions/:id/status` | 审核投稿 | 管理员 |
| POST | `/admin/submissions/batch` | 批量审核 | 管理员 |
| DELETE | `/admin/submissions/:id` | 删除投稿 | 管理员 |
| DELETE | `/admin/submissions/batch` | 批量删除 | 管理员 |
| GET | `/admin/submissions/export` | 导出 Excel | 管理员 |
| GET | `/admin/submissions/statistics` | 投稿统计 | 管理员 |

### 歌曲模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/admin/songs` | 歌曲库列表 | 管理员 |
| GET | `/admin/songs/pending` | 待审核歌曲 | 管理员 |
| POST | `/admin/songs` | 添加歌曲 | 管理员 |
| PUT | `/admin/songs/:id` | 更新歌曲 | 管理员 |
| PUT | `/admin/songs/:id/status` | 更新歌曲状态 | 管理员 |
| DELETE | `/admin/songs/:id` | 删除歌曲 | 管理员 |

### 其他模块

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/admin/dashboard` | 仪表盘统计 | 管理员 |
| GET | `/admin/users` | 用户列表 | 管理员 |
| PUT | `/admin/users/:id/role` | 修改用户角色 | 管理员 |
| POST | `/upload` | 文件上传 | 需要 |
| POST | `/client-events` | 客户端事件上报 | 无 |
| GET | `/admin/client-events` | 事件日志列表 | 管理员 |
| GET | `/admin/system-logs` | 系统日志列表 | 管理员 |
| GET | `/client-config/:key` | 获取云端配置 | 无 |
| GET | `/admin/client-config` | 配置列表 | 管理员 |
| PUT | `/admin/client-config` | 设置配置 | 管理员 |

## 数据库表结构

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK AUTO_INCREMENT | 用户 ID (UID) |
| username | VARCHAR(64) UNIQUE | 用户名 |
| password | VARCHAR(128) | bcrypt 哈希密码 |
| nickname | VARCHAR(64) | 昵称 |
| phone | VARCHAR(20) | 手机号 |
| email | VARCHAR(128) | 邮箱 |
| avatar_url | VARCHAR(512) | 头像 |
| role | TINYINT | 0=普通用户, 1=管理员 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### sessions
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 场次 ID |
| name | VARCHAR(128) | 场次名称 |
| event_date | DATETIME | 活动日期 |
| location | VARCHAR(256) | 地点 |
| registration_start | DATETIME NULL | 报名开始 |
| registration_end | DATETIME NULL | 报名结束 |
| venue_info | TEXT NULL | 场地信息 |
| is_cancelled | BOOLEAN | 是否取消 |
| cancelled_at | DATETIME NULL | 取消时间 |

### roadshow_registrations
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 报名 ID |
| user_id | INT FK | 用户 ID |
| session_id | INT FK | 场次 ID |
| song_name | VARCHAR(256) | 表演歌曲 |
| artist_name | VARCHAR(128) | 歌手 |
| group_name | VARCHAR(128) | 组合名 |
| song_format | TINYINT | 0=原版, 1=自己剪辑 |
| edited_file_url | VARCHAR(512) | 剪辑链接 |
| contact_phone | VARCHAR(20) | 联系方式 |
| has_other_performance | TINYINT | 是否有其他表演 |
| other_performance_detail | VARCHAR(512) | 其他表演说明 |
| additional_requirements | TEXT | 更多需求 |
| status | TINYINT | 0=待审核, 1=已通过, 2=已驳回 |
| review_comment | VARCHAR(512) | 审核备注 |
| device_info | TEXT | 设备信息 JSON |
| form_fingerprint | VARCHAR(64) | 表单指纹（防重复提交） |

### submissions
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 投稿 ID |
| user_id | INT FK | 用户 ID |
| session_id | INT FK | 场次 ID |
| status | VARCHAR(20) | pending/approved/rejected |
| review_comment | VARCHAR(512) | 审核备注 |
| device_info | TEXT | 设备信息 JSON |
| form_fingerprint | VARCHAR(64) | 表单指纹 |

### submission_songs
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PK | 关联 ID |
| submission_id | INT FK | 投稿 ID |
| song_id | INT NULL | 曲库歌曲 ID (NULL=自定义) |
| song_name | VARCHAR(256) | 歌曲名 |
| artist_name | VARCHAR(128) | 歌手 |
| alt_title | VARCHAR(256) | 次要歌名 |
| full_title | VARCHAR(512) | 歌曲全称 |
| reference_url | VARCHAR(1024) | 参考链接 |
| play_part | TINYINT | 0=全曲, 1=副歌, 2=自定义 |
| custom_part_desc | VARCHAR(256) | 自定义段落描述 |
| sort_order | INT | 排序 |

## 鉴权机制

- 注册：`POST /auth/register` → 创建用户 + 返回 JWT
- 登录：`POST /auth/login` → 验证密码 + 返回 JWT
- JWT payload: `{ sub: userId, role: 0|1, identityVersion: 1 }`
- 请求头：`Authorization: Bearer <token>`
- 管理员守卫：`@UseGuards(AuthGuard('jwt'), RolesGuard)` + `@Roles(UserRole.ADMIN)`

## 表单防重复

路演报名和歌单投稿使用 SHA-256 表单指纹 + (user_id, session_id) 唯一约束防止重复提交。
相同内容的重复提交返回已存在的记录 ID，不创建新记录。
