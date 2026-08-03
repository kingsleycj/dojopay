"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, ImagePlus, Wallet, X } from "lucide-react";
import { UploadImage } from "@/components/UploadImage";
import { showToast } from "@/components/Toast";
import {
  Button,
  ButtonLink,
  Callout,
  Field,
  Input,
  Sol,
  Surface,
} from "@/components/ui-kit";
import { cn } from "@/components/lib/utils";
import { creatorEndpoints, type BudgetQuote, type Vault } from "@/lib/api";
import {
  DEFAULT_SUBMISSIONS_PER_TASK,
  MAX_SUBMISSIONS_PER_TASK,
  MIN_SUBMISSIONS_PER_TASK,
  MIN_TASK_BUDGET_LAMPORTS,
} from "@/lib/solana/config";
import { lamportsToSol, solToLamports } from "@/utils/convert";

/**
 * The task composer.
 *
 * Replaces a form whose only economic decision was "pay 0.1 SOL". A creator now
 * chooses a budget and how many answers they want, and the reward per answer
 * falls out of the two.
 *
 * Three things this deliberately does:
 *
 *  1. **The reward is quoted by the server, not computed here.** Integer
 *     division with a floor, and a remainder that stays in the vault, is fiddly
 *     enough that two implementations would eventually disagree — and the one
 *     that matters is the one that reserves the money. The preview is debounced
 *     against `/task-quote` so what is on screen is what will be committed.
 *  2. **Funding is a vault balance, not a wallet transaction.** There is no
 *     signature step: the SOL is already on the platform. If the vault is short,
 *     the composer says so up front rather than at the final click.
 *  3. **Steps are gated but not hidden.** The creator can see the whole shape of
 *     what they are filling in, which a wizard that reveals one step at a time
 *     does not give them.
 */

const STEPS = [
  { id: "brief", label: "Brief" },
  { id: "images", label: "Images" },
  { id: "budget", label: "Budget" },
] as const;

export function TaskComposer({ vault }: { vault: Vault | null }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [budgetSol, setBudgetSol] = useState("0.1");
  const [slots, setSlots] = useState(DEFAULT_SUBMISSIONS_PER_TASK);

  const [quote, setQuote] = useState<BudgetQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const budgetLamports = useMemo(() => {
    const parsed = solToLamports(budgetSol);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : null;
  }, [budgetSol]);

  /**
   * Debounced server quote.
   *
   * `cancelled` guards against an out-of-order response overwriting a newer one
   * — typing quickly otherwise leaves the preview showing an earlier budget.
   */
  useEffect(() => {
    if (!budgetLamports) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setQuoting(true);

    const timer = window.setTimeout(async () => {
      try {
        const result = await creatorEndpoints.quoteBudget(budgetLamports, slots);
        if (!cancelled) {
          setQuote(result);
          setQuoteError(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(error?.message ?? "That combination is not valid");
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [budgetLamports, slots]);

  const uploadedImages = images.filter((image) => !image.startsWith("data:"));
  const hasBrief = title.trim().length > 0;
  const hasImages = uploadedImages.length >= 2;

  const committed = quote ? BigInt(quote.committed) : BigInt(0);
  const available = vault ? BigInt(vault.available) : BigInt(0);
  const shortfall = committed > available ? committed - available : BigInt(0);
  const canAfford = shortfall === BigInt(0);

  const canPublish = hasBrief && hasImages && Boolean(quote) && canAfford && !publishing;

  const publish = useCallback(async () => {
    if (!canPublish || !quote || !budgetLamports) return;

    setPublishing(true);
    try {
      const task = await creatorEndpoints.createTask({
        options: uploadedImages.map((imageUrl) => ({ imageUrl })),
        title: title.trim(),
        budgetLamports,
        maxSubmissions: slots,
        expirationDate: expiresAt || null,
      });

      showToast("Task published", "success");
      router.push(`/creator/task/${task.id}`);
    } catch (error: any) {
      showToast(error?.message ?? "Could not publish the task", "error");
    } finally {
      setPublishing(false);
    }
  }, [budgetLamports, canPublish, expiresAt, quote, router, slots, title, uploadedImages]);

  const completed: Record<(typeof STEPS)[number]["id"], boolean> = {
    brief: hasBrief,
    images: hasImages,
    budget: Boolean(quote) && canAfford,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-6">
        <StepRail completed={completed} />

        {/* --- Brief ---------------------------------------------------- */}
        <Surface className="app-enter p-5 sm:p-6">
          <StepHeading index={1} title="What should workers decide?" done={completed.brief} />

          <div className="mt-4 space-y-4">
            <Field
              label="Task title"
              htmlFor="task-title"
              hint="Workers see this above the images. Be specific — “Which logo reads best at small sizes?” beats “Pick one”."
            >
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Which of these reads best at small sizes?"
                maxLength={200}
              />
            </Field>

            <Field
              label="Closes at"
              htmlFor="task-expiry"
              hint="Optional. Unfilled slots return to your vault when a task closes, so setting a deadline costs you nothing."
            >
              <Input
                id="task-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
              />
            </Field>
          </div>
        </Surface>

        {/* --- Images --------------------------------------------------- */}
        <Surface className="app-enter p-5 sm:p-6">
          <StepHeading
            index={2}
            title="What are they choosing between?"
            done={completed.images}
            hint={`${uploadedImages.length} added — at least 2 needed`}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            {images.map((image, index) => (
              <div key={`${image}-${index}`} className="group relative">
                <img
                  src={image}
                  alt={`Option ${index + 1}`}
                  className="h-24 w-24 rounded-lg border border-border object-cover sm:h-28 sm:w-28"
                />
                <button
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                  className="app-focus-ring absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove option ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <UploadImage onImageAdded={(image) => setImages((current) => [...current, image])} />
          </div>

          {images.length === 0 && (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ImagePlus className="h-3.5 w-3.5" />
              Up to 20 options. JPG, PNG or WebP.
            </p>
          )}
        </Surface>

        {/* --- Budget --------------------------------------------------- */}
        <Surface className="app-enter p-5 sm:p-6">
          <StepHeading index={3} title="How much, across how many answers?" done={completed.budget} />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Total budget"
              htmlFor="task-budget"
              hint={`Minimum ${lamportsToSol(String(MIN_TASK_BUDGET_LAMPORTS), 4)} SOL`}
            >
              <div className="relative">
                <Input
                  id="task-budget"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={budgetSol}
                  onChange={(event) => setBudgetSol(event.target.value)}
                  className="pr-14"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  SOL
                </span>
              </div>
            </Field>

            <Field
              label="Answers wanted"
              htmlFor="task-slots"
              hint={`${MIN_SUBMISSIONS_PER_TASK}–${MAX_SUBMISSIONS_PER_TASK}`}
            >
              <Input
                id="task-slots"
                type="number"
                inputMode="numeric"
                min={MIN_SUBMISSIONS_PER_TASK}
                max={MAX_SUBMISSIONS_PER_TASK}
                value={slots}
                onChange={(event) => setSlots(Number(event.target.value))}
              />
            </Field>
          </div>

          <div className="mt-4">
            <input
              type="range"
              min={MIN_SUBMISSIONS_PER_TASK}
              max={250}
              step={5}
              value={Math.min(slots, 250)}
              onChange={(event) => setSlots(Number(event.target.value))}
              className="w-full accent-[hsl(var(--mode-accent))]"
              aria-label="Answers wanted"
            />
            <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
              <span>{MIN_SUBMISSIONS_PER_TASK}</span>
              <span>250+</span>
            </div>
          </div>

          {quoteError && (
            <div className="mt-4">
              <Callout tone="warning" title="That combination will not work">
                {quoteError}
              </Callout>
            </div>
          )}
        </Surface>
      </div>

      {/* --- Summary ---------------------------------------------------- */}
      <aside className="lg:sticky lg:top-24">
        <Surface className="app-enter overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Summary
            </p>
          </div>

          <dl className="divide-y divide-border">
            <SummaryRow label="Each answer pays">
              {quote ? (
                <Sol lamports={quote.rewardPerSubmission} decimals={6} className="font-semibold" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </SummaryRow>

            <SummaryRow label="Answers wanted">
              <span className="font-semibold tabular-nums">{slots}</span>
            </SummaryRow>

            <SummaryRow label="Reserved from vault">
              {quote ? (
                <Sol lamports={quote.committed} decimals={6} className="font-semibold" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </SummaryRow>

            {/*
              Shown only when it exists. An indivisible remainder is a real thing
              that happens and silently swallowing it would leave the arithmetic
              looking wrong to anyone who checks it.
            */}
            {quote && BigInt(quote.remainder) > BigInt(0) && (
              <SummaryRow
                label="Stays in vault"
                hint="Your budget does not divide evenly across this many answers, so the remainder is not committed."
              >
                <Sol lamports={quote.remainder} decimals={9} className="text-muted-foreground" />
              </SummaryRow>
            )}

            <SummaryRow label="Vault available">
              {vault ? (
                <Sol
                  lamports={vault.available}
                  decimals={4}
                  className={cn("font-semibold", !canAfford && "text-red-600 dark:text-red-400")}
                />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </SummaryRow>
          </dl>

          <div className="space-y-3 border-t border-border p-5">
            {!canAfford && (
              <Callout tone="warning" title="Not enough in your vault">
                You need{" "}
                <Sol lamports={shortfall.toString()} decimals={4} className="font-semibold" /> more
                to publish this.
              </Callout>
            )}

            {canAfford ? (
              <Button
                onClick={publish}
                disabled={!canPublish}
                loading={publishing}
                size="lg"
                className="w-full"
              >
                {publishing ? "Publishing…" : "Publish task"}
                {!publishing && <ArrowRight className="h-4 w-4" />}
              </Button>
            ) : (
              <ButtonLink href="/creator/vault" size="lg" className="w-full">
                <Wallet className="h-4 w-4" />
                Top up your vault
              </ButtonLink>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {quoting
                ? "Checking the numbers…"
                : "Unfilled answers return to your vault when the task closes."}
            </p>
          </div>
        </Surface>

        {!hasBrief || !hasImages ? (
          <p className="mt-3 flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {!hasBrief && "Add a title. "}
              {!hasImages && "Add at least two uploaded images."}
            </span>
          </p>
        ) : null}
      </aside>
    </div>
  );
}

function StepRail({ completed }: { completed: Record<string, boolean> }) {
  return (
    <ol className="app-enter flex items-center gap-2 text-xs" aria-label="Progress">
      {STEPS.map((step, index) => {
        const done = completed[step.id];
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[0.6875rem] font-semibold transition-colors",
                done
                  ? "border-transparent bg-accent-mode text-white"
                  : "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn("font-medium", done ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({
  index,
  title,
  done,
  hint,
}: {
  index: number;
  title: string;
  done: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Step {index}
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {done && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-mode text-white">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="px-5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
      {hint && <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
