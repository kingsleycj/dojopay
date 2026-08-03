/**
 * Shapes returned by the API. All money values are lamport **strings** — see
 * CLAUDE.md §5. Convert with `utils/convert.ts` only for display.
 */

export type TaskStatus =
  | "OPEN"
  | "COMPLETED"
  | "EXPIRED"
  | "REFUNDED"
  | "FORCE_CLOSED";

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "BANNED";
export type AuthProvider = "EMAIL" | "GOOGLE" | "WALLET";
export type AdminRole = "OWNER" | "ADMIN" | "ANALYST";
export type AuditSeverity = "INFO" | "NOTICE" | "WARNING" | "CRITICAL";

/**
 * The signed-in person. One account covers both creator and worker modes —
 * `roles` says which profiles exist, and they are created on first use.
 */
export interface Account {
  id: number;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  walletLinkedAt: string | null;
  status: AccountStatus;
  signupProvider: AuthProvider;
  hasPassword: boolean;
  hasGoogle: boolean;
  /** False until a wallet is linked; drives the withdrawal prompt. */
  canWithdraw: boolean;
  roles: { creator: boolean; worker: boolean };
  preferences: AccountPreferences;
  createdAt: string;
  lastLoginAt: string | null;
}

export type AccountMode = "CREATOR" | "WORKER";

export interface AccountPreferences {
  /** Which surface to land on after signing in. */
  defaultMode: AccountMode;
  notifyTaskActivity: boolean;
  notifyPayouts: boolean;
  notifyProductNews: boolean;
}

/**
 * A creator's balance of platform-held SOL.
 *
 * `available` is spendable on a task or withdrawable; `reserved` is committed to
 * tasks still accepting submissions and is neither. `total` is what the account
 * owns.
 */
export interface Vault {
  available: string;
  reserved: string;
  total: string;
  totalDeposited: string;
  totalWithdrawn: string;
  totalSpent: string;
  /** Zero below the network-fee floor, so the UI never offers an impossible action. */
  withdrawable: string;
  minimumDeposit: string;
  minimumWithdrawal: string;
  updatedAt: string;
}

export type VaultEntryType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TASK_FUNDED"
  | "TASK_REFUND"
  | "REWARD_RELEASED";

export type VaultEntryStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface VaultEntry {
  id: number;
  type: VaultEntryType;
  status: VaultEntryStatus;
  amount: string;
  availableAfter: string;
  reservedAfter: string;
  signature: string | null;
  taskId: number | null;
  taskTitle: string | null;
  description: string | null;
  createdAt: string;
  /** Whether this changed what the account owns, or only moved it internally. */
  direction: "in" | "out" | "internal";
}

export interface VaultStatement {
  vault: Vault;
  entries: VaultEntry[];
  pagination: Pagination;
}

/** Server-computed budget arithmetic, so the composer never guesses at rounding. */
export interface BudgetQuote {
  budget: string;
  committed: string;
  remainder: string;
  rewardPerSubmission: string;
  maxSubmissions: number;
}

export interface AuthResponse {
  account: Account;
  token: string;
  expiresIn: string;
  isNewAccount?: boolean;
}

export interface AdminSession {
  token: string;
  expiresIn: string;
  admin: { id: number; email: string; displayName: string; role: AdminRole };
}

export interface AdminOverview {
  accounts: {
    total: number;
    newToday: number;
    newThisWeek: number;
    suspended: number;
    withWallet: number;
    walletLinkRate: string;
  };
  tasks: { total: number; open: number };
  work: { totalSubmissions: number; submissionsToday: number };
  money: {
    totalPaidOutLamports: string;
    payoutCount: number;
    failedPayouts: number;
    outstandingLiabilityLamports: string;
  };
  recentSignups: Array<{
    id: number;
    email: string | null;
    displayName: string | null;
    walletAddress: string | null;
    signupProvider: AuthProvider;
    status: AccountStatus;
    createdAt: string;
  }>;
  criticalEvents: AuditEntry[];
}

export interface AuditEntry {
  id: number;
  actorType: "ACCOUNT" | "ADMIN" | "SYSTEM";
  action: string;
  severity: AuditSeverity;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actorAccount?: {
    id: number;
    email: string | null;
    displayName: string | null;
    walletAddress: string | null;
  } | null;
  actorAdmin?: { id: number; email: string; displayName: string; role?: AdminRole } | null;
}

export interface AdminAuditPage {
  entries: AuditEntry[];
  pagination: Pagination;
}

export interface AdminAccountSummary {
  id: number;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  walletAddress: string | null;
  signupProvider: AuthProvider;
  status: AccountStatus;
  createdAt: string;
  lastLoginAt: string | null;
  creatorProfile: { id: number; _count: { tasks: number } } | null;
  workerProfile: {
    id: number;
    pending_amount: string;
    withdrawn_amount: string;
    _count: { submissions: number };
  } | null;
}

export interface AdminAccountList {
  accounts: AdminAccountSummary[];
  pagination: Pagination;
}

export interface AdminAccountDetail extends Omit<AdminAccountSummary, "creatorProfile" | "workerProfile"> {
  hasPassword: boolean;
  hasGoogle: boolean;
  statusReason: string | null;
  referredBy: string | null;
  creatorProfile: {
    id: number;
    tasks: Array<{
      id: number;
      title: string;
      status: TaskStatus;
      amount: string;
      submissionCount: number;
      createdAt: string;
    }>;
  } | null;
  workerProfile: {
    id: number;
    pending_amount: string;
    withdrawn_amount: string;
    submissions: Array<{
      id: number;
      amount: string;
      createdAt: string;
      task: { id: number; title: string };
    }>;
    payouts: Array<{
      id: number;
      amount: string;
      signature: string;
      status: string;
      createdAt: string;
    }>;
  } | null;
}
export type PayoutStatus = "PROCESSING" | "SUCCESS" | "FAILED";

export interface TaskOption {
  id: number;
  imageUrl: string;
}

export interface CreatorTask {
  id: number;
  title: string;
  amount: string;
  rewardPerSubmission: string;
  status: TaskStatus;
  totalSubmissions: number;
  maxSubmissions: number;
  spotsRemaining: number;
  /** Still committed to workers who have not answered yet. */
  reservedRemaining: string;
  spent: string;
  refundedAmount: string;
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
  spotsRemaining: number;
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
    /** What clearing the whole queue would pay. */
    availableValue: string;
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
  queue: WorkerTask[];
}

export interface CreatorDashboard {
  overview: {
    totalTasks: number;
    totalSubmissions: number;
    totalSpent: string;
    totalCommitted: string;
    totalRefunded: string;
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
  monthlyStats: Array<{
    month: string;
    tasksCreated: number;
    submissionsReceived: number;
    capacity: number;
  }>;
  vault: Vault | null;
  completionTrend: Array<{ period: string; completionRate: number }>;
  recentActivity: Array<{
    id: number;
    title: string;
    status: TaskStatus;
    createdAt: string;
    expiresAt: string | null;
    amount: string;
    rewardPerSubmission: string;
    submissions: number;
    maxSubmissions: number;
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
    rewardPerSubmission: string;
    totalSubmissions: number;
    maxSubmissions: number;
    spotsRemaining: number;
    spent: string;
    refundedAmount: string;
    vaultFunded: boolean;
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
