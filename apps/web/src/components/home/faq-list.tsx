import { Markdown } from '@/components/markdown';

export interface FaqItem {
  question: string;
  answer: string;
}

/** Las preguntas frecuentes se editan como Markdown: cada "### " es una pregunta. */
export function parseFaq(markdown: string): FaqItem[] {
  return (
    markdown
      // Los títulos de grupo ("## ") no son parte de ninguna respuesta.
      .replace(/^##\s+(?!#).*$/gm, '')
      .split(/^###\s+/m)
      .slice(1)
      .map((block) => {
        const [question = '', ...answer] = block.split('\n');
        return { question: question.trim(), answer: answer.join('\n').trim() };
      })
      .filter((item) => item.question && item.answer)
  );
}

export interface FaqGroup {
  title: string | null;
  items: FaqItem[];
}

/** Grupos por tema: cada "## " abre un grupo; sin grupos, todo va en uno sin título. */
export function parseFaqGroups(markdown: string): FaqGroup[] {
  const parts = markdown.split(/^##\s+(?!#)/m);
  const groups: FaqGroup[] = [];
  const [intro = '', ...rest] = parts;
  const loose = parseFaq(intro);
  if (loose.length) groups.push({ title: null, items: loose });
  for (const part of rest) {
    const [title = '', ...body] = part.split('\n');
    const items = parseFaq(body.join('\n'));
    if (items.length) groups.push({ title: title.trim(), items });
  }
  return groups;
}

/** Preguntas agrupadas por tema, cada grupo con su acordeón. */
export function FaqGroups({ groups }: { groups: FaqGroup[] }) {
  return (
    <div className="grid gap-10">
      {groups.map((group) => (
        <section key={group.title ?? 'faq'} aria-label={group.title ?? undefined}>
          {group.title && (
            <h3 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h3>
          )}
          <FaqList items={group.items} />
        </section>
      ))}
    </div>
  );
}

/** Acordeón nativo (details/summary): accesible y sin JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item) => (
        <details
          key={item.question}
          className="group py-5 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer items-start justify-between gap-6 text-[1.05rem] font-semibold">
            {item.question}
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border text-lg leading-none text-primary transition group-open:rotate-45 group-open:border-primary/40"
            >
              +
            </span>
          </summary>
          <Markdown className="mt-3 max-w-2xl text-muted-foreground">{item.answer}</Markdown>
        </details>
      ))}
    </div>
  );
}

/** Para las landings: la primera pregunta de cada tema (la página de preguntas tiene todas). */
export function faqHighlights(groups: FaqGroup[], count = 4): FaqItem[] {
  return groups
    .map((group) => group.items[0])
    .filter((item): item is FaqItem => item !== undefined)
    .slice(0, count);
}
