import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkerView } from '../../components/WorkerView';
import { DashboardView } from '../../components/DashboardView';
import { TasksView } from '../../components/TasksView';
import { Upload } from '../../components/Upload';
import axios from 'axios';
import { BACKEND_URL } from '../../utils';

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
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
const mockLocation = {
  href: '',
  assign: vi.fn(),
  replace: vi.fn(),
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock toast
vi.mock('../../components/Toast', () => ({
  showToast: vi.fn(),
}));

describe('Authentication Redirect Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WorkerView', () => {
    it('should redirect to landing page when no worker token is present', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(<WorkerView />);

      await waitFor(() => {
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should fetch tasks when worker token is present', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      mockedAxios.get.mockResolvedValue({
        data: { 
          id: 1, 
          title: 'Test Task',
          amount: '100000000',
          options: [{ id: 1, image_url: 'test.jpg', task_id: 1 }],
        },
      });

      render(<WorkerView />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: { Authorization: 'Bearer valid-token' },
          })
        );
      });
    });

    it('should redirect on 401 authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 401 },
      });

      render(<WorkerView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should redirect on 403 authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('forbidden-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 403 },
      });

      render(<WorkerView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should handle submission authentication errors', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      mockedAxios.get.mockResolvedValue({
        data: { 
          id: 1, 
          title: 'Test Task',
          amount: '100000000',
          options: [{ id: 1, image_url: 'test.jpg', task_id: 1 }],
        },
      });
      mockedAxios.post.mockRejectedValue({
        response: { status: 401 },
      });

      render(<WorkerView />);

      await waitFor(() => {
        expect(screen.getByText('Test Task')).toBeInTheDocument();
      });

      // Click on an option to trigger submission
      const option = screen.getByRole('img');
      option.click();

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });
  });

  describe('DashboardView', () => {
    it('should redirect on 401 authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 401 },
      });

      render(<DashboardView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should redirect on 403 authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('forbidden-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 403 },
      });

      render(<DashboardView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should load dashboard data with valid token', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      const mockDashboardData = {
        overview: { totalTasks: 5, totalSubmissions: 10 },
        dailyStats: [],
        weeklyStats: [],
        recentActivity: [],
      };
      mockedAxios.get.mockResolvedValue({ data: mockDashboardData });

      render(<DashboardView />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: { Authorization: 'Bearer valid-token' },
          })
        );
      });
    });
  });

  describe('TasksView', () => {
    it('should redirect on 401 authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 401 },
      });

      render(<TasksView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should redirect on 403 authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('forbidden-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 403 },
      });

      render(<TasksView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
        expect(mockLocation.href).toBe('/');
      });
    });

    it('should load tasks with valid token', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      const mockTasks = [{ 
        id: 1, 
        title: 'Test Task',
        amount: '100000000',
        options: [{ id: 1, image_url: 'test.jpg', task_id: 1 }],
        done: false,
        createdAt: '2023-01-01'
      }];
      mockedAxios.get.mockResolvedValue({ data: { tasks: mockTasks } });

      render(<TasksView />);

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: { Authorization: 'Bearer valid-token' },
          })
        );
      });
    });
  });

  describe('Token Cleanup', () => {
    it('should clear both creator and worker tokens on authentication error', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 401 },
      });

      render(<DashboardView />);

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('workerToken');
      });
    });
  });

  describe('Non-Authentication Errors', () => {
    it('should not redirect on non-authentication errors', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      mockedAxios.get.mockRejectedValue({
        response: { status: 500 },
      });

      render(<DashboardView />);

      await waitFor(() => {
        expect(mockLocation.href).toBe('');
        expect(localStorageMock.removeItem).not.toHaveBeenCalled();
      });
    });

    it('should not redirect on network errors', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      render(<DashboardView />);

      await waitFor(() => {
        expect(mockLocation.href).toBe('');
        expect(localStorageMock.removeItem).not.toHaveBeenCalled();
      });
    });
  });
});
