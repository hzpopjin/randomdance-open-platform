import { defineConfig } from 'vitepress';

// 随机舞蹈中文站开放平台 · 静态文档中心
// 内容以目标平台真实 controller 契约为唯一事实来源。
export default defineConfig({
  base: '/docs/',
  lang: 'zh-CN',
  title: '开放平台文档中心',
  description:
    '随机舞蹈中文站开放平台 API 文档：路演报名、路演选位、歌单投稿、场次管理、上传与 TOS 对象存储，面向第三方开发者。',
  lastUpdated: true,
  cleanUrls: true,
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'API 参考', link: '/api/overview', activeMatch: '/api/' },
      { text: '鉴权', link: '/guide/authentication' },
      { text: '错误码', link: '/api/errors' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '平台概述', link: '/guide/introduction' },
            { text: '快速开始 / 部署', link: '/guide/getting-started' },
            { text: '鉴权机制', link: '/guide/authentication' },
          ],
        },
      ],
      '/api/': [
        {
          text: '总览',
          items: [
            { text: 'API 约定', link: '/api/overview' },
            { text: '错误码约定', link: '/api/errors' },
          ],
        },
        {
          text: '业务接口',
          items: [
            { text: '路演报名', link: '/api/roadshow-registration' },
            { text: '路演选位 · 新增', link: '/api/roadshow-position' },
            { text: '歌单投稿', link: '/api/submission' },
            { text: '场次管理', link: '/api/session' },
            { text: '歌曲库', link: '/api/song' },
            { text: '用户', link: '/api/user' },
            { text: '主办方 · 新增', link: '/api/organizer' },
          ],
        },
        {
          text: '存储与运维',
          items: [
            { text: '上传 / TOS 对象存储 · 新增', link: '/api/upload-tos' },
            { text: '数据导出', link: '/api/export' },
            { text: '系统日志 / 事件 / 云端配置', link: '/api/system' },
          ],
        },
      ],
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdatedText: '最后更新',
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',

    search: { provider: 'local' },

    footer: {
      message: '基于 MIT 许可发布的开放平台文档。',
      copyright: '随机舞蹈中文站开放平台 · 静态文档中心',
    },
  },
});
