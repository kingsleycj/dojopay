/**
 * Shapes returned by the API. All money values are lamport **strings** — see
 * CLAUDE.md §5. Convert with `utils/convert.ts` only for display.
 */

export type TaskStatus = "OPEN" | "COMPLETED" | "EXPIRED" | "REFUNDED";
export type PayoutStatus = "PROCESSING" | "SUCCESS" | "FAILED";

export interface TaskOption {
  id: number;
  imageUrl: string;
}

export interface CreatorTask {
  id: number;
  title: string;
  amount: string;
  status: TaskStatus;
  totalSubmissions: number;
  maxSubmissions: number;
  createdAt: string;
  expiresAt: string | null;
  options: TaskOption[];
}

export interface WorkerTask {
  id: number;
  title: string;
  amount: string;
  rewardLamports: string;
  expiresAt: string | null;
  createdAt: string;
  totalSubmissions: number;
  maxSubmissions: number;
  options: TaskOption[];
}

/** Unauthenticated payload behind a share link. */
export interface PublicTask {
  id: number;
  title: string;
  status: TaskStatus;
  isOpen: boolean;
  rewardLamports: string;
  totalSubmissions: number;
  maxSubmissions: number;
  spotsRemaining: number;
  expiresAt: string | null;
  createdAt: string;
  previewImages: string[];
}

export interface WorkerBalance {
  pendingAmount: string;
  withdrawnAmount: string;
  lockedAmount: string;
}

export interface LedgerEntry {
  id: string;
  amount: string;
  date: string;
  status: "pending" | "withdrawn";
  taskId?: number;
  taskTitle?: string;
  transactionHash?: string;
}

export interface Pagination {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface WorkerEarnings {
  metrics: { pendingEarnings: string; totalEarned: string; totalWithdrawn: string };
  earnings: LedgerEntry[];
  pagination: Pagination;
}

export interface WorkerDashboard {
  metrics: {
    availableTasks: number;
    completedTasks: number;
    pendingEarnings: string;
    totalEarned: string;
  };
  recentTasks: Array<{
    id: number;
    title: string;
    amount: string;
    status: string;
    createdAt: string;
    expiresAt: string | null;
  }>;
  nextTask: WorkerTask | null;
}

export interface CreatorDashboard {
  overview: {
    totalTasks: number;
    totalSubmissions: number;
    totalSpent: string;
    totalPayouts: string;
    completedTasks: number;
    pendingTasks: number;
    expiredTasks: number;
    averageSubmissionsPerTask: string;
    capacityUtilisation: string;
  };
  dailyStats: Array<{ date: string; tasksCreated: number; submissionsReceived: number }>;
  weeklyStats: Array<{
    weekStart: string;
    weekEnd: string;
    tasksCreated: number;
    submissionsReceived: number;
  }>;
  monthlyStats: Array<{ month: string; tasksCreated: number; submissionsReceived: number }>;
  completionTrend: Array<{ period: string; completionRate: number }>;
  recentActivity: Array<{
    id: number;
    title: string;
    status: TaskStatus;
    createdAt: string;
    expiresAt: string | null;
    amount: string;
    submissions: number;
  }>;
}

export interface CreatorEarnings {
  totalSpent: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  averageTaskCost: string;
  earnings: Array<{
    id: number;
    amount: string;
    date: string;
    status: "paid" | "pending";
    transactionHash?: string;
    taskId: number;
    taskTitle: string;
    workerAddress: string;
  }>;
  metrics: {
    monthlySpent: string;
    weeklySpent: string;
    dailySpent: string;
    totalWorkers: number;
    returningWorkers: number;
    retentionRate: string;
  };
}

export interface TaskResults {
  result: Record<string, { count: number; option: { imageUrl: string } }>;
  taskDetails: {
    id: number;
    title: string;
    status: TaskStatus;
    amount: string;
    totalSubmissions: number;
    maxSubmissions: number;
    createdAt: string;
    expiresAt: string | null;
  };
  submissions: Array<{
    workerId: number;
    workerAddress: string;
    optionId: number;
    amount: string;
    submittedAt: string;
  }>;
}
