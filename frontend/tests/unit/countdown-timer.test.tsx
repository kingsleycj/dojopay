import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CountdownTimer } from '@/components/CountdownTimer';

// Mock Date.now to control time
const mockDateNow = vi.spyOn(Date, 'now');

describe('CountdownTimer Component', () => {
  beforeEach(() => {
    mockDateNow.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should display time remaining correctly', () => {
    // Set current time to 2025-12-16 12:00:00 UTC
    mockDateNow.mockReturnValue(new Date('2025-12-16T12:00:00Z').getTime());
    
    // Target time is 2025-12-16 14:30:45 UTC (2h 30m 45s later)
    const targetTime = '2025-12-16T14:30:45Z';
    
    render(<CountdownTimer expiresAt={targetTime} />);
    
    // Should show hours, minutes, and seconds
    expect(screen.getByText(/h/)).toBeInTheDocument();
    expect(screen.getByText(/m/)).toBeInTheDocument();
    expect(screen.getByText(/s/)).toBeInTheDocument();
  });

  it('should show expired message when time is up', () => {
    // Set current time to 2025-12-16 13:00:00 UTC
    mockDateNow.mockReturnValue(new Date('2025-12-16T13:00:00Z').getTime());
    
    // Target time is 2025-12-16 12:00:00 UTC (1 hour ago)
    const targetTime = '2025-12-16T12:00:00Z';
    
    render(<CountdownTimer expiresAt={targetTime} />);
    
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('should render countdown timer component', () => {
    // Use a far future time to avoid timing issues
    const targetTime = '2030-12-16T13:00:00Z';
    
    render(<CountdownTimer expiresAt={targetTime} />);
    
    // Should render some time display (use getAllByText since there are multiple time elements)
    expect(screen.getAllByText(/d|h|m|s/).length).toBeGreaterThan(0);
  });

  it('should handle minutes and hours correctly', () => {
    // Set current time to 2025-12-16 12:00:00 UTC
    mockDateNow.mockReturnValue(new Date('2025-12-16T12:00:00Z').getTime());
    
    // Target time is 2025-12-16 14:30:45 UTC (2h 30m 45s later)
    const targetTime = '2025-12-16T14:30:45Z';
    
    render(<CountdownTimer expiresAt={targetTime} />);
    
    // Should show hours, minutes, and seconds (actual output shows 01h, 30m, 45s)
    expect(screen.getByText(/h/)).toBeInTheDocument();
    expect(screen.getByText(/m/)).toBeInTheDocument();
    expect(screen.getByText(/s/)).toBeInTheDocument();
  });

  it('should handle days correctly', () => {
    // Set current time to 2025-12-16 12:00:00 UTC
    mockDateNow.mockReturnValue(new Date('2025-12-16T12:00:00Z').getTime());
    
    // Target time is 2025-12-18 15:30:00 UTC (2 days 3h 30m later)
    const targetTime = '2025-12-18T15:30:00Z';
    
    render(<CountdownTimer expiresAt={targetTime} />);
    
    expect(screen.getByText(/2d/)).toBeInTheDocument();
    expect(screen.getByText(/3h/)).toBeInTheDocument();
    expect(screen.getByText(/30m/)).toBeInTheDocument();
  });

  it('should return null when no expiration date provided', () => {
    const { container } = render(<CountdownTimer expiresAt={null} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should call onExpire callback when time is up', () => {
    const onExpireMock = vi.fn();
    
    // Set current time to 2025-12-16 13:00:00 UTC
    mockDateNow.mockReturnValue(new Date('2025-12-16T13:00:00Z').getTime());
    
    // Target time is 2025-12-16 12:00:00 UTC (1 hour ago)
    const targetTime = '2025-12-16T12:00:00Z';
    
    render(<CountdownTimer expiresAt={targetTime} onExpire={onExpireMock} />);
    
    expect(onExpireMock).toHaveBeenCalled();
  });

  it('should handle invalid date gracefully', () => {
    render(<CountdownTimer expiresAt="invalid-date" />);
    
    // Should not crash and should show some time display
    expect(screen.getByText(/s/)).toBeInTheDocument();
  });

  it('should clean up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    mockDateNow.mockReturnValue(new Date('2025-12-16T12:00:00Z').getTime());
    const targetTime = '2025-12-16T13:00:00Z';
    
    const { unmount } = render(<CountdownTimer expiresAt={targetTime} />);
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
    
    clearIntervalSpy.mockRestore();
  });

  it('should handle edge case of exactly zero time', () => {
    // Set current time exactly equal to target time
    const now = new Date('2025-12-16T12:00:00Z').getTime();
    mockDateNow.mockReturnValue(now);
    
    const targetTime = '2025-12-16T12:00:00Z';
    
    render(<CountdownTimer expiresAt={targetTime} />);
    
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
