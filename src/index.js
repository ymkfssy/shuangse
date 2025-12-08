import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { handleLogin, handleRegister, handleLogout, isAuthenticated } from './auth.js';
import { getHistoryNumbers, generateNewNumber, crawlHistoryNumbers } from './lottery.js';
import { initDatabase, getDB } from './database.js';

// 处理HTTP请求
async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 检查是否需要身份验证
  const requiresAuth = ['/app', '/generate', '/history'].includes(pathname);
  if (requiresAuth && !await isAuthenticated(request)) {
    return new Response('Unauthorized', { status: 302, headers: { Location: '/login.html' } });
  }

  // API路由处理
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.slice(5);
    
    if (apiPath === 'login' && request.method === 'POST') {
      return handleLogin(request);
    } else if (apiPath === 'register' && request.method === 'POST') {
      return handleRegister(request);
    } else if (apiPath === 'logout' && request.method === 'POST') {
      return handleLogout(request);
    } else if (apiPath === 'history' && request.method === 'GET') {
      return getHistoryNumbers(request);
    } else if (apiPath === 'generate' && request.method === 'GET') {
      return generateNewNumber(request);
    } else if (apiPath === 'crawl' && request.method === 'POST') {
      return crawlHistoryNumbers(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  // 静态文件处理
  try {
    return await getAssetFromKV({ request });
  } catch (e) {
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}

// 定时任务处理函数
async function handleScheduled(event, env, ctx) {
  // 每周一、周三、周五的上午10点运行爬取任务
  // Cron表达式: 0 10 * * 1,3,5
  console.log('定时任务执行: 开始爬取双色球历史数据');
  
  // 调用爬取函数，传递env参数
  const result = await crawlHistoryNumbers(null, env);
  
  // 记录爬取结果
  console.log('定时任务执行结果:', await result.text());
  
  return new Response('定时任务执行完成');
}

// 导出Worker处理函数
export default { 
  fetch: handleRequest,
  scheduled: handleScheduled
};
