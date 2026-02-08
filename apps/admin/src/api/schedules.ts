import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Schedule, CreateScheduleInput, UpdateScheduleInput } from '@fooder/shared-types';
import { apiClient } from './client';

export const scheduleKeys = {
  all: ['schedules'] as const,
  detail: (id: string) => ['schedules', id] as const,
};

export function useSchedules() {
  return useQuery({
    queryKey: scheduleKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<{ data: Schedule[] }>('/api/schedules');
      return res.data.data;
    },
  });
}

export function useSchedule(id: string) {
  return useQuery({
    queryKey: scheduleKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Schedule }>(`/api/schedules/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateScheduleInput) => {
      const res = await apiClient.post<{ data: Schedule }>('/api/schedules', input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateScheduleInput }) => {
      const res = await apiClient.put<{ data: Schedule }>(`/api/schedules/${id}`, input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/schedules/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
  });
}
