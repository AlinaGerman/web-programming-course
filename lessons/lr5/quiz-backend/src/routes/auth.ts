import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { PrismaClient } from '@prisma/client' 
import { authCallbackSchema } from '../utils/validation.js'
import { getGitHubUserByCode, GitHubServiceError } from '../services/github.js'

const prisma = new PrismaClient() 
const auth = new Hono()

const MOCK_USERS: Record<string, { id: string; email: string; name: string }> = {
  'test_code': {
    id: '12345',
    email: 'test@example.com',
    name: 'Test User'
  },
  'test_code_2': {
    id: '67890',
    email: 'test2@example.com',
    name: 'Test User 2'
  }
}

// POST /api/auth/github/callback
auth.post('/github/callback', async (c) => {
  try {
    const body = await c.req.json()
    
    const validation = authCallbackSchema.safeParse(body)
    
    if (!validation.success) {
      return c.json({ 
        error: 'Validation failed', 
        details: validation.error.issues 
      }, 400)
    }

    const { code } = validation.data

    let githubUser;

    // Mock режим для тестирования
    if (code.startsWith('test_')) {
      githubUser = MOCK_USERS[code]
      
      if (!githubUser) {
        throw new GitHubServiceError(
          `Invalid test code: ${code}`,
          400
        );
      }
    } else {
      githubUser = await getGitHubUserByCode(code)
    }

    // Подготавливаем данные для сохранения с значениями по умолчанию
    const userData = {
      githubId: githubUser.id.toString(),
      name: githubUser.name ?? 'Unknown User', 
      email: githubUser.email ?? `user-${githubUser.id}@no-email.github` 
    }

    // Сохраняем в базу данных
    const user = await prisma.user.upsert({
      where: { githubId: userData.githubId },
      update: {
        name: userData.name,
        email: userData.email
      },
      create: {
        githubId: userData.githubId,
        name: userData.name,
        email: userData.email
      }
    })

    // Создаем JWT токен
    const payload = {
      sub: user.id,
      githubId: user.githubId,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 дней
    }

    const secret = process.env.JWT_SECRET || 'dev-secret-key'
    const token = await sign(payload, secret)

    // Возвращаем ответ
    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        githubId: user.githubId
      }
    })

  } catch (error) {
    console.error('Auth error:', error)
    
    // Обработка ошибок GitHub сервиса
    if (error instanceof GitHubServiceError) {
      return c.json({ 
        success: false,
        error: error.message
      }, error.statusCode)
    }
    
    return c.json({ 
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      }, 401)
    }

    const token = authHeader.split(' ')[1]

    const secret = process.env.JWT_SECRET || 'dev-secret-key'
    const payload = await verify(token, secret, 'HS256')

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    })

    if (!user) {
      return c.json({ 
        success: false,
        error: 'User not found'
      }, 404)
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        githubId: user.githubId
      }
    })

  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token'
    }, 401)
  }
})

export default auth