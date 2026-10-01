// Connectors are read straight from standards/connectors/, the same files an
// agent reads, so the marketplace on this site cannot describe a connector
// differently from the standard. Same instinct as the generated Global Footer:
// one source, rendered, never transcribed.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const connectors = defineCollection({
  loader: glob({
    pattern: '*/CONNECTOR.md',
    base: '../standards/connectors',
    generateId: ({ data }) => String(data.id),
  }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    source: z.string().url(),
    platform: z.string(),
    summary: z.string(),
    provides: z.string(),
    auth: z.string(),
    status: z.enum(['stub', 'tested']),
    reviewed: z.coerce.date(),
  }),
});

export const collections = { connectors };
