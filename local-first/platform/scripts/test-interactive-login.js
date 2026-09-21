const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 800 });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER LVL ${level}] ${message} (${sourceId}:${line})`);
  });

  console.log('Loading /login ...');
  await win.loadURL('http://127.0.0.1:3000/login');

  await new Promise((r) => setTimeout(r, 2000));

  console.log('Interacting with login form...');
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      // Find username and password inputs
      const inputs = document.querySelectorAll('input');
      const submitBtn = document.querySelector('button[type="submit"]');
      
      console.log('Inputs found:', inputs.length, 'Submit btn found:', !!submitBtn);

      const usernameInput = Array.from(inputs).find(i => i.getAttribute('autocomplete') === 'username' || i.placeholder?.toLowerCase().includes('username'));
      const passwordInput = Array.from(inputs).find(i => i.type === 'password' || i.placeholder?.toLowerCase().includes('password'));

      if (!usernameInput || !passwordInput || !submitBtn) {
        return { error: 'Elements not found', inputsCount: inputs.length, hasBtn: !!submitBtn, html: document.body.innerHTML.substring(0, 500) };
      }

      // Simulate typing using React-compatible setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(usernameInput, 'owner');
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));

      nativeInputValueSetter.call(passwordInput, 'cafe1234');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(r => setTimeout(r, 500));

      console.log('Username val:', usernameInput.value, 'Password val:', passwordInput.value, 'Submit disabled:', submitBtn.disabled);

      submitBtn.click();
      return { clicked: true, username: usernameInput.value, passwordLen: passwordInput.value.length };
    })()
  `);

  console.log('Script execution result:', result);

  await new Promise((r) => setTimeout(r, 4000));

  const afterState = await win.webContents.executeJavaScript(`
    (() => {
      return {
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 400)
      };
    })()
  `);
  console.log('After state:', afterState);

  app.quit();
});
