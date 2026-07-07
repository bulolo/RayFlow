import { defineConfig } from 'vitepress'
import pkg from '../package.json' with { type: 'json' }

export default defineConfig({
  srcDir: 'docs',
  title: 'RayFlow 文档',
  description: 'RayFlow 企业级 Flink 流批一体开发运维、资源管理与任务调度平台文档',
  lang: 'zh-CN',
  head: [['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }]],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      { text: '产品指南', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: '部署运维', link: '/deployment/docker', activeMatch: '/deployment/' },
      { text: 'API', link: '/api/rest', activeMatch: '/api/' },
      { text: '更新日志', link: '/about/changelog' },
      {
        text: `v${pkg.version}`,
        link: 'https://github.com/bulolo/RayFlow'
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '产品入门',
          items: [
            { text: '产品简介', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '系统架构', link: '/guide/architecture' },
          ],
        },
        {
          text: '使用指南',
          items: [
            { text: '控制台总览', link: '/guide/admin-console' },
            { text: '开发运维', link: '/guide/flink-submission' },
            { text: '资源中心', link: '/guide/resource-center' },
            { text: '任务调度', link: '/guide/scheduler' },
            { text: '技术栈集成', link: '/guide/integrations' },
          ],
        },
      ],

      '/deployment/': [
        {
          text: '部署',
          items: [
            { text: 'Docker 开发环境', link: '/deployment/docker' },
          ],
        },
      ],

      '/api/': [
        {
          text: '开发参考',
          items: [
            { text: 'REST API', link: '/api/rest' },
            { text: '环境变量', link: '/api/config' },
          ],
        },
      ],

      '/about/': [
        {
          text: '项目',
          items: [
            { text: '更新日志', link: '/about/changelog' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/bulolo/RayFlow' },
    ],

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2026 RayFlow Team',
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
      label: '本页目录',
    },
  },
})
