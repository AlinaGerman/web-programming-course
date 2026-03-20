import { FormEvent, useCallback, useEffect, useState } from 'react';

type ServerTodo = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

// TODO(PWA): расширьте типы под офлайн-очередь операций.
type QueueAction = {
  id: string;
  type: 'create' | 'toggle' | 'delete';
  ts: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function toLocalText(value: string) {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ru-RU');
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiFetchTodos(): Promise<ServerTodo[]> {
  const response = await fetch(`${API_BASE_URL}/api/todos`);
  const data = await parseJson<{ items: ServerTodo[] }>(response);
  return data.items;
}

async function apiCreate(title: string): Promise<ServerTodo> {
  const response = await fetch(`${API_BASE_URL}/api/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  return parseJson<ServerTodo>(response);
}

async function apiToggle(todoId: number, done: boolean): Promise<ServerTodo> {
  const response = await fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  });

  return parseJson<ServerTodo>(response);
}

async function apiDelete(todoId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

function registerServiceWorkerStarter() {
  // TODO(PWA-1): зарегистрируйте Service Worker.
}

export default function App() {
  const [todos, setTodos] = useState<ServerTodo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queueActions] = useState<QueueAction[]>([]);

  const refreshFromServer = useCallback(async () => {
    const serverTodos = await apiFetchTodos();
    setTodos(serverTodos);
  }, []);

  const onCreate = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      try {
        await apiCreate(trimmed);
        await refreshFromServer();
        setMessage('Задача добавлена.');
      } catch {
        // TODO(PWA-3): если сеть недоступна, положить create-действие в офлайн-очередь.
        setMessage('Не удалось добавить задачу. Реализуйте офлайн-очередь для этого сценария.');
      }
    },
    [refreshFromServer]
  );

  const onToggle = useCallback(
    async (todo: ServerTodo) => {
      try {
        await apiToggle(todo.id, !todo.done);
        await refreshFromServer();
        setMessage('Статус обновлен.');
      } catch {
        // TODO(PWA-3): при ошибке сети не терять toggle-действие, а складывать в очередь.
        setMessage('Не удалось обновить статус. Добавьте fallback в офлайн-очередь.');
      }
    },
    [refreshFromServer]
  );

  const onDelete = useCallback(
    async (todo: ServerTodo) => {
      try {
        await apiDelete(todo.id);
        await refreshFromServer();
        setMessage('Задача удалена.');
      } catch {
        // TODO(PWA-3): при ошибке сети не терять delete-действие, а складывать в очередь.
        setMessage('Не удалось удалить задачу. Добавьте fallback в офлайн-очередь.');
      }
    },
    [refreshFromServer]
  );

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = inputValue;
      setInputValue('');
      await onCreate(value);
    },
    [inputValue, onCreate]
  );

  useEffect(() => {
    registerServiceWorkerStarter();

    let cancelled = false;

    const bootstrap = async () => {
      try {
        await refreshFromServer();
      } catch {
        if (!cancelled) {
          setMessage('Не удалось загрузить данные. Проверьте, что backend запущен.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refreshFromServer]);

  useEffect(() => {
    // TODO(PWA-2): добавьте обработчики online/offline.
    // window.addEventListener('online', ...)
    // window.addEventListener('offline', ...)
    // и обновляйте isOnline + message.

    setIsOnline(navigator.onLine);
  }, []);

  return (
    <main className="app">
      <header className="header">
        <h1>Todo-сы</h1>
        <span className={`badge ${isOnline ? 'online' : 'offline'}`}>{isOnline ? 'online' : 'offline'}</span>
      </header>

      <p className="muted">
        Есть: online CRUD. Реализовать: PWA, offline-очередь и синхронизацию после reconnect.
      </p>

      <form className="toolbar" onSubmit={onSubmit}>
        <input
          type="text"
          maxLength={200}
          placeholder="Новая задача"
          required
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <button type="submit">Добавить</button>
        <button type="button" disabled>
          Синхронизация (TODO)
        </button>
      </form>

      <section className="meta">
        <span className="badge">Офлайн-очередь: {queueActions.length}</span>
        <span className="badge">sync: TODO</span>
      </section>

      <section className="todo-note">
        <p>
          TODO(PWA-4): реализуйте очередь операций и автоматическую отправку после события <code>online</code>.
        </p>
      </section>

      {message ? <div className="message">{message}</div> : null}
      {isLoading ? <p>Загрузка...</p> : null}
      {!isLoading && todos.length === 0 ? <div className="empty">Пока нет задач</div> : null}

      <ul className="list">
        {todos.map((todo) => (
          <li className="item" key={todo.id}>
            <button type="button" onClick={() => void onToggle(todo)}>
              {todo.done ? '✅' : '⬜'}
            </button>
            <div>
              <div className={todo.done ? 'done' : ''}>{todo.title}</div>
              <div className="hint">Сервер · {toLocalText(todo.updatedAt)}</div>
            </div>
            <button type="button" onClick={() => void onDelete(todo)}>
              Удалить
            </button>
            <span className="hint">#{todo.id}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
