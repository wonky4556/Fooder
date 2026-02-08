import { Link } from 'react-router-dom';
import { Card } from '@fooder/shared-ui';

export function Dashboard() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold text-gray-800">Dashboard</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/menu-items">
          <Card title="Menu Items" description="Create and manage your food menu." />
        </Link>
        <Link to="/schedules">
          <Card title="Schedules" description="Set up ordering schedules for your customers." />
        </Link>
      </div>
    </div>
  );
}
