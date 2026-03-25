import { Hono } from "hono";
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from "../../src/routes/auth.js";
import sessions from "../../src/routes/sessions.js";
import admin from "../../src/routes/admin.js";
import 'dotenv/config'

//каждый тест получает новый экземпляр приложения
export function createTestApp() {
  const app = new Hono();
  
  app.use('*', logger());
  app.use('*', cors());

  app.get('/', (c) => {
    return c.text('Hello Hono!')
  })

  app.get('/health', async (c) => {
    return c.json({"status": "ok"})
  })

  app.route('/api/auth', auth)
  app.route('/api/sessions', sessions)
  app.route('/api/admin', admin)

  return app;
}