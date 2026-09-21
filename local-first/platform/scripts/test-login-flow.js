const puppeteer = require('puppeteer-core');

async function testLogin() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\node.exe', // wait, let's find chrome
    headless: true
  }).catch(() => null);
}
