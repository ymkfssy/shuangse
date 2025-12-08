import bcrypt from 'bcryptjs';
import cookie from 'cookie';
import { getDB } from './database.js';

// 生成随机会话ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 注册新用户
export async function handleRegister(request) {
  try {
    const env = request.env;
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
    return new Response(JSON.stringify({ error: `注册失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 用户登录
export async function handleLogin(request) {
  try {
    const env = request.env;
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

    // 返回带有会话cookie的响应
    return new Response(JSON.stringify({ success: true, message: '登录成功' }), { 
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
    return new Response(JSON.stringify({ error: `登录失败: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// 验证用户是否已认证
export async function isAuthenticated(request) {
  try {
    const cookies = cookie.parse(request.headers.get('Cookie') || '');
    const sessionId = cookies.session;

    // 简化的会话验证：只检查是否存在会话cookie
    return !!sessionId;
  } catch (error) {
    return false;
  }
}
