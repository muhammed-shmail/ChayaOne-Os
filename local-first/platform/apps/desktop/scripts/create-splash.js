const fs = require('fs');
const path = require('path');

const iconPath = path.resolve(__dirname, '../resources/icon.png');
const iconB64 = fs.readFileSync(iconPath).toString('base64');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ChayaOne OS — Initializing</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      background: radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 100%);
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .container {
      text-align: center;
      max-width: 480px;
      width: 90%;
      padding: 2.5rem 2rem;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(234, 88, 12, 0.15);
      backdrop-filter: blur(16px);
    }
    .logo-box {
      position: relative;
      width: 120px;
      height: 120px;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 28px;
      background: rgba(234, 88, 12, 0.08);
      border: 1px solid rgba(234, 88, 12, 0.25);
      box-shadow: 0 0 35px rgba(234, 88, 12, 0.25);
    }
    .logo-img {
      width: 92px;
      height: 92px;
      object-fit: contain;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    h1 {
      font-size: 1.7rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.35rem;
      background: linear-gradient(135deg, #ffffff 40%, #fb923c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 0.82rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 2rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 9px 18px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.88rem;
      color: #cbd5e1;
      margin-bottom: 1.5rem;
    }
    .pulse-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #ea580c;
      box-shadow: 0 0 10px #ea580c;
      animation: pulse 1.4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    .progress-track {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
      position: relative;
      margin-bottom: 1rem;
    }
    .progress-bar {
      position: absolute;
      top: 0;
      left: -40%;
      width: 40%;
      height: 100%;
      background: linear-gradient(90deg, #ea580c, #fb923c);
      border-radius: 9999px;
      animation: loading 1.6s ease-in-out infinite;
    }
    @keyframes loading {
      0% { left: -40%; }
      100% { left: 100%; }
    }
    .hint {
      font-size: 0.78rem;
      color: #64748b;
      line-height: 1.4;
    }
    .btn-retry {
      display: none;
      margin-top: 1.25rem;
      padding: 10px 22px;
      background: #ea580c;
      color: white;
      border: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.88rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-retry:hover { background: #c2410c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-box">
      <img class="logo-img" src="data:image/png;base64,${iconB64}" alt="ChayaOne Logo">
    </div>
    <h1>ChayaOne OS</h1>
    <div class="subtitle">Main PC Station</div>
    <div class="status-badge">
      <span class="pulse-dot"></span>
      <span id="status-text">Connecting to Local Engine...</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar"></div>
    </div>
    <div class="hint" id="hint-text">Starting local database and server on port 3000...</div>
    <button class="btn-retry" id="retry-btn" onclick="attemptConnect()">Retry Connection</button>
  </div>
  <script>
    let attempts = 0;
    const params = new URLSearchParams(window.location.search);
    const targetRoute = params.get('target') || '/pos';
    const targetUrl = 'http://127.0.0.1:3000' + (targetRoute.startsWith('/') ? '' : '/') + targetRoute;

    async function checkServer() {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/server/info', { method: 'GET', cache: 'no-store' });
        if (res.status === 200) {
          document.getElementById('status-text').textContent = 'Connected! Opening POS Till...';
          document.getElementById('hint-text').textContent = 'Redirecting to ' + targetRoute;
          setTimeout(() => {
            window.location.replace(targetUrl);
          }, 300);
          return true;
        }
      } catch(e) {}
      return false;
    }


    async function attemptConnect() {
      attempts++;
      const ok = await checkServer();
      if (!ok) {
        if (attempts > 8) {
          document.getElementById('status-text').textContent = 'Starting Local Server...';
          document.getElementById('hint-text').textContent = 'Initializing engine. Please wait...';
          document.getElementById('retry-btn').style.display = 'inline-block';
        }
        setTimeout(attemptConnect, 900);
      }
    }

    attemptConnect();
  </script>
</body>
</html>
`;

const outPath = path.resolve(__dirname, '../resources/splash.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Written splash.html to:', outPath);
