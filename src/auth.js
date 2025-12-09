import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { getDB } from './database.js';

// 生成随机会话ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 注册新用户
export async function handleRegister(request, env) {
  try {
    const data = await request.json();
    const { username, password } = data;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 获取数据库实例
    const db = getDB(env);
    
    // 检查用户名是否已存在
    const existingUser = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (existingUser) {
      return new Response(JSON.stringify({ error: '用户名已存在' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建新用户
    await db.prepare(
      'INSERT INTO users (username, password) VALUES (?, ?)'
    ).bind(username, hashedPassword).run();

    return new Response(JSON.stringify({ success: true, message: '注册成功' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('注册失败:', error);
    return new Response(JSON.stringify({ error: `注册失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 用户登录
export async function handleLogin(request, env) {
  try {
    const data = await request.json();
    const { username, password } = data;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 获取数据库实例
    const db = getDB(env);
    
    // 查找用户
    const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
    if (!user) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // 生成会话ID
    const sessionId = generateSessionId();
    
    // 设置会话过期时间为24小时后
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 保存会话到数据库
    await db.prepare(
      'INSERT INTO sessions (session_id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, user.id, expiresAt.toISOString()).run();

    // 返回带有会话cookie的响应
    return new Response(JSON.stringify({ 
      success: true, 
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username
      }
    }), { 
      status: 200, 
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie.serialize('session', sessionId, { 
          httpOnly: true,
          secure: request.url.startsWith('https://'),
          sameSite: 'strict',
          path: '/',
          maxAge: 86400 // 24小时
        })
      } 
    });
  } catch (error) {
    console.error('登录失败:', error);
    return new Response(JSON.stringify({ error: `登录失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 用户登出
export async function handleLogout(request, env) {
  try {
    const cookies = cookie.parse(request.headers.get('Cookie') || '');
    const sessionId = cookies.session;

    if (sessionId) {
      // 从数据库中删除会话
      const db = getDB(env);
      await db.prepare('DELETE FROM sessions WHERE session_id = ?').bind(sessionId).run();
    }

    return new Response(JSON.stringify({ success: true, message: '登出成功' }), { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict'
      } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: `登出失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 从会话中获取用户信息
export async function getUserFromSession(request, env) {
  try {
    const cookies = cookie.parse(request.headers.get('Cookie') || '');
    const sessionId = cookies.session;

    if (!sessionId) {
      return null;
    }

    // 查找有效的会话
    const db = getDB(env);
    const session = await db.prepare(
      'SELECT s.*, u.id as user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_id = ? AND s.expires_at > datetime("now")'
    ).bind(sessionId).first();

    return session;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

// 验证用户是否已认证
export async function isAuthenticated(request, env) {
  const user = await getUserFromSession(request, env);
  return !!user;
}
