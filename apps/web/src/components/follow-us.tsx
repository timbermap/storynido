import { SOCIAL_ICONS } from '@/components/social-icons';
import { SOCIAL_LINKS } from '@/lib/social';

/** Invitación visible a seguirnos en las redes (blog). Una red sin URL no aparece. */
export function FollowUs({ lead, newTab }: { lead: string; newTab: string }) {
  if (SOCIAL_LINKS.length === 0) return null;
  return (
    <aside className="mt-10 grid gap-3 rounded-2xl bg-mint/60 p-5 sm:flex sm:items-center sm:justify-between">
      <p className="text-sm font-semibold">{lead}</p>
      <ul className="flex flex-wrap gap-2">
        {SOCIAL_LINKS.map((social) => (
          <li key={social.key}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${social.label} (${newTab})`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold transition hover:bg-muted"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {SOCIAL_ICONS[social.key]}
              </svg>
              {social.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
