import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/** Link, redirect y hooks que respetan el idioma y los slugs traducidos. */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
