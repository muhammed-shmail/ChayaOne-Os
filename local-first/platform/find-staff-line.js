const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.resolve(__dirname, 'apps/web/app/dashboard/DashboardClient.tsx'), 'utf-8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes("activeMenu === 'staff'")) {
    console.log(i + 1, l);
  }
});
