import { I18N } from 'astrowind:config';

export const languages = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
} as const;

export type LocaleCode = keyof typeof languages;

export const defaultLocale: LocaleCode = (I18N.language as LocaleCode) || 'en';

const supportedLocales: ReadonlyArray<LocaleCode> = ['en', 'zh-CN', 'zh-TW'];
const localePrefixRegex = new RegExp(`^/(?:${supportedLocales.join('|')})(?=/|$)`);

export function stripLocaleFromPath(pathname: string): string {
  if (!pathname) return '/';
  const urlPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const stripped = urlPath.replace(localePrefixRegex, '') || '/';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function isExternalOrSpecialLink(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#') ||
    href.startsWith('javascript:')
  );
}

export function localizePath(href: string, locale: string): string {
  if (!href) return '/';
  if (isExternalOrSpecialLink(href)) return href;

  const clean = stripLocaleFromPath(href);
  if (locale === defaultLocale) {
    return clean;
  }
  return `/${locale}${clean === '/' ? '' : clean}`;
}
