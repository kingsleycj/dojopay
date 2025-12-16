import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Task Operations - Unit Tests', () => {
  let testUser: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
    
    // Create test user
    testUser = await prisma.user.create({
      data: {
        address: `test_user_${Date.now()}`
      }
    });
  });

  afterEach(async () => {
    await prisma.task.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('Task Creation', () => {
    it('should create task with expiration date', async () => {
      const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const task = await prisma.task.create({
        data: {
          title: 'Test Task with Expiration',
          amount: BigInt(100000000),
          signature: 'test_signature',
          user_id: testUser.id,
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
      const task = await prisma.task.create({
        data: {
          title: 'Test Task without Expiration',
          amount: BigInt(100000000),
          signature: 'test_signature',
          user_id: testUser.id
        }
      });

      expect(task).toBeTruthy();
      expect(task.title).toBe('Test Task without Expiration');
      expect(task.expiresAt).toBeNull();
    });

    it('should set default values correctly', async () => {
      const task = await prisma.task.create({
        data: {
          amount: BigInt(100000000),
          signature: 'test_signature',
          user_id: testUser.id
        }
      });

      expect(task.title).toBe('Select your preferred choice'); // Default title
      expect(task.done).toBe(false); // Default done status
      expect(task.createdAt).toBeTruthy(); // Auto-generated createdAt
    });

    it('should handle BigInt amounts correctly', async () => {
      const amounts = [
        BigInt(50000000),   // 0.05 SOL
        BigInt(100000000),  // 0.1 SOL
        BigInt(250000000),  // 0.25 SOL
        BigInt(1000000000)  // 1 SOL
      ];

      for (const amount of amounts) {
        const task = await prisma.task.create({
          data: {
            title: `Task with ${amount} lamports`,
            amount: amount,
            signature: `signature_${amount}`,
            user_id: testUser.id
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
      testTask = await prisma.task.create({
        data: {
          title: 'Original Task',
          amount: BigInt(100000000),
          signature: 'original_signature',
          user_id: testUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should update task title', async () => {
      const updatedTask = await prisma.task.update({
        where: { id: testTask.id },
        data: { title: 'Updated Title' }
      });

      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.amount).toBe(testTask.amount); // Should remain unchanged
      expect(updatedTask.signature).toBe(testTask.signature); // Should remain unchanged
    });

    it('should update expiration date', async () => {
      const newExpirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      
      const updatedTask = await prisma.task.update({
        where: { id: testTask.id },
        data: { expiresAt: newExpirationDate }
      });

      expect(updatedTask.expiresAt).toEqual(newExpirationDate);
    });

    it('should update both title and expiration date', async () => {
      const newExpirationDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
      
      const updatedTask = await prisma.task.update({
        where: { id: testTask.id },
        data: {
          title: 'Completely Updated Task',
          expiresAt: newExpirationDate
        }
      });

      expect(updatedTask.title).toBe('Completely Updated Task');
      expect(updatedTask.expiresAt).toEqual(newExpirationDate);
    });

    it('should remove expiration date (set to null)', async () => {
      const updatedTask = await prisma.task.update({
        where: { id: testTask.id },
        data: { expiresAt: null }
      });

      expect(updatedTask.expiresAt).toBeNull();
    });
  });

  describe('Task Queries', () => {
    beforeEach(async () => {
      // Create multiple tasks with different properties
      const now = new Date();
      
      await Promise.all([
        // Task expiring soon
        prisma.task.create({
          data: {
            title: 'Expiring Soon',
            amount: BigInt(50000000),
            signature: 'expiring_soon',
            user_id: testUser.id,
            expiresAt: new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes
          }
        }),
        
        // Task with longer expiration
        prisma.task.create({
          data: {
            title: 'Long Expiration',
            amount: BigInt(100000000),
            signature: 'long_expiration',
            user_id: testUser.id,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours
          }
        }),
        
        // Task without expiration
        prisma.task.create({
          data: {
            title: 'No Expiration',
            amount: BigInt(75000000),
            signature: 'no_expiration',
            user_id: testUser.id
          }
        })
      ]);
    });

    it('should find tasks with expiration dates', async () => {
      const tasksWithExpiration = await prisma.task.findMany({
        where: {
          expiresAt: { not: null }
        }
      });

      expect(tasksWithExpiration.length).toBe(2);
      expect(tasksWithExpiration.every(t => t.expiresAt !== null)).toBe(true);
    });

    it('should find tasks without expiration dates', async () => {
      const tasksWithoutExpiration = await prisma.task.findMany({
        where: {
          expiresAt: null
        }
      });

      expect(tasksWithoutExpiration.length).toBe(1);
      expect(tasksWithoutExpiration[0].title).toBe('No Expiration');
    });

    it('should order tasks by expiration date', async () => {
      const tasksOrderedByExpiration = await prisma.task.findMany({
        where: {
          expiresAt: { not: null }
        },
        orderBy: {
          expiresAt: 'asc'
        }
      });

      expect(tasksOrderedByExpiration.length).toBe(2);
      expect(tasksOrderedByExpiration[0].title).toBe('Expiring Soon');
      expect(tasksOrderedByExpiration[1].title).toBe('Long Expiration');
    });

    it('should filter tasks by expiration status', async () => {
      const now = new Date();
      
      // Tasks that are not expired
      const activeTasks = await prisma.task.findMany({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ]
        }
      });

      expect(activeTasks.length).toBe(3); // All tasks should be active
      
      // Simulate expired task
      const pastDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      await prisma.task.create({
        data: {
          title: 'Expired Task',
          amount: BigInt(100000000),
          signature: 'expired',
          user_id: testUser.id,
          expiresAt: pastDate
        }
      });

      const nonExpiredTasks = await prisma.task.findMany({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ]
        }
      });

      expect(nonExpiredTasks.length).toBe(3); // Should not include the expired task
    });
  });

  describe('Task Relationships', () => {
    it('should create task with user relationship', async () => {
      const task = await prisma.task.create({
        data: {
          title: 'Task with User',
          amount: BigInt(100000000),
          signature: 'user_task',
          user_id: testUser.id
        },
        include: {
          user: true
        }
      });

      expect(task.user).toBeTruthy();
      expect(task.user.id).toBe(testUser.id);
      expect(task.user.address).toBe(testUser.address);
    });

    it('should find tasks by user', async () => {
      await prisma.task.create({
        data: {
          title: 'User Task 1',
          amount: BigInt(100000000),
          signature: 'user_task_1',
          user_id: testUser.id
        }
      });

      await prisma.task.create({
        data: {
          title: 'User Task 2',
          amount: BigInt(50000000),
          signature: 'user_task_2',
          user_id: testUser.id
        }
      });

      const userTasks = await prisma.task.findMany({
        where: {
          user_id: testUser.id
        }
      });

      expect(userTasks.length).toBe(2);
      expect(userTasks.every(t => t.user_id === testUser.id)).toBe(true);
    });
  });
});
