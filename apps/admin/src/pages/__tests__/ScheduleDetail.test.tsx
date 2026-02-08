import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { createTestWrapper } from '../../test-utils/wrapper';
import { ScheduleDetail } from '../ScheduleDetail';

const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { displayName: 'Admin', email: 'admin@test.com', role: 'admin', userId: 'u1', tenantId: 'DEFAULT' },
    isAuthenticated: true,
    isLoading: false,
    signOutUser: vi.fn(),
  }),
}));

const draftSchedule = {
  scheduleId: '1', title: 'Lunch', description: 'Lunch menu', status: 'draft',
  pickupInstructions: 'Front desk', startTime: '2026-03-01T12:00:00Z', endTime: '2026-03-01T14:00:00Z',
  items: [{ menuItemId: 'm1', name: 'Burger', price: 9.99, totalQuantity: 10, remainingQuantity: 8 }],
};

const activeSchedule = { ...draftSchedule, status: 'active' };

describe('ScheduleDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders schedule info with items and remaining quantities', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: draftSchedule } });
    render(
      <Routes><Route path="/schedules/:id" element={<ScheduleDetail />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/1']) },
    );
    await waitFor(() => {
      expect(screen.getByText('Lunch')).toBeInTheDocument();
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('8 / 10')).toBeInTheDocument();
    });
  });

  it('shows Activate button for draft schedules', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: draftSchedule } });
    render(
      <Routes><Route path="/schedules/:id" element={<ScheduleDetail />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/1']) },
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument();
    });
  });

  it('Activate button calls update API with active status', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: draftSchedule } });
    mockPut.mockResolvedValueOnce({ data: { data: { ...draftSchedule, status: 'active' } } });
    render(
      <Routes><Route path="/schedules/:id" element={<ScheduleDetail />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/1']) },
    );
    await waitFor(() => expect(screen.getByText('Lunch')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /activate/i }));
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/schedules/1', { status: 'active' });
    });
  });

  it('shows Close button for active schedules', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: activeSchedule } });
    render(
      <Routes><Route path="/schedules/:id" element={<ScheduleDetail />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/1']) },
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  it('shows Edit and Delete buttons for draft schedules only', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: draftSchedule } });
    render(
      <Routes><Route path="/schedules/:id" element={<ScheduleDetail />} /></Routes>,
      { wrapper: createTestWrapper(['/schedules/1']) },
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });
});
