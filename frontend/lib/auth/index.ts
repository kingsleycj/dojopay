export { AuthProvider, useAuth, type Mode } from "./AuthProvider";
export { RoleGuard } from "./RoleGuard";

/** Kept as an alias: `Role` reads better at call sites that pick a dashboard. */
export type { Mode as Role } from "./AuthProvider";
