// import { getAssetFromKV } from '@cloudflare/kv-asset-handler';  // 暂时注释掉，避免KV依赖
import { handleLogin, handleRegister, handleLogout, isAuthenticated, getUserFromSession } from './auth.js';
import { getHistoryNumbers, generateNewNumber, generateNewNumbers, crawlHistoryNumbers } from './lottery.js';
import { initDatabase, getDB } from './database.js';

// 处理HTTP请求
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 检查是否需要身份验证
  const requiresAuth = ['/app', '/api/generate', '/api/history', '/api/crawl'].includes(pathname);
  if (requiresAuth && !await isAuthenticated(request, env)) {
    return new Response(JSON.stringify({ error: '请先登录' }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // API路由处理
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.slice(5);
    
    if (apiPath === 'login' && request.method === 'POST') {
      return handleLogin(request, env);
    } else if (apiPath === 'register' && request.method === 'POST') {
      return handleRegister(request, env);
    } else if (apiPath === 'logout' && request.method === 'POST') {
      return handleLogout(request, env);
    } else if (apiPath === 'history' && request.method === 'GET') {
      return getHistoryNumbers(request, env);
    } else if (apiPath === 'generate' && request.method === 'GET') {
      // 支持批量生成，通过count参数控制生成数量
      const url = new URL(request.url);
      const count = parseInt(url.searchParams.get('count') || '1');
      
      if (count > 1) {
        return generateNewNumbers(request, env);
      } else {
        return generateNewNumber(request, env);
      }
    } else if (apiPath === 'crawl' && request.method === 'POST') {
      return crawlHistoryNumbers(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }

  // 静态文件处理 - 简化版本，避免KV依赖
  try {
    // 路径映射
    if (pathname === '/app.html' || pathname === '/app') {
      return new Response(getAppHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    if (pathname === '/login.html' || pathname === '/login' || pathname === '/') {
      return new Response(getLoginHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
    
    // 其他未匹配的路径
    return new Response('Page not found', { status: 404 });
    
  } catch (e) {
    return new Response(`Server Error: ${e.message}`, { status: 500 });
  }
}

// 定时任务处理函数
async function handleScheduled(event, env, ctx) {
  // 每周一、周三、周五的上午10点运行爬取任务
  // Cron表达式: 0 10 * * 1,3,5
  console.log('定时任务执行: 开始爬取双色球历史数据');
  
  try {
    // 调用爬取函数，传递env参数
    const result = await crawlHistoryNumbers(null, env);
    
    // 记录爬取结果
    console.log('定时任务执行结果: 爬取完成');
    
    return new Response('定时任务执行完成');
  } catch (error) {
    console.error('定时任务执行失败:', error);
    return new Response('定时任务执行失败', { status: 500 });
  }
}

// 内嵌的HTML内容（临时解决方案）
function getLoginHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>双色球选号系统 - 登录</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .login-container { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 40px; width: 100%; max-width: 400px; }
        h1 { text-align: center; color: #333; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; color: #555; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 12px; background: #1890ff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin-bottom: 10px; }
        .btn:hover { background: #40a9ff; }
        .error-message { color: #ff4d4f; text-align: center; margin: 10px 0; }
        .success-message { color: #52c41a; text-align: center; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>双色球选号系统</h1>
        <div id="message" style="display: none;"></div>
        <div id="login-form">
            <div class="form-group">
                <label for="username">用户名</label>
                <input type="text" id="username" placeholder="请输入用户名">
            </div>
            <div class="form-group">
                <label for="password">密码</label>
                <input type="password" id="password" placeholder="请输入密码">
            </div>
            <button class="btn" onclick="handleLogin()">登录</button>
            <button class="btn" onclick="showRegisterForm()">注册</button>
        </div>
        
        <div id="register-form" style="display: none;">
            <div class="form-group">
                <label for="reg-username">用户名</label>
                <input type="text" id="reg-username" placeholder="请输入用户名">
            </div>
            <div class="form-group">
                <label for="reg-password">密码</label>
                <input type="password" id="reg-password" placeholder="请输入密码">
            </div>
            <div class="form-group">
                <label for="reg-confirm-password">确认密码</label>
                <input type="password" id="reg-confirm-password" placeholder="请再次输入密码">
            </div>
            <button class="btn" onclick="handleRegister()">注册</button>
            <button class="btn" onclick="showLoginForm()">返回登录</button>
        </div>
    </div>

    <script>
        function showMessage(message, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }

        function showLoginForm() {
            document.getElementById('login-form').style.display = 'block';
            document.getElementById('register-form').style.display = 'none';
        }

        function showRegisterForm() {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
        }

        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showMessage('用户名和密码不能为空', 'error');
                return;
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    setTimeout(() => { window.location.href = '/app.html'; }, 1000);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('登录失败，请稍后重试', 'error');
            }
        }

        async function handleRegister() {
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;

            if (!username || !password || !confirmPassword) {
                showMessage('所有字段不能为空', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showMessage('两次输入的密码不一致', 'error');
                return;
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    setTimeout(() => { showLoginForm(); }, 1000);
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('注册失败，请稍后重试', 'error');
            }
        }
    </script>
</body>
</html>`;
}

function getAppHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>双色球选号系统 - 主界面</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 0; }
        .header { background: #1890ff; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .header h1 { margin: 0; font-size: 24px; }
        .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 30px; margin-bottom: 20px; }
        .number-display { text-align: center; margin: 30px 0; }
        .number-container { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
        .red-ball, .blue-ball { width: 60px; height: 60px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 24px; font-weight: bold; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .red-ball { background: #ff4d4f; }
        .blue-ball { background: #1890ff; }
        .btn { padding: 12px 24px; background: #1890ff; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; margin: 0 10px; }
        .btn:hover { background: #40a9ff; }
        .btn-danger { background: #ff4d4f; }
        .btn-danger:hover { background: #ff7875; }
        .btn-success { background: #52c41a; }
        .btn-success:hover { background: #73d13d; }
        .history-container { margin-top: 30px; }
        .history-list { max-height: 400px; overflow-y: auto; border: 1px solid #f0f0f0; border-radius: 4px; padding: 10px; }
        .history-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #f0f0f0; }
        .history-item:last-child { border-bottom: none; }
        .history-numbers { display: flex; align-items: center; gap: 8px; }
        .small-ball { width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 14px; font-weight: bold; color: white; }
        .history-info { text-align: right; color: #666; font-size: 14px; }
        .message { text-align: center; padding: 15px; margin: 20px 0; border-radius: 4px; font-weight: bold; }
        .message.success { background: #f6ffed; border: 1px solid #b7eb8f; color: #52c41a; }
        .message.error { background: #fff2f0; border: 1px solid #ffccc7; color: #ff4d4f; }
    </style>
</head>
<body>
    <div class="header">
        <h1>双色球选号系统</h1>
        <button class="btn btn-danger" onclick="handleLogout()">退出登录</button>
    </div>

    <div class="container">
        <div class="card">
            <div class="number-display">
                <h2>双色球号码生成</h2>
                <div style="margin-bottom: 20px;">
                    <label for="count-select">生成数量：</label>
                    <select id="count-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ddd;">
                        <option value="1">1个号码</option>
                        <option value="2">2个号码</option>
                        <option value="3">3个号码</option>
                        <option value="4">4个号码</option>
                        <option value="5" selected>5个号码</option>
                        <option value="6">6个号码</option>
                        <option value="7">7个号码</option>
                        <option value="8">8个号码</option>
                        <option value="9">9个号码</option>
                        <option value="10">10个号码</option>
                    </select>
                </div>
                <div class="number-container" id="generated-numbers">
                    <p>请选择生成数量并点击"生成新号码"</p>
                </div>
                <button class="btn btn-success" onclick="generateNumber()">生成新号码</button>
                <button class="btn" onclick="crawlHistory()">更新历史数据</button>
            </div>

            <div class="history-container">
                <h2>最近历史开奖</h2>
                <div class="history-list" id="history-list">
                    <p>加载中...</p>
                </div>
            </div>
        </div>
    </div>

    <div id="message" class="message" style="display: none;"></div>

    <script>
        function showMessage(message, type) {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = message;
            messageDiv.className = \`message \${type}\`;
            messageDiv.style.display = 'block';
            setTimeout(() => { messageDiv.style.display = 'none'; }, 3000);
        }

        async function generateNumber() {
            const count = document.getElementById('count-select').value;
            
            try {
                const response = await fetch(\`/api/generate?count=\${count}\`);
                const result = await response.json();
                
                if (response.ok) {
                    displayGeneratedNumbers(result.numbers, count);
                    showMessage(\`成功生成 \${count} 个号码！\`, 'success');
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('生成号码失败，请稍后重试', 'error');
            }
        }

        function displayGeneratedNumbers(numbers, count) {
            const container = document.getElementById('generated-numbers');
            container.innerHTML = '';
            
            if (count === 1) {
                // 单个号码显示
                const numberGroup = document.createElement('div');
                numberGroup.className = 'number-group';
                numberGroup.style.marginBottom = '20px';
                
                numbers.red.forEach(num => {
                    const ball = document.createElement('div');
                    ball.className = 'red-ball';
                    ball.textContent = num;
                    numberGroup.appendChild(ball);
                });
                
                const blueBall = document.createElement('div');
                blueBall.className = 'blue-ball';
                blueBall.textContent = numbers.blue;
                numberGroup.appendChild(blueBall);
                
                container.appendChild(numberGroup);
            } else {
                // 多个号码显示
                numbers.forEach((number, index) => {
                    const numberGroup = document.createElement('div');
                    numberGroup.className = 'number-group';
                    numberGroup.style.marginBottom = '15px';
                    numberGroup.style.padding = '10px';
                    numberGroup.style.border = '1px solid #f0f0f0';
                    numberGroup.style.borderRadius = '4px';
                    
                    const groupTitle = document.createElement('div');
                    groupTitle.textContent = \`第 \${index + 1} 组：\`;
                    groupTitle.style.marginBottom = '10px';
                    groupTitle.style.fontWeight = 'bold';
                    groupTitle.style.color = '#666';
                    
                    const ballsContainer = document.createElement('div');
                    ballsContainer.className = 'number-container';
                    ballsContainer.style.justifyContent = 'flex-start';
                    
                    number.red.forEach(num => {
                        const ball = document.createElement('div');
                        ball.className = 'small-ball red-ball';
                        ball.textContent = num;
                        ballsContainer.appendChild(ball);
                    });
                    
                    const blueBall = document.createElement('div');
                    blueBall.className = 'small-ball blue-ball';
                    blueBall.textContent = number.blue;
                    ballsContainer.appendChild(blueBall);
                    
                    numberGroup.appendChild(groupTitle);
                    numberGroup.appendChild(ballsContainer);
                    container.appendChild(numberGroup);
                });
            }
        }

        async function getHistoryNumbers() {
            try {
                const container = document.getElementById('history-list');
                // 显示加载状态
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">加载历史数据中...</div>';
                
                const response = await fetch('/api/history?limit=20');
                const result = await response.json();
                
                if (response.ok) {
                    if (result.numbers && result.numbers.length > 0) {
                        displayHistoryNumbers(result.numbers);
                    } else {
                        // 数据为空时的提示
                        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无历史数据</div>';
                        showMessage('历史数据为空，请尝试更新数据', 'info');
                    }
                } else {
                    // API返回错误
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff4d4f;">获取历史数据失败</div>';
                    showMessage(result.error || '获取历史数据失败', 'error');
                }
            } catch (error) {
                const container = document.getElementById('history-list');
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff4d4f;">获取历史数据失败</div>';
                console.error('获取历史数据失败:', error);
                showMessage('网络错误或服务器不可用', 'error');
            }
        }

        function displayHistoryNumbers(numbers) {
            const container = document.getElementById('history-list');
            container.innerHTML = '';
            
            numbers.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                historyItem.innerHTML = \`
                    <div class="history-numbers">
                        <div class="small-ball red-ball">\${item.red_1}</div>
                        <div class="small-ball red-ball">\${item.red_2}</div>
                        <div class="small-ball red-ball">\${item.red_3}</div>
                        <div class="small-ball red-ball">\${item.red_4}</div>
                        <div class="small-ball red-ball">\${item.red_5}</div>
                        <div class="small-ball red-ball">\${item.red_6}</div>
                        <div class="small-ball blue-ball">\${item.blue}</div>
                    </div>
                    <div class="history-info">
                        <div>期号: \${item.issue_number}</div>
                        <div>日期: \${item.draw_date}</div>
                    </div>
                \`;
                
                container.appendChild(historyItem);
            });
        }

        async function crawlHistory() {
            try {
                const response = await fetch('/api/crawl', { method: 'POST' });
                const result = await response.json();
                
                if (response.ok) {
                    showMessage(result.message, 'success');
                    getHistoryNumbers();
                } else {
                    showMessage(result.error, 'error');
                }
            } catch (error) {
                showMessage('更新历史数据失败', 'error');
            }
        }

        async function handleLogout() {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.ok) {
                    window.location.href = '/login.html';
                }
            } catch (error) {
                showMessage('退出登录失败', 'error');
            }
        }

        // 只在DOM加载完成后调用一次getHistoryNumbers
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM加载完成，初始化历史数据');
            getHistoryNumbers();
        });
    </script>
</body>
</html>`;
}

// 导出Worker处理函数
export default { 
  fetch: handleRequest,
  scheduled: handleScheduled
};
