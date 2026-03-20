import path from 'node:path';
import dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { createTodo, deleteTodo, listTodos, updateTodo } from './db.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = new Hono();

app.use('/api/*', cors({ origin: corsOrigin }));

app.get('/', (c) => {
  return c.json({
    name: 'LR12 Todo Backend',
    mode: 'local-only',
    endpoints: [
      'GET /health',
      'GET /api/todos',
      'POST /api/todos',
      'PATCH /api/todos/:id',
      'DELETE /api/todos/:id',
    ],
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

app.get('/api/todos', (c) => {
  return c.json({ items: listTodos() });
});

const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

app.post('/api/todos', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createTodoSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const todo = createTodo(parsed.data.title);
  return c.json(todo, 201);
});

const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
  })
  .refine((data) => data.title !== undefined || data.done !== undefined, {
    message: 'At least one field is required: title or done',
  });

app.patch('/api/todos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid id' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateTodoSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const updated = updateTodo(id, parsed.data);
  if (!updated) {
    return c.json({ error: 'Todo not found' }, 404);
  }

  return c.json(updated);
});

app.delete('/api/todos/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Invalid id' }, 400);
  }

  const removed = deleteTodo(id);
  if (!removed) {
    return c.json({ error: 'Todo not found' }, 404);
  }

  return c.body(null, 204);
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Todo backend started: http://localhost:${info.port}`);
    console.log(`CORS origin: ${corsOrigin}`);
  }
);
