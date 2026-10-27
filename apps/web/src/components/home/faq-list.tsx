import { Markdown } from '@/components/markdown';

export interface FaqItem {
  question: string;
  answer: string;
}

/** Las preguntas frecuentes se editan como Markdown: cada "### " es una pregunta. */
export function parseFaq(markdown: string): FaqItem[] {
  return markdown
    .split(/^###\s+/m)
    .slice(1)
    .map((block) => {
      const [question = '', ...answer] = block.split('\n');
      return { question: question.trim(), answer: answer.join('\n').trim() };
    })
    .filter((item) => item.question && item.answer);
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
