import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Spinner, EmptyState, Button } from '@fooder/shared-ui';
import { ScheduleCard } from '../components/ScheduleCard';
import { apiClient } from '../api/client';
import type { Schedule, ScheduleStatus } from '@fooder/shared-types';

const STATUS_FILTERS: Array<{ label: string; value: ScheduleStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Draft', value: 'draft' },
  { label: 'Closed', value: 'closed' },
];

export function Schedules() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ScheduleStatus | 'all'>('all');

  useEffect(() => {
    apiClient.get<{ data: Schedule[] }>('/api/schedules').then((res) => {
      setSchedules(res.data.data);
      setIsLoading(false);
    });
  }, []);

  const filtered = filter === 'all' ? schedules : schedules.filter((s) => s.status === filter);

  if (isLoading) {
    return <Spinner size="lg" />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
        <Link to="/schedules/new" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" role="link">
          Create Schedule
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setFilter(sf.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === sf.value ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No schedules" description="Create your first schedule to get started." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((schedule) => (
            <ScheduleCard
              key={schedule.scheduleId}
              schedule={schedule}
              onClick={(id) => navigate(`/schedules/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
