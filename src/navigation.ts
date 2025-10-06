import { getPermalink } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Product',
      links: [
        { text: 'Features', href: getPermalink('/#features') },
        { text: 'Install', href: getPermalink('/#install') },
        // { text: 'Pricing', href: getPermalink('/pricing') },
      ],
    },
    {
      text: 'Pages',
      links: [
        { text: 'About', href: getPermalink('/about') },
        { text: 'Contact', href: getPermalink('/contact') },
        { text: 'Terms', href: getPermalink('/terms') },
        // { text: 'Privacy', href: getPermalink('/privacy') },
      ],
    },
    {
      text: 'Docs',
      links: [
        { text: 'GitHub', href: 'https://github.com/acquire-ai/AcquireLanguage' },
        { text: 'User Guide', href: 'https://github.com/acquire-ai/AcquireLanguage#readme' },
      ],
    },
  ],
  actions: [{ text: 'Get the Extension', href: '#install' }],
};

export const footerData = {
  links: [
    {
      title: 'Product',
      links: [
        { text: 'Features', href: getPermalink('/#features') },
        { text: 'Install', href: getPermalink('/#install') },
        // { text: 'Pricing', href: getPermalink('/pricing') },
      ],
    },
    {
      title: 'Support',
      links: [
        { text: 'Docs', href: 'https://github.com/acquire-ai/AcquireLanguage' },
        { text: 'Issues', href: 'https://github.com/acquire-ai/AcquireLanguage/issues' },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'About', href: getPermalink('/about') },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/acquire-ai/AcquireLanguage' },
  ],
  footNote: `
    © ${new Date().getFullYear()} Acquire Language. All rights reserved.
  `,
};
