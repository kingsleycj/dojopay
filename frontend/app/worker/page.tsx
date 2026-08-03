import { redirect } from "next/navigation";

export default function WorkerIndexPage() {
  // Server-side redirect: the old client-side version rendered a spinner and
  // only navigated after hydration.
  redirect("/worker/dashboard");
}
