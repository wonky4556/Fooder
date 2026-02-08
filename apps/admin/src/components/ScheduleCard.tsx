import type { Schedule } from '@fooder/shared-types';
import { Card, Badge } from '@fooder/shared-ui';

interface ScheduleCardProps {
  schedule: Schedule;
  onClick: (id: string) => void;
}

const statusVariant = {
  draft: 'warning' as const,
  active: 'success' as const,
  closed: 'default' as const,
};

export function ScheduleCard({ schedule, onClick }: ScheduleCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onClick(schedule.scheduleId)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{schedule.title}</h3>
        <Badge text={schedule.status} variant={statusVariant[schedule.status]} />
      </div>
      <p className="mt-1 text-sm text-gray-500">{schedule.description}</p>
      <div className="mt-2 text-sm text-gray-500">
        <p>{new Date(schedule.startTime).toLocaleString()} - {new Date(schedule.endTime).toLocaleString()}</p>
        <p className="mt-1">{schedule.items.length} item{schedule.items.length !== 1 ? 's' : ''}</p>
      </div>
    </Card>
  );
}
