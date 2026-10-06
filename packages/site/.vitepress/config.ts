import { defineConfig } from 'vitepress'

const repository = 'https://github.com/PhyberApex/kuroshiro'
const demo = 'https://kuroshiro-demo.phyberapex.de/'
const base = '/kuroshiro/'

export default defineConfig({
  base,
  lang: 'en-US',
  title: 'Kuroshiro',
  description: 'A self-hosted BYOS server for TRMNL e-ink devices: Screens, Plugins, Schedules, Firmware and Alerts in one Docker image.',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Kuroshiro: Unleash your TRMNL' }],
    ['meta', { property: 'og:image', content: `https://phyberapex.github.io${base}logo.png` }],
  ],
  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: 'Kuroshiro' },
    siteTitle: false,
    nav: [
      { text: 'Tour', link: '/tour/', activeMatch: '^/tour/' },
      { text: 'Get started', link: '/getting-started' },
      { text: 'Comparison', link: '/comparison' },
      { text: 'Live demo', link: demo },
      {
        text: 'More',
        items: [
          { text: 'Design decisions (ADRs)', link: `${repository}/tree/main/docs/adr` },
          { text: 'Domain language', link: `${repository}/blob/main/CONTEXT.md` },
          { text: 'Releases', link: `${repository}/releases` },
        ],
      },
    ],
    sidebar: {
      '/': [
        {
          text: 'Tour',
          items: [
            { text: 'Overview', link: '/tour/' },
            { text: 'Devices', link: '/tour/devices' },
            { text: 'Screens', link: '/tour/screens' },
            { text: 'Plugins', link: '/tour/plugins' },
            { text: 'Alerts', link: '/tour/alerts' },
            { text: 'Firmware & Device Models', link: '/tour/firmware' },
            { text: 'Prometheus Metrics', link: '/tour/metrics' },
            { text: 'Device Simulator', link: '/tour/simulator' },
          ],
        },
        {
          text: 'Run it',
          items: [
            { text: 'Get started', link: '/getting-started' },
            { text: 'Kuroshiro vs. the rest', link: '/comparison' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: {
      pattern: `${repository}/edit/main/packages/site/:path`,
      text: 'Edit this page on GitHub',
    },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Janis Walliser',
    },
  },
})
