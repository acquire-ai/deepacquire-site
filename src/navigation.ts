import { getPermalink, getBlogPermalink } from './utils/permalinks';

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
      text: 'Blog',
      href: getBlogPermalink(),
    },
    {
      text: 'Docs',
      links: [
        { text: 'GitHub', href: 'https://github.com/deepacquire/DeepAcquire' },
        { text: 'User Guide', href: 'https://github.com/deepacquire/DeepAcquire#readme' },
      ],
    },
  ],
  actions: [],
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
        { text: 'Docs', href: 'https://github.com/deepacquire/DeepAcquire' },
        { text: 'Issues', href: 'https://github.com/deepacquire/DeepAcquire/issues' },
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
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/deepacquire/DeepAcquire' },
  ],
  footNote: `
    © ${new Date().getFullYear()} DeepAcquire. All rights reserved.
  `,
};
