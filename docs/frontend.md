# 前端开发文档

## 技术栈

React 19 + TypeScript + Ant Design 6 + Vite 8 + Zustand + Axios + react-router-dom 7

## 路由树

```
/login                          登录页
/register                       注册页
/                               用户端首页
/roadshow/create                路演报名（需登录）
/roadshow/mine                  我的报名（需登录）
/playlist/browse                歌单投稿（需登录）
/playlist/mine                  我的投稿（需登录）
/playlist/detail/:id            投稿详情（需登录）
/profile                        个人信息（需登录）
/admin                          管理后台（需管理员）
  /admin/dashboard              数据大屏
  /admin/sessions               场次管理
  /admin/roadshow               路演报名管理
  /admin/submissions/list       投稿列表
  /admin/submissions/:id/detail 投稿详情
  /admin/submissions/statistics  投稿统计
  /admin/songs/list             歌曲库
  /admin/songs/pending          待审核歌曲
  /admin/playlist               随机舞蹈歌单（FastAPI）
  /admin/users                  用户管理
  /admin/client-events          客户端事件日志
  /admin/system-logs            系统日志
  /admin/client-config          云端控制
  /admin/profile                个人信息
```

## 状态管理

使用 Zustand 管理认证状态（`authStore`）：
- `token`：从 localStorage 读取 `admin_token`
- `user`：当前用户信息
- `authReady`：鉴权初始化完成标志
- `login()` / `register()` / `logout()` / `fetchProfile()`

## API 请求

`utils/request.ts` 封装 Axios：
- 请求拦截器：自动注入 `Authorization: Bearer <token>`
- 响应拦截器：统一处理 `code !== 0` 业务错误，401 自动跳转登录页

## 设计系统

- 主色：`#007aff`（蓝色渐变）
- 辅助色：绿色(通过)、橙色(待审核)、红色(驳回)、紫色(自定义)
- 字体：系统字体栈
- 圆角：10px (Ant Design token) / 20-28px (卡片)
- 阴影：`0 18px 48px rgba(15, 23, 42, 0.08)`
- 响应式：用户端移动优先，管理端桌面优先

## 页面说明

### 用户端

- **首页**：品牌 Hero + 快捷操作卡片（路演报名、歌单投稿、我的报名、我的投稿）
- **登录**：左侧品牌区 + 右侧表单，支持跳转注册
- **注册**：用户名 + 密码 + 昵称，独立账号体系
- **路演报名**：三步向导（表演信息 -> 成员与联系 -> 补充需求）
- **歌单投稿**：左侧曲库搜索（FastAPI）+ 右侧已选歌曲列表，支持自定义歌曲
- **我的报名/投稿**：表格列表 + 分页
- **个人信息**：修改昵称、手机、邮箱、密码

### 管理端

- **仪表盘**：用户/场次/报名/投稿统计 + 最近活动 + 系统健康
- **场次管理**：CRUD + 取消/恢复
- **路演报名管理**：筛选/搜索/排序 + 详情抽屉 + 批量审核/删除 + Excel 导出
- **歌单投稿管理**：筛选/搜索 + 详情抽屉 + 批量审核/删除 + Excel 导出 + 统计
- **歌曲库**：CRUD + 启用/禁用
- **随机舞蹈歌单**：FastAPI 歌曲浏览 + 播放
- **用户管理**：列表 + 角色切换
- **系统日志**：API 请求/错误日志 + 筛选 + 详情 + 清空
- **客户端事件**：事件日志浏览
- **云端控制**：配置键值管理
