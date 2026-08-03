"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { workerEndpoints } from "@/lib/api";
import { lamportsToSol } from "@/utils/convert";
import dynamic from "next/dynamic";
import { Task } from "@/types/worker";
import { TaskDetailView } from "@/components/worker/TaskDetailView";

// Import all icons dynamically to prevent hydration
const Clock = dynamic(
  () => import("lucide-react").then((mod) => ({ default: mod.Clock })),
  { ssr: false },
);
const CheckCircle = dynamic(
  () => import("lucide-react").then((mod) => ({ default: mod.CheckCircle })),
  { ssr: false },
);
const DollarSign = dynamic(
  () => import("lucide-react").then((mod) => ({ default: mod.DollarSign })),
  { ssr: false },
);
const Eye = dynamic(
  () => import("lucide-react").then((mod) => ({ default: mod.Eye })),
  { ssr: false },
);
const Calendar = dynamic(
  () => import("lucide-react").then((mod) => ({ default: mod.Calendar })),
  { ssr: false },
);

// Import CountdownTimer dynamically
const CountdownTimer = dynamic(
  () =>
    import("@/components/CountdownTimer").then((mod) => ({
      default: mod.CountdownTimer,
    })),
  { ssr: false },
);

// Import Toast dynamically as well
const ToastContainer = dynamic(
  () =>
    import("@/components/Toast").then((mod) => ({
      default: mod.ToastContainer,
    })),
  { ssr: false },
);

// Client-only component wrapper to prevent hydration issues
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Worker
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Tasks
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Manage your available and completed tasks.
            </p>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
              >
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
                <div className="flex justify-between">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

interface WorkerTasksProps {
  onTaskSelect?: (task: Task) => void;
}

export const WorkerTasksContent = ({ onTaskSelect }: WorkerTasksProps) => {
  const [activeTab, setActiveTab] = useState<"available" | "completed">(
    "available",
  );
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const fetchAvailableTasks = useCallback(async () => {
    try {
      const task = await workerEndpoints.nextTask();

      if (!task) {
        setAvailableTasks([]);
        return;
      }

      setAvailableTasks([
        {
          id: task.id,
          title: task.title,
          description: "Select the best option for this task",
          // The backend now reports the worker's share directly, so the
          // frontend no longer has to know the 100-submission divisor.
          amount: lamportsToSol(task.rewardLamports).toString(),
          status: "available",
          createdAt: task.createdAt,
          expiresAt: task.expiresAt ?? undefined,
          options: task.options,
        },
      ]);
    } catch (error) {
      console.error("Error fetching available tasks:", error);
      setAvailableTasks([]);
    }
  }, []);

  const fetchCompletedTasks = useCallback(async () => {
    try {
      const submissions = await workerEndpoints.submissions();

      setCompletedTasks(
        submissions.map((submission: any) => ({
          id: submission.task_id,
          title: submission.task_title,
          description: "Completed task",
          amount: lamportsToSol(submission.amount).toString(),
          status: "completed" as const,
          // Real submission timestamp — this used to be `new Date()`, so every
          // completed task claimed to have been done just now.
          createdAt: submission.created_at,
          expiresAt: undefined,
        })),
      );
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      setCompletedTasks([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchAvailableTasks(), fetchCompletedTasks()]);
    setLoading(false);
  }, [fetchAvailableTasks, fetchCompletedTasks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleTaskClick = (task: Task) => {
    if (task.status === "available") {
      setSelectedTask(task);
      onTaskSelect?.(task);
    }
  };

  const handleBackToTasks = () => {
    setSelectedTask(null);
  };

  const handleSubmitTask = useCallback(
    async (taskId: number, selection: number) => {
      const result = await workerEndpoints.submit(taskId, selection);
      showToast(
        result.taskFull
          ? "Submitted — that was the last slot on this task!"
          : "Task submitted successfully!",
        "success",
      );
      setSelectedTask(null);
      await refresh();
    },
    [refresh],
  );

  const TaskCard = ({ task }: { task: Task }) => {
    const isExpired = task.expiresAt && new Date(task.expiresAt) <= new Date();
    const timeRemaining =
      task.expiresAt && !isExpired
        ? Math.max(0, new Date(task.expiresAt).getTime() - Date.now())
        : 0;

    return (
      <div
        className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer ${
          task.status === "available" && !isExpired
            ? "hover:border-[#f97316]"
            : ""
        }`}
        onClick={() => handleTaskClick(task)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <DollarSign className="h-3 w-3 mr-1" />
              {task.amount} SOL
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-1" />
            Created {new Date(task.createdAt).toLocaleDateString()}
          </div>

          {task.status === "available" && task.expiresAt && (
            <div className="flex items-center">
              {isExpired ? (
                <span className="text-xs text-red-600 font-medium">
                  Expired
                </span>
              ) : (
                <div className="flex items-center text-xs text-orange-600">
                  <Clock className="h-3 w-3 mr-1" />
                  <ClientOnly>
                    <CountdownTimer
                      expiresAt={task.expiresAt}
                      onExpire={() => fetchAvailableTasks()}
                      compact={true}
                    />
                  </ClientOnly>
                </div>
              )}
            </div>
          )}

          {task.status === "completed" && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </span>
          )}

          {task.status === "paid" && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Paid
            </span>
          )}

          {task.status === "pending" && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </span>
          )}
        </div>

        {task.status === "available" && !isExpired && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button className="w-full bg-[#f97316] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#ea580c] transition-colors flex items-center justify-center">
              <Eye className="h-4 w-4 mr-2" />
              View Task
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Worker
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Tasks
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Manage your available and completed tasks.
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit mb-6">
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white">
            Available
          </button>
          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Completed
          </button>
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse"
            >
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const currentTasks =
    activeTab === "available" ? availableTasks : completedTasks;

  // Show task detail view if a task is selected
  if (selectedTask) {
    return (
      <ClientOnly>
        <TaskDetailView
          task={selectedTask}
          onBack={handleBackToTasks}
          onSubmit={handleSubmitTask}
        />
      </ClientOnly>
    );
  }

  return (
    <ClientOnly>
      <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Worker
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              Tasks
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Manage your available and completed tasks.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit mb-6">
          <button
            onClick={() => setActiveTab("available")}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "available"
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Available ({availableTasks.length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "completed"
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Completed ({completedTasks.length})
          </button>
        </div>

        {/* Task List */}
        {currentTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              {activeTab === "available" ? (
                <Eye className="h-8 w-8 text-gray-400" />
              ) : (
                <CheckCircle className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === "available"
                ? "No available tasks"
                : "No completed tasks"}
            </h3>
            <p className="text-sm text-gray-500">
              {activeTab === "available"
                ? "Check back later for new tasks to complete"
                : "Complete tasks to see them here"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </ClientOnly>
  );
};
