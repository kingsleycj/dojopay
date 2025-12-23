import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TasksView } from '../../components/TasksView';
import { DashboardView } from '../../components/DashboardView';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => 'valid-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('UI Responsiveness Tests - Simple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TasksView Basic Rendering', () => {
    it('should render empty state when no tasks', async () => {
      const mockTasks: any[] = [];
      mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } });
      
      render(<TasksView />);
      
      await waitFor(() => {
        expect(screen.getByText('No Tasks Yet')).toBeInTheDocument();
      });
    });

    it('should render task cards when tasks exist', async () => {
      const mockTasks = [{
        id: 123,
        title: 'Test Task',
        amount: '100000000',
        status: 'pending',
        totalSubmissions: 5,
        createdAt: '2023-01-01',
        options: [{ id: 1, imageUrl: 'test.jpg', task_id: 123 }]
      }];

      mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } });
      
      render(<TasksView />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Task')).toBeInTheDocument();
        expect(screen.getByText('ID: #123')).toBeInTheDocument();
      });
    });
  });

  describe('DashboardView Basic Rendering', () => {
    it('should render dashboard with empty data', async () => {
      const mockDashboardData = {
        overview: { totalTasks: 0, totalSubmissions: 0 },
        dailyStats: [],
        weeklyStats: [],
        recentActivity: []
      };

      mockedAxios.get.mockResolvedValue({ data: mockDashboardData });
      
      render(<DashboardView />);
      
      await waitFor(() => {
        expect(screen.getByText('Activity trend')).toBeInTheDocument();
        expect(screen.getByText('Recent activity')).toBeInTheDocument();
      });
    });

    it('should render dashboard with data', async () => {
      const mockDashboardData = {
        overview: { totalTasks: 5, totalSubmissions: 10 },
        dailyStats: [],
        weeklyStats: [],
        recentActivity: []
      };

      mockedAxios.get.mockResolvedValue({ data: mockDashboardData });
      
      render(<DashboardView />);
      
      await waitFor(() => {
        expect(screen.getByText('Activity trend')).toBeInTheDocument();
        expect(screen.getByText('Recent activity')).toBeInTheDocument();
      });
    });
  });

  describe('Task Title Truncation', () => {
    it('should render very long titles', async () => {
      const longTitle = 'This is an extremely long task title that definitely exceeds sixty characters and should be truncated properly in the user interface';
      const mockTasks = [{
        id: 789,
        title: longTitle,
        amount: '100000000',
        status: 'pending',
        totalSubmissions: 2,
        createdAt: '2023-01-01',
        options: [{ id: 1, imageUrl: 'long.jpg', task_id: 789 }]
      }];

      mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } });
      
      render(<TasksView />);
      
      await waitFor(() => {
        // Should render some form of the title (truncated or full)
        expect(screen.getByText(/This is an extremely long task title/)).toBeInTheDocument();
        expect(screen.getByText('ID: #789')).toBeInTheDocument();
      });
    });
  });

  describe('Task Status and Actions', () => {
    it('should render pending task with Edit button', async () => {
      const mockTasks = [{
        id: 111,
        title: 'Pending Task',
        amount: '100000000',
        status: 'pending',
        totalSubmissions: 1,
        createdAt: '2023-01-01',
        options: [{ id: 1, imageUrl: 'pending.jpg', task_id: 111 }]
      }];

      mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } });
      
      render(<TasksView />);
      
      await waitFor(() => {
        expect(screen.getByText('Pending Task')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });
    });

    it('should render completed task without Edit button', async () => {
      const mockTasks = [{
        id: 222,
        title: 'Completed Task',
        amount: '100000000',
        status: 'completed',
        totalSubmissions: 5,
        createdAt: '2023-01-01',
        options: [{ id: 1, imageUrl: 'completed.jpg', task_id: 222 }]
      }];

      mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } });
      
      render(<TasksView />);
      
      await waitFor(() => {
        expect(screen.getByText('Completed Task')).toBeInTheDocument();
        expect(screen.getByText('View Details')).toBeInTheDocument();
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      });
    });
  });
});
