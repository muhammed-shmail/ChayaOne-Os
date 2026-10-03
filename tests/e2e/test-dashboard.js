const http = require('http');

async function test() {
  const loginData = JSON.stringify({ username: 'admin', password: 'admin@nuro' });
  const loginReq = http.request('http://127.0.0.1:3000/api/auth/login/password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData),
    },
  }, (res) => {
    const cookies = res.headers['set-cookie'];
    const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

    http.get('http://127.0.0.1:3000/dashboard', {
      headers: { Cookie: cookieHeader },
    }, (dashRes) => {
      let body = '';
      dashRes.on('data', chunk => body += chunk);
      dashRes.on('end', () => {
        const idx = body.indexOf('role="tablist"');
        console.log('--- HTML SNIPPET AFTER TABLIST (3000 chars) ---');
        console.log(body.substring(idx, idx + 3000));
      });
    });
  });

  loginReq.write(loginData);
  loginReq.end();
}

test().catch(console.error);
