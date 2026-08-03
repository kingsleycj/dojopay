import { afterEach, vi } from "vitest";

/**
 * Global test setup.
 *
 * These are unit tests: no database, no RPC. `lib/prisma` is mocked per test
 * file via `vi.mock`, and anything reaching the network is stubbed explicitly.
 * The previous setup instantiated a real `PrismaClient` and logged on every
 * hook, which produced thousands of lines of noise and attempted a live
 * connection on each run.
 */

afterEach(() => {
  vi.clearAllMocks();
});
