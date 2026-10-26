declare module '*.mdx' {
  import type { MDXContent } from 'mdx/types';

  /** Cada artículo del blog exporta sus metadatos. */
  export const metadata: { title: string; description: string; date: string };
  const Content: MDXContent;
  export default Content;
}
