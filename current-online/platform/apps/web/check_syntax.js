const fs = require('fs');
const lines = fs.readFileSync('app/dashboard/components/SettingsCenter.tsx', 'utf-8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('auditPage') || l.includes('auditTotal')) {
    console.log('L' + (i+1) + ': ' + l.trim().substring(0, 120));
  }
});
