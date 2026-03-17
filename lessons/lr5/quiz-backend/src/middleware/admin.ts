import type { Context, Next } from 'hono';
import { getGitHubUserByCode, GitHubServiceError } from '../services/github.js';
import { sign, verify } from 'hono/jwt';
import prisma from '../lib/prisma.js';

// Конфигурация административных GitHub аккаунтов
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Генерация JWT токена для администратора
async function generateAdminToken(userId: string): Promise<string> {
  const payload = {
    sub: userId,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 часа
  };
  
  return await sign(payload, JWT_SECRET, 'HS256');
}

// Обработчик OAuth callback
export async function adminGithubCallback(c: Context) {
  try {
    const { code } = c.req.query();
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Missing authorization code'
      }, 400);
    }

    console.log('Processing GitHub callback with code:', code.substring(0, 10) + '...');

    // Получаем данные пользователя из GitHub
    const githubUser = await getGitHubUserByCode(code);
    
    if (!githubUser.email) {
      return c.json({
        success: false,
        error: 'Email is required for admin access. Please make sure your GitHub email is public.'
      }, 400);
    }

    // Ищем пользователя в базе данных
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { githubId: githubUser.id.toString() },
          { email: githubUser.email }
        ]
      }
    });

    // Если пользователь не найден - возвращаем ошибку
    if (!user) {
      console.log(`User not found for GitHub account: ${githubUser.email}`);
      
      return c.json({
        success: false,
        error: 'User not found',
        message: 'No user account found. Please contact the system administrator to create an account for you.'
      }, 404);
    }

    // Генерируем JWT токен
    const token = await generateAdminToken(user.id);

    // Возвращаем JSON
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
    console.error('Admin GitHub callback error:', error);
    
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

// Middleware для проверки административных прав
export async function adminAuth(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      }, 401);
    }

    const token = authHeader.split(' ')[1];
    
    const payload = await verify(token, JWT_SECRET, 'HS256');
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    });
    
    if (!user) {
      return c.json({ 
        success: false,
        error: 'User not found',
        message: 'User account no longer exists'
      }, 404);
    }
    
    // Проверяем, является ли пользователь администратором
    if (user.role !== 'admin') {
      return c.json({ 
        success: false,
        error: 'Forbidden',
        message: 'Admin access required'
      }, 403);
    }
    
    // Добавляем пользователя в контекст для использования в роутах
    c.set('user', user);
    
    await next();
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token'
    }, 401);
  }
}