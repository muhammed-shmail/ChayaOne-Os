const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const cloudflaredCandidates = [
  path.join(rootDir, 'bin', 'cloudflared.exe'),
  path.join(rootDir, 'local-first', 'platform', 'apps', 'desktop', 'resources', 'bin', 'cloudflared.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', '@cafeosdesktop', 'resources', 'bin', 'cloudflared.exe'),
];

let binary = null;
for (const c of cloudflaredCandidates) {
  if (fs.existsSync(c)) {
    binary = c;
    break;
  }
}

if (!binary) {
  console.error('❌ cloudflared.exe not found in bin/ or desktop resources.');
  process.exit(1);
}

console.log('===========================================================');
console.log('🌐 ChayaOne OS — Customer 4G/5G QR Ordering Tunnel');
console.log('===========================================================');
console.log('Starting Cloudflare Tunnel to port 3000...');

const token = process.env.CLOUDFLARE_TUNNEL_TOKEN || '';
const args = token ? ['tunnel', 'run', '--token', token] : ['tunnel', '--url', 'http://localhost:3000'];

const child = spawn(binary, args, {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

function saveTunnelInfo(url) {
  const info = {
    active: true,
    publicUrl: url,
    qrOrderUrl: `${url}/app?t=`,
    mode: token ? 'token' : 'quick',
    startedAt: new Date().toISOString(),
    targetPort: 3000,
  };

  const targets = [
    path.join(rootDir, 'tunnel-info.json'),
    path.join(rootDir, 'local-first', 'platform', 'tunnel-info.json'),
  ];
  if (process.env.APPDATA) {
    targets.push(path.join(process.env.APPDATA, '@cafeos', 'desktop', 'tunnel-info.json'));
  }

  for (const t of targets) {
    try {
      fs.mkdirSync(path.dirname(t), { recursive: true });
      fs.writeFileSync(t, JSON.stringify(info, null, 2), 'utf8');
    } catch {}
  }
}

let found = false;
function checkOutput(chunk) {
  const text = chunk.toString();
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !found) {
    found = true;
    const url = match[0];
    console.log('\n🎉 =======================================================');
    console.log(`✅ CUSTOMER 4G QR ORDERING IS NOW LIVE!`);
    console.log(`🌍 Public Domain:   ${url}`);
    console.log(`📱 Table Order QR:  ${url}/app?t=<tableToken>`);
    console.log('===========================================================\n');
    console.log('Customers can now scan table QR codes using their own 4G/5G data.');
    console.log('Zero traffic will touch your cafe Wi-Fi router.\n');
    saveTunnelInfo(url);
  }
}

child.stdout.on('data', checkOutput);
child.stderr.on('data', checkOutput);

child.on('close', (code) => {
  console.log(`Tunnel process exited with code ${code}`);
  process.exit(code);
});
