export type GlobalSettings = {
  retryCount: number;
  retryStrategy: 'exponential' | 'fixed';
  planBaseCost: number;
  overageLimit: number;
  alertThreshold: number;
  maxConcurrentAgents: number;
  /** 스킬 계정 주소. 저장소 하나 = 스킬 하나. */
  skillsAccountUrl?: string;
};

export type PartPolicy = {
  retryCount: number;
  retryStrategy: 'exponential' | 'fixed';
  retryIntervalBase: number;
  approvalStages?: string[];
  defaultModel?: string;
  sensitivityLevel: 'critical' | 'sensitive' | 'normal';
};

export type ApiKey = {
  id: number;
  provider: string;
  keyMasked: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt?: string;
  monthlyUsage: number;
  createdAt: string;
};

export type Backup = {
  id: number;
  type: 'auto' | 'manual';
  status: 'completed' | 'failed' | 'in_progress';
  filePath?: string;
  sizeBytes?: number;
  createdAt: string;
};

export type SystemHealth = {
  cpu: number;
  memory: number;
  disk: number;
  /** 절대값 — 없으면 UI가 "—"를 표시한다 (임의 값을 지어내지 않는다). */
  cpuCores?: number;
  loadAvg1m?: number;
  memoryTotalBytes?: number;
  memoryUsedBytes?: number;
  diskTotalBytes?: number;
  diskUsedBytes?: number;
  networkUp: number;
  networkDown: number;
  activeAgents: number;
  maxAgents: number;
  status: 'healthy' | 'warning' | 'critical';
};
