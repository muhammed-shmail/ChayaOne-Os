const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'renderer-log.txt');
fs.writeFileSync(logFile, '--- Starting Renderer Log ---\n');

function log(msg) {
  fs.appendFileSync(logFile, msg + '\n');
  console.log(msg);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log(`[RENDERER LVL ${level}] ${message} (line ${line} in ${sourceId})`);
  });

  // Login via POST
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin@nuro' }),
  });

  const cookieHeaders = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  console.log('Got cookie headers:', cookieHeaders);

  for (const h of cookieHeaders) {
    if (!h) continue;
    const match = h.match(/^([^=]+)=([^;]+)/);
    if (match) {
      await session.defaultSession.cookies.set({
        url: 'http://127.0.0.1:3000',
        name: match[1],
        value: match[2],
        path: '/',
      });
    }
  }

  console.log('Navigating to /dashboard ...');
  await win.loadURL('http://127.0.0.1:3000/dashboard');

  setTimeout(async () => {
    const info = await win.webContents.executeJavaScript(`
      (() => {
        const sections = Array.from(document.querySelectorAll('section'));
        const errors = window.__errors || [];
        return {
          url: window.location.href,
          sectionsCount: sections.length,
          sections: sections.map(s => ({
            tag: s.tagName,
            cls: s.className,
            opacity: window.getComputedStyle(s).opacity,
            visibility: window.getComputedStyle(s).visibility,
            rect: s.getBoundingClientRect(),
            text: s.innerText?.substring(0, 30)
          })),
          overviewGrid: (() => {
            const g = document.querySelector('.grid.grid-cols-2');
            if (!g) return 'NO GRID FOUND';
            return {
              cls: g.className,
              children: g.children.length,
              childStyles: Array.from(g.children).map(c => ({
                tag: c.tagName,
                cls: c.className,
                opacity: window.getComputedStyle(c).opacity,
                display: window.getComputedStyle(c).display,
                h: c.getBoundingClientRect().height,
                text: c.innerText?.substring(0, 30)
              }))
            };
          })()
        };
      })()
    `);
    log('DASHBOARD DOM INFO: ' + JSON.stringify(info, null, 2));

    app.quit();
    process.exit(0);
  }, 3000);
});
