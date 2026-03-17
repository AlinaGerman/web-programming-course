import type { Context, Next } from 'hono';
import { getGitHubUserByCode, GitHubServiceError } from '../services/github.js';
import { sign, verify } from 'hono/jwt';
import prisma from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

//Генерация JWT токена для пользователя
async function generateUserToken(userId: string): Promise<string> {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 дней
  };
  
  return await sign(payload, JWT_SECRET, 'HS256');
}

//Получить пользователя из JWT токена
async function getUserFromToken(c: Context): Promise<{ user?: SessionUser; error?: string }> {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized' };
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    });
    
    if (!user) {
      return { error: 'User not found' };
    }
    
    return { user };
  } catch (error) {
    return { error: 'Unauthorized' };
  }
}

//Middleware для проверки аутентификации пользователя
export async function authMiddleware(c: Context, next: Next) {
  const result = await getUserFromToken(c);
  
  if (result.error) {
    return c.json({ 
      success: false,
      error: result.error
    }, 401);
  }
  
  (c as any).set('user', result.user);
  
  await next();
}

//Middleware для проверки прав доступа к сессии
export async function checkSessionAccess(c: Context, next: Next) {
  const sessionId = c.req.param('id');
  // Получаем пользователя из контекста
  const user = (c as any).get('user') as SessionUser | undefined;
  
  if (!user) {
    return c.json({ 
      success: false,
      error: 'Unauthorized'
    }, 401);
  }
  
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true }
  });
  
  if (!session) {
    return c.json({ 
      success: false,
      error: 'Session not found'
    }, 404);
  }
  
  if (session.userId !== user.id) {
    return c.json({ 
      success: false,
      error: 'Forbidden'
    }, 403);
  }
  
  await next();
}

//OAuth callback для пользователей
export async function userGithubCallback(c: Context) {
  try {
    const { code } = c.req.query();
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Missing authorization code'
      }, 400);
    }

    const githubUser = await getGitHubUserByCode(code);
    
    if (!githubUser.email) {
      return c.json({
        success: false,
        error: 'Email is required. Make sure your GitHub email is public.'
      }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: githubUser.email }
    });

    if (!user) {
      return c.json({
        success: false,
        error: 'User not found'
      }, 404);
    }

    const token = await generateUserToken(user.id);

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('User GitHub callback error:', error);
    
    if (error instanceof GitHubServiceError) {
      return c.json({
        success: false,
        error: error.message
      }, error.statusCode);
    }

    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
}