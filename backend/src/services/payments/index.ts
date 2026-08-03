import { CustodialPaymentsProvider } from "./custodial.provider.js";
import type { PaymentsProvider } from "./provider.js";

export * from "./provider.js";
export { CustodialPaymentsProvider } from "./custodial.provider.js";

let provider: PaymentsProvider | null = null;

/**
 * The active payments provider.
 *
 * Custodial today. When the escrow program in `escrow/` is deployed, this
 * becomes a switch on `PAYMENTS_PROVIDER`, and tasks carrying a `vaultAddress`
 * route to escrow while legacy custodial tasks keep settling the old way until
 * they close.
 */
export function getPaymentsProvider(): PaymentsProvider {
  if (!provider) {
    provider = new CustodialPaymentsProvider();
  }
  return provider;
}

/** Test seam. */
export function __setPaymentsProvider(next: PaymentsProvider | null): void {
  provider = next;
}
