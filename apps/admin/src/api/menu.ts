import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MenuItem, CreateMenuItemInput, UpdateMenuItemInput } from '@fooder/shared-types';
import { apiClient } from './client';

export const menuKeys = {
  all: ['menu-items'] as const,
  detail: (id: string) => ['menu-items', id] as const,
};

export function useMenuItems() {
  return useQuery({
    queryKey: menuKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<{ data: MenuItem[] }>('/api/menu-items?includeInactive=true');
      return res.data.data;
    },
  });
}

export function useMenuItem(id: string) {
  return useQuery({
    queryKey: menuKeys.detail(id),
    queryFn: async () => {
      const res = await apiClient.get<{ data: MenuItem }>(`/api/menu-items/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMenuItemInput) => {
      const res = await apiClient.post<{ data: MenuItem }>('/api/menu-items', input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuKeys.all }),
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMenuItemInput }) => {
      const res = await apiClient.put<{ data: MenuItem }>(`/api/menu-items/${id}`, input);
      return res.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuKeys.all }),
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/menu-items/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: menuKeys.all }),
  });
}
