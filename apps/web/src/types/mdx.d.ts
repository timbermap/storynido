declare module '*.mdx' {
  import type { MDXContent } from 'mdx/types';

  /** Cada artículo del blog exporta sus metadatos. */
  export const metadata: {
    title: string;
    description: string;
    date: string;
    image: string;
    imageAlt: string;
  };
  const Content: MDXContent;
  export default Content;
}
