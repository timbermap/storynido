import type { PipelineEvent } from '@storynido/shared';
import { gcpPost } from '@storynido/shared/server';

/** Publica los eventos que ponen en marcha el pipeline del pedido. */
export interface PipelineEventPublisher {
  publish(event: PipelineEvent): Promise<void>;
}

/** Desarrollo local: llama directo al worker (sin Pub/Sub). */
export class WorkerHttpPublisher implements PipelineEventPublisher {
  constructor(
    private readonly workerUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async publish(event: PipelineEvent): Promise<void> {
    const res = await this.fetchImpl(`${this.workerUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`Worker: HTTP ${String(res.status)}`);
  }
}

/** Nube: tema de Pub/Sub `order-events`, con suscripción push al worker. */
export class PubSubPublisher implements PipelineEventPublisher {
  constructor(
    private readonly projectId: string,
    private readonly topic: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async publish(event: PipelineEvent): Promise<void> {
    const url = `https://pubsub.googleapis.com/v1/projects/${this.projectId}/topics/${this.topic}:publish`;
    const res = await gcpPost(
      url,
      {
        messages: [
          {
            data: Buffer.from(JSON.stringify(event)).toString('base64'),
            attributes: { type: event.type, orderId: event.orderId },
          },
        ],
      },
      this.fetchImpl,
    );
    if (res.status >= 300) throw new Error(`Pub/Sub: HTTP ${String(res.status)}`);
  }
}

/** Tests: guarda los eventos en memoria. */
export class RecordingPublisher implements PipelineEventPublisher {
  readonly events: PipelineEvent[] = [];

  publish(event: PipelineEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}
