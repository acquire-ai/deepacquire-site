import { getPermalink } from './utils/permalinks';

export const getHeaderData = (t: (key: string) => string) => ({
  links: [
    {
      text: t('nav.product'),
      links: [
        { text: t('nav.features'), href: getPermalink('/#features') },
        { text: t('nav.install'), href: getPermalink('/#install') },
        // { text: t('nav.pricing'), href: getPermalink('/pricing') },
      ],
    },
    {
      text: t('nav.pages'),
      links: [
        { text: t('nav.about'), href: getPermalink('/about') },
        { text: t('nav.contact'), href: getPermalink('/contact') },
        { text: t('nav.terms'), href: getPermalink('/terms') },
        // { text: t('nav.privacy'), href: getPermalink('/privacy') },
      ],
    },
    {
      text: t('nav.docs'),
      links: [
        { text: t('nav.github'), href: 'https://github.com/acquire-ai/AcquireLanguage' },
        { text: t('nav.userGuide'), href: 'https://github.com/acquire-ai/AcquireLanguage#readme' },
      ],
    },
  ],
  actions: [{ text: t('nav.getExtension'), href: '#install' }],
});

// Keep legacy export for backward compatibility
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

export const getFooterData = (t: (key: string) => string) => ({
  links: [
    {
      title: t('footer.product'),
      links: [
        { text: t('nav.features'), href: getPermalink('/#features') },
        { text: t('nav.install'), href: getPermalink('/#install') },
        // { text: t('nav.pricing'), href: getPermalink('/pricing') },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { text: t('nav.docs'), href: 'https://github.com/acquire-ai/AcquireLanguage' },
        { text: 'Issues', href: 'https://github.com/acquire-ai/AcquireLanguage/issues' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { text: t('nav.about'), href: getPermalink('/about') },
        { text: t('nav.contact'), href: getPermalink('/contact') },
      ],
    },
  ],
  secondaryLinks: [
    { text: t('nav.terms'), href: getPermalink('/terms') },
    { text: t('nav.privacy'), href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'Github', icon: 'tabler:brand-github', href: 'https://github.com/acquire-ai/AcquireLanguage' },
  ],
  footNote: `
    © ${new Date().getFullYear()} Acquire Language. ${t('footer.allRightsReserved')}
  `,
});

// Keep legacy export for backward compatibility
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
