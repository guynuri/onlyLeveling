// A coach suggestion as stored and synced (SPEC §7). Rules live in modules/coach/domain; this is the shape only.
export type SuggestionRule = 'stall' | 'tooEasy' | 'stale' | 'missed' | 'limit';
export type SuggestionStatus = 'pending' | 'accepted' | 'snoozed' | 'never';

// What Accept does to the plan. Weights are already snapped to owned bells when the rule creates the action.
export type SuggestionAction = { kind: 'deload' | 'jump'; w: number } | { kind: 'swap'; toId: string };

export interface Suggestion {
  id: string; // `${rule}:${exerciseId}`: one record per rule and exercise
  rule: SuggestionRule;
  exerciseId: string;
  reason: string; // plain words with the numbers behind the card (SPEC §4.2)
  action: SuggestionAction;
  createdAt: number; // epoch ms
  status: SuggestionStatus;
  until?: number; // snoozed: shown again at this time
  // Set once a deload was accepted for this stall. Kept through later saves, so the next stall offers a swap.
  deloadTried?: boolean;
}

export function suggestionId(rule: SuggestionRule, exerciseId: string): string {
  return `${rule}:${exerciseId}`;
}
