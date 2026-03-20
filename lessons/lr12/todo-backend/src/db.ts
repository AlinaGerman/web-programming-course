import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dbFile = process.env.DB_FILE ?? './data/todo.sqlite';
const resolvedDbFile = path.resolve(process.cwd(), dbFile);

fs.mkdirSync(path.dirname(resolvedDbFile), { recursive: true });

const db = new Database(resolvedDbFile);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

type TodoRow = {
  id: number;
  title: string;
  done: number;
  created_at: string;
  updated_at: string;
};

export type Todo = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: TodoRow): Todo => ({
  id: row.id,
  title: row.title,
  done: row.done === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listTodos = (): Todo[] => {
  const rows = db
    .prepare('SELECT id, title, done, created_at, updated_at FROM todos ORDER BY id DESC')
    .all() as TodoRow[];
  return rows.map(mapRow);
};

export const getTodo = (id: number): Todo | null => {
  const row = db
    .prepare('SELECT id, title, done, created_at, updated_at FROM todos WHERE id = ?')
    .get(id) as TodoRow | undefined;

  return row ? mapRow(row) : null;
};

export const createTodo = (title: string): Todo => {
  const result = db
    .prepare(
      `INSERT INTO todos (title, done, created_at, updated_at)
       VALUES (?, 0, datetime('now'), datetime('now'))`
    )
    .run(title.trim());

  return getTodo(Number(result.lastInsertRowid)) as Todo;
};

export const updateTodo = (id: number, patch: { title?: string; done?: boolean }): Todo | null => {
  const current = getTodo(id);
  if (!current) {
    return null;
  }

  const nextTitle = patch.title !== undefined ? patch.title.trim() : current.title;
  const nextDone = patch.done !== undefined ? (patch.done ? 1 : 0) : current.done ? 1 : 0;

  db.prepare(
    `UPDATE todos
     SET title = ?, done = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextTitle, nextDone, id);

  return getTodo(id);
};

export const deleteTodo = (id: number): boolean => {
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return result.changes > 0;
};
