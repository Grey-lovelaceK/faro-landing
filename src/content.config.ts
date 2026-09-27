// Colecciones de contenido de Faro°. El blog vive en src/content/blog/*.md:
// el encabezado (frontmatter) define título, fechas, autoría, FAQ y CTA; el cuerpo es Markdown normal.
// Los archivos que empiezan con "_" (plantilla, borradores) no se publican.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '[!_]*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().max(60),               // <title>, sin la marca (se agrega sola)
    h1: z.string(),
    description: z.string().min(120).max(160),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    order: z.number().default(0),            // desempate en el índice (más alto = más arriba)
    author: z.string(),
    role: z.string(),                        // línea bajo el nombre en la ficha de autora/autor
    job: z.string(),                         // jobTitle en el JSON-LD
    cluster: z.string(),
    keywords: z.array(z.string()),
    tldr: z.string(),                        // "Respuesta corta" (admite <strong>)
    summary: z.string(),                     // texto de la tarjeta en /blog/
    faq: z.array(z.object({ q: z.string(), a: z.string() })).min(3),
    cta: z.object({ title: z.string(), text: z.string(), href: z.string(), label: z.string() }),
    related: z.array(z.object({ href: z.string(), title: z.string() })),
  }),
});

export const collections = { blog };
