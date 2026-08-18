export interface Budget {
  /** Ceiling in USD for the scope (org / project / mission). null = unbounded. */
  limitUsd: number | null;
  /** Already spent in the current window. */
  spentUsd: number;
}

export interface BudgetDecision {
  allowed: boolean;
  reason?: string;
  /** True when spend crossed the warning threshold but is still allowed. */
  warn: boolean;
  remainingUsd: number;
}

/**
 * CostGuard enforces AI spend ceilings (Architecture Phase 1.17 / 8.13).
 * Called before every LLM invocation with the estimated cost of the call.
 */
export class CostGuard {
  constructor(private readonly warnRatio = 0.8) {}

  check(budget: Budget, estimatedUsd: number): BudgetDecision {
    if (budget.limitUsd === null) {
      return { allowed: true, warn: false, remainingUsd: Infinity };
    }
    const remaining = budget.limitUsd - budget.spentUsd;
    if (estimatedUsd > remaining) {
      return {
        allowed: false,
        warn: true,
        remainingUsd: remaining,
        reason: `Estimated cost $${estimatedUsd.toFixed(4)} exceeds remaining budget $${remaining.toFixed(4)}`,
      };
    }
    const warn = budget.spentUsd + estimatedUsd >= budget.limitUsd * this.warnRatio;
    return { allowed: true, warn, remainingUsd: remaining - estimatedUsd };
  }
}
