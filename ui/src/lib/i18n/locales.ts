/** One supported interface language. */
export interface LocaleInfo {
  code: string
  /** Name in its own language (shown first in the picker). */
  nativeName: string
  englishName: string
  dir: 'ltr' | 'rtl'
  /** BCP 47 tag for `Intl` formatting. */
  intl: string
  region: string
}

/** The 24 interface languages; Vietnamese is the source and the default. */
export const LOCALES: readonly LocaleInfo[] = [
  {
    code: 'vi',
    nativeName: 'Tiếng Việt',
    englishName: 'Vietnamese',
    dir: 'ltr',
    intl: 'vi-VN',
    region: 'vn',
  },
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
    intl: 'en-US',
    region: 'intl',
  },
  {
    code: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Chinese (Simplified)',
    dir: 'ltr',
    intl: 'zh-CN',
    region: 'east-asia',
  },
  {
    code: 'zh-TW',
    nativeName: '繁體中文',
    englishName: 'Chinese (Traditional)',
    dir: 'ltr',
    intl: 'zh-TW',
    region: 'east-asia',
  },
  {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    dir: 'ltr',
    intl: 'ja-JP',
    region: 'east-asia',
  },
  {
    code: 'ko',
    nativeName: '한국어',
    englishName: 'Korean',
    dir: 'ltr',
    intl: 'ko-KR',
    region: 'east-asia',
  },
  {
    code: 'th',
    nativeName: 'ไทย',
    englishName: 'Thai',
    dir: 'ltr',
    intl: 'th-TH',
    region: 'southeast-asia',
  },
  {
    code: 'id',
    nativeName: 'Bahasa Indonesia',
    englishName: 'Indonesian',
    dir: 'ltr',
    intl: 'id-ID',
    region: 'southeast-asia',
  },
  {
    code: 'ms',
    nativeName: 'Bahasa Melayu',
    englishName: 'Malay',
    dir: 'ltr',
    intl: 'ms-MY',
    region: 'southeast-asia',
  },
  {
    code: 'fil',
    nativeName: 'Filipino',
    englishName: 'Filipino',
    dir: 'ltr',
    intl: 'fil-PH',
    region: 'southeast-asia',
  },
  {
    code: 'km',
    nativeName: 'ខ្មែរ',
    englishName: 'Khmer',
    dir: 'ltr',
    intl: 'km-KH',
    region: 'southeast-asia',
  },
  {
    code: 'lo',
    nativeName: 'ລາວ',
    englishName: 'Lao',
    dir: 'ltr',
    intl: 'lo-LA',
    region: 'southeast-asia',
  },
  {
    code: 'my',
    nativeName: 'မြန်မာ',
    englishName: 'Burmese',
    dir: 'ltr',
    intl: 'my-MM',
    region: 'southeast-asia',
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    dir: 'ltr',
    intl: 'hi-IN',
    region: 'south-asia',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    dir: 'ltr',
    intl: 'bn-BD',
    region: 'south-asia',
  },
  {
    code: 'ur',
    nativeName: 'اردو',
    englishName: 'Urdu',
    dir: 'rtl',
    intl: 'ur-PK',
    region: 'south-asia',
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic',
    dir: 'rtl',
    intl: 'ar',
    region: 'middle-east',
  },
  {
    code: 'tr',
    nativeName: 'Türkçe',
    englishName: 'Turkish',
    dir: 'ltr',
    intl: 'tr-TR',
    region: 'middle-east',
  },
  {
    code: 'ru',
    nativeName: 'Русский',
    englishName: 'Russian',
    dir: 'ltr',
    intl: 'ru-RU',
    region: 'eastern-europe',
  },
  {
    code: 'de',
    nativeName: 'Deutsch',
    englishName: 'German',
    dir: 'ltr',
    intl: 'de-DE',
    region: 'western-europe',
  },
  {
    code: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    dir: 'ltr',
    intl: 'fr-FR',
    region: 'western-europe',
  },
  {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    dir: 'ltr',
    intl: 'es-ES',
    region: 'western-europe',
  },
  {
    code: 'pt-BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
    dir: 'ltr',
    intl: 'pt-BR',
    region: 'western-europe',
  },
  {
    code: 'it',
    nativeName: 'Italiano',
    englishName: 'Italian',
    dir: 'ltr',
    intl: 'it-IT',
    region: 'western-europe',
  },
]

const BY_CODE = new Map(LOCALES.map((locale) => [locale.code, locale]))

export function localeInfo(code: string): LocaleInfo | null {
  return BY_CODE.get(code) ?? null
}

export function isSupportedLocale(code: unknown): code is string {
  return typeof code === 'string' && BY_CODE.has(code)
}

export function localeDirection(code: string): 'ltr' | 'rtl' {
  return BY_CODE.get(code)?.dir ?? 'ltr'
}

/** `Intl` tag of a locale code (Vietnamese when unknown). */
export function intlTag(code: string): string {
  return BY_CODE.get(code)?.intl ?? 'vi-VN'
}
