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
    <div className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <details
          key={item.question}
          className="group p-5 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-semibold">
            {item.question}
            <span
              aria-hidden="true"
              className="text-2xl text-primary transition group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <Markdown className="mt-3 text-muted-foreground">{item.answer}</Markdown>
        </details>
      ))}
    </div>
  );
}
