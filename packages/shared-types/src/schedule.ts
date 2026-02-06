export type ScheduleStatus = 'draft' | 'active' | 'closed';

export interface ScheduleItem {
  menuItemId: string;
  name: string;
  price: number;
  totalQuantity: number;
  remainingQuantity: number;
}

export interface Schedule {
  tenantId: string;
  scheduleId: string;
  title: string;
  description: string;
  pickupInstructions: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  items: ScheduleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  title: string;
  description: string;
  pickupInstructions: string;
  startTime: string;
  endTime: string;
  items: {
    menuItemId: string;
    totalQuantity: number;
  }[];
}

export interface UpdateScheduleInput {
  title?: string;
  description?: string;
  pickupInstructions?: string;
  startTime?: string;
  endTime?: string;
  status?: ScheduleStatus;
}
