import type { Locale } from '@storynido/shared';
import type { MDXContent } from 'mdx/types';

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  /** ISO (AAAA-MM-DD). */
  date: string;
  /** Portada real del catálogo (ruta en /public) y su texto alternativo. */
  image: string;
  imageAlt: string;
}

interface PostModule {
  default: MDXContent;
  metadata: Omit<PostMeta, 'slug'>;
}

/** Artículos por idioma. Para sumar uno: crear el .mdx y registrarlo acá. */
const POSTS: Record<Locale, Record<string, () => Promise<PostModule>>> = {
  es: {
    'cuentos-personalizados-y-lectura': () => import('./es/cuentos-personalizados-y-lectura.mdx'),
    'regalos-de-cumpleanos-con-significado': () =>
      import('./es/regalos-de-cumpleanos-con-significado.mdx'),
    'cuento-personalizado-para-cumpleanos': () =>
      import('./es/cuento-personalizado-para-cumpleanos.mdx'),
    'cuento-para-dejar-el-panal': () => import('./es/cuento-para-dejar-el-panal.mdx'),
    'cuento-primer-dia-de-clases': () => import('./es/cuento-primer-dia-de-clases.mdx'),
    'regalo-dia-del-nino': () => import('./es/regalo-dia-del-nino.mdx'),
    'cuento-de-navidad-personalizado': () => import('./es/cuento-de-navidad-personalizado.mdx'),
  },
  en: {
    'personalized-books-and-reading': () => import('./en/personalized-books-and-reading.mdx'),
    'meaningful-birthday-gift-ideas': () => import('./en/meaningful-birthday-gift-ideas.mdx'),
  },
  pt: {
    'livros-personalizados-e-leitura': () => import('./pt/livros-personalizados-e-leitura.mdx'),
    'presentes-de-aniversario-com-significado': () =>
      import('./pt/presentes-de-aniversario-com-significado.mdx'),
  },
};

export async function listPosts(locale: Locale): Promise<PostMeta[]> {
  const posts = await Promise.all(
    Object.entries(POSTS[locale]).map(async ([slug, load]) => ({
      slug,
      ...(await load()).metadata,
    })),
  );
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPost(
  locale: Locale,
  slug: string,
): Promise<(PostModule & { slug: string }) | null> {
  const load = POSTS[locale][slug];
  return load ? { slug, ...(await load()) } : null;
}

export function postSlugs(locale: Locale): string[] {
  return Object.keys(POSTS[locale]);
}

/**
 * El idioma en el que existe un artículo (cada uno está en un solo idioma). Sirve para redirigir
 * /es/blog/<slug-en-portugués> al artículo real en vez de dar 404.
 */
export function postLocale(slug: string): Locale | null {
  const found = (Object.keys(POSTS) as Locale[]).find((locale) => slug in POSTS[locale]);
  return found ?? null;
}
