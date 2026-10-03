import ServerDashboardClient from './ServerDashboardClient';

export const metadata = {
  title: 'Server & Background Services — ChayaOne OS',
  description: 'Main PC local server diagnostics, database health, printer spooler, and commercial licensing.',
};

export default function ServerDashboardPage() {
  return <ServerDashboardClient />;
}
