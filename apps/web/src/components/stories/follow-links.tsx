import { SOCIAL_ICONS } from '@/components/social-icons';
import { SOCIAL_LINKS } from '@/lib/social';

/** Íconos de nuestras redes, en una fila compacta (ficha de historia). Sin URL no aparece. */
export function FollowLinks({ lead, newTab }: { lead: string; newTab: string }) {
  if (SOCIAL_LINKS.length === 0) return null;
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">{lead}</p>
      <ul className="flex flex-wrap gap-2">
        {SOCIAL_LINKS.map((social) => (
          <li key={social.key}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${social.label} (${newTab})`}
              title={social.label}
              className="inline-flex size-11 items-center justify-center rounded-full border bg-background transition hover:bg-muted"
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
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
