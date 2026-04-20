export type CostPeriod = 'day' | 'week' | 'month';

export type CostSummary = {
  totalCost: number;
  todayCost: number;
  monthlyCost: number;
  yesterdayCost: number;
  lastMonthCost: number;
  todayChange: number;
  monthChange: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  planBaseCost: number;
  overageLimit: number;
  overage: number;
  overageRemaining: number;
  percentage: number;
  modelBreakdown: { model: string; cost: number; percentage: number }[];
  keyBreakdown: { provider: string; cost: number }[];
};

export type CostByModel = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export type CostTrend = {
  date: string;
  cost: number;
};

export type CostByKey = {
  provider: string;
  keyMasked: string;
  cost: number;
  callCount: number;
};
