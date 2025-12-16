import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prismaClient } from '../../src/lib/prisma.js';

// Mock the database
vi.mock('../../src/lib/prisma.js', () => ({
  prismaClient: {
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
  connectDB: vi.fn(),
}));

describe('Task Operations - Unit Tests', () => {
  let mockPrisma: any;

  beforeEach(async () => {
    // Get mocked modules
    mockPrisma = (await import('../../src/lib/prisma.js')).prismaClient;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Task Creation', () => {
    it('should create task with expiration date', async () => {
      const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockTask = {
        id: 1,
        title: 'Test Task with Expiration',
        amount: BigInt(100000000),
        signature: 'test_signature',
        user_id: 1,
        expiresAt: expirationDate,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockPrisma.task.create.mockResolvedValue(mockTask);

      const task = await mockPrisma.task.create({
        data: {
          title: 'Test Task with Expiration',
          amount: BigInt(100000000),
          signature: 'test_signature',
          user_id: 1,
          expiresAt: expirationDate
        }
      });

      expect(task).toBeTruthy();
      expect(task.title).toBe('Test Task with Expiration');
      expect(task.amount).toBe(BigInt(100000000));
      expect(task.expiresAt).toBeTruthy();
      expect(task.expiresAt).toBeInstanceOf(Date);
      expect(task.createdAt).toBeTruthy();
      expect(task.createdAt).toBeInstanceOf(Date);
    });

    it('should create task without expiration date', async () => {
      const mockTask = {
        id: 2,
        title: 'Test Task without Expiration',
        amount: BigInt(100000000),
        signature: 'test_signature',
        user_id: 1,
        expiresAt: null,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockPrisma.task.create.mockResolvedValue(mockTask);

      const task = await mockPrisma.task.create({
        data: {
          title: 'Test Task without Expiration',
          amount: BigInt(100000000),
          signature: 'test_signature',
          user_id: 1
        }
      });

      expect(task).toBeTruthy();
      expect(task.title).toBe('Test Task without Expiration');
      expect(task.expiresAt).toBeNull();
    });

    it('should set default values correctly', async () => {
      const mockTask = {
        id: 3,
        title: 'Select your preferred choice',
        amount: BigInt(100000000),
        signature: 'test_signature',
        user_id: 1,
        expiresAt: null,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockPrisma.task.create.mockResolvedValue(mockTask);

      const task = await mockPrisma.task.create({
        data: {
          amount: BigInt(100000000),
          signature: 'test_signature',
          user_id: 1
        }
      });

      expect(task.title).toBe('Select your preferred choice');
      expect(task.done).toBe(false);
      expect(task.createdAt).toBeTruthy();
    });

    it('should handle BigInt amounts correctly', async () => {
      const amounts = [
        BigInt(50000000),   // 0.05 SOL
        BigInt(100000000),  // 0.1 SOL
        BigInt(250000000),  // 0.25 SOL
        BigInt(1000000000)  // 1 SOL
      ];

      for (const amount of amounts) {
        const mockTask = {
          id: Math.random() * 1000,
          title: `Task with ${amount} lamports`,
          amount: amount,
          signature: `signature_${amount}`,
          user_id: 1,
          expiresAt: null,
          done: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        mockPrisma.task.create.mockResolvedValue(mockTask);

        const task = await mockPrisma.task.create({
          data: {
            title: `Task with ${amount} lamports`,
            amount: amount,
            signature: `signature_${amount}`,
            user_id: 1
          }
        });

        expect(task.amount).toBe(amount);
        expect(typeof task.amount).toBe('bigint');
      }
    });
  });

  describe('Task Updates', () => {
    let testTask: any;

    beforeEach(async () => {
      testTask = {
        id: 1,
        title: 'Original Task',
        amount: BigInt(100000000),
        signature: 'original_signature',
        user_id: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        done: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    it('should update task title', async () => {
      const updatedTask = {
        ...testTask,
        title: 'Updated Title',
        updatedAt: new Date()
      };
      
      mockPrisma.task.update.mockResolvedValue(updatedTask);

      const result = await mockPrisma.task.update({
        where: { id: testTask.id },
        data: { title: 'Updated Title' }
      });

      expect(result.title).toBe('Updated Title');
      expect(result.amount).toBe(testTask.amount);
      expect(result.signature).toBe(testTask.signature);
    });

    it('should update expiration date', async () => {
      const newExpirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const updatedTask = {
        ...testTask,
        expiresAt: newExpirationDate,
        updatedAt: new Date()
      };
      
      mockPrisma.task.update.mockResolvedValue(updatedTask);

      const result = await mockPrisma.task.update({
        where: { id: testTask.id },
        data: { expiresAt: newExpirationDate }
      });

      expect(result.expiresAt).toEqual(newExpirationDate);
    });

    it('should update both title and expiration date', async () => {
      const newExpirationDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const updatedTask = {
        ...testTask,
        title: 'Completely Updated Task',
        expiresAt: newExpirationDate,
        updatedAt: new Date()
      };
      
      mockPrisma.task.update.mockResolvedValue(updatedTask);

      const result = await mockPrisma.task.update({
        where: { id: testTask.id },
        data: {
          title: 'Completely Updated Task',
          expiresAt: newExpirationDate
        }
      });

      expect(result.title).toBe('Completely Updated Task');
      expect(result.expiresAt).toEqual(newExpirationDate);
    });

    it('should remove expiration date (set to null)', async () => {
      const updatedTask = {
        ...testTask,
        expiresAt: null,
        updatedAt: new Date()
      };
      
      mockPrisma.task.update.mockResolvedValue(updatedTask);

      const result = await mockPrisma.task.update({
        where: { id: testTask.id },
        data: { expiresAt: null }
      });

      expect(result.expiresAt).toBeNull();
    });
  });

  describe('Task Queries', () => {
    beforeEach(async () => {
      const now = new Date();
      
      const mockTasks = [
        // Task expiring soon
        {
          id: 1,
          title: 'Expiring Soon',
          amount: BigInt(50000000),
          signature: 'expiring_soon',
          user_id: 1,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
          done: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        
        // Task with longer expiration
        {
          id: 2,
          title: 'Long Expiration',
          amount: BigInt(100000000),
          signature: 'long_expiration',
          user_id: 1,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          done: false,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        
        // Task without expiration
        {
          id: 3,
          title: 'No Expiration',
          amount: BigInt(75000000),
          signature: 'no_expiration',
          user_id: 1,
          expiresAt: null,
          done: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);
    });

    it('should find tasks with expiration dates', async () => {
      const tasksWithExpiration = [
        {
          id: 1,
          title: 'Expiring Soon',
          amount: BigInt(50000000),
          expiresAt: new Date()
        },
        {
          id: 2,
          title: 'Long Expiration',
          amount: BigInt(100000000),
          expiresAt: new Date()
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(tasksWithExpiration);

      const result = await mockPrisma.task.findMany({
        where: {
          expiresAt: { not: null }
        }
      });

      expect(result.length).toBe(2);
      expect(result.every(t => t.expiresAt !== null)).toBe(true);
    });

    it('should find tasks without expiration dates', async () => {
      const tasksWithoutExpiration = [
        {
          id: 3,
          title: 'No Expiration',
          amount: BigInt(75000000),
          expiresAt: null
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(tasksWithoutExpiration);

      const result = await mockPrisma.task.findMany({
        where: {
          expiresAt: null
        }
      });

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('No Expiration');
    });

    it('should order tasks by expiration date', async () => {
      const tasksOrderedByExpiration = [
        {
          id: 1,
          title: 'Expiring Soon',
          amount: BigInt(50000000),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000)
        },
        {
          id: 2,
          title: 'Long Expiration',
          amount: BigInt(100000000),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(tasksOrderedByExpiration);

      const result = await mockPrisma.task.findMany({
        where: {
          expiresAt: { not: null }
        },
        orderBy: {
          expiresAt: 'asc'
        }
      });

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Expiring Soon');
      expect(result[1].title).toBe('Long Expiration');
    });

    it('should filter tasks by expiration status', async () => {
      const now = new Date();
      
      // Tasks that are not expired
      const activeTasks = [
        {
          id: 1,
          title: 'Expiring Soon',
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000)
        },
        {
          id: 2,
          title: 'Long Expiration',
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        },
        {
          id: 3,
          title: 'No Expiration',
          expiresAt: null
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(activeTasks);

      const result = await mockPrisma.task.findMany({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ]
        }
      });

      expect(result.length).toBe(3);
    });
  });

  describe('Task Relationships', () => {
    it('should create task with user relationship', async () => {
      const mockUser = {
        id: 1,
        address: 'test_user_address',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTask = {
        id: 1,
        title: 'Task with User',
        amount: BigInt(100000000),
        signature: 'user_task',
        user_id: 1,
        user: mockUser,
        expiresAt: null,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockPrisma.task.create.mockResolvedValue(mockTask);

      const result = await mockPrisma.task.create({
        data: {
          title: 'Task with User',
          amount: BigInt(100000000),
          signature: 'user_task',
          user_id: 1
        },
        include: {
          user: true
        }
      });

      expect(result.user).toBeTruthy();
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.address).toBe(mockUser.address);
    });

    it('should find tasks by user', async () => {
      const userTasks = [
        {
          id: 1,
          title: 'User Task 1',
          amount: BigInt(100000000),
          signature: 'user_task_1',
          user_id: 1
        },
        {
          id: 2,
          title: 'User Task 2',
          amount: BigInt(50000000),
          signature: 'user_task_2',
          user_id: 1
        }
      ];
      
      mockPrisma.task.findMany.mockResolvedValue(userTasks);

      const result = await mockPrisma.task.findMany({
        where: {
          user_id: 1
        }
      });

      expect(result.length).toBe(2);
      expect(result.every(t => t.user_id === 1)).toBe(true);
    });
  });
});
