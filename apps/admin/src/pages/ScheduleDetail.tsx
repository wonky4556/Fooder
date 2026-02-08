import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spinner, Button, Badge } from '@fooder/shared-ui';
import { apiClient } from '../api/client';
import type { Schedule } from '@fooder/shared-types';

export function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    if (id) {
      apiClient.get<{ data: Schedule }>(`/api/schedules/${id}`).then((res) => {
        setSchedule(res.data.data);
      });
    }
  }, [id]);

  const handleActivate = async () => {
    if (!id) return;
    const res = await apiClient.put<{ data: Schedule }>(`/api/schedules/${id}`, { status: 'active' });
    setSchedule(res.data.data);
  };

  const handleClose = async () => {
    if (!id) return;
    const res = await apiClient.put<{ data: Schedule }>(`/api/schedules/${id}`, { status: 'closed' });
    setSchedule(res.data.data);
  };

  const handleDelete = async () => {
    if (!id) return;
    await apiClient.delete(`/api/schedules/${id}`);
  };

  if (!schedule) {
    return <Spinner size="lg" />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{schedule.title}</h1>
          <p className="mt-1 text-gray-500">{schedule.description}</p>
        </div>
        <Badge text={schedule.status} variant={schedule.status === 'active' ? 'success' : schedule.status === 'draft' ? 'warning' : 'default'} />
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500">
          {new Date(schedule.startTime).toLocaleString()} - {new Date(schedule.endTime).toLocaleString()}
        </p>
        <p className="text-sm text-gray-500">{schedule.pickupInstructions}</p>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2">Name</th>
              <th className="pb-2">Price</th>
              <th className="pb-2">Remaining / Total</th>
            </tr>
          </thead>
          <tbody>
            {schedule.items.map((item) => (
              <tr key={item.menuItemId} className="border-b">
                <td className="py-2">{item.name}</td>
                <td className="py-2">${item.price.toFixed(2)}</td>
                <td className="py-2">{item.remainingQuantity} / {item.totalQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        {schedule.status === 'draft' && (
          <>
            <Button onClick={handleActivate}>Activate</Button>
            <Link to={`/schedules/${schedule.scheduleId}/edit`} className="inline-flex items-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300">
              Edit
            </Link>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </>
        )}
        {schedule.status === 'active' && (
          <Button variant="danger" onClick={handleClose}>Close</Button>
        )}
      </div>
    </div>
  );
}
