export type GlobalSettings = {
  retryCount: number;
  retryStrategy: 'exponential' | 'fixed';
  planBaseCost: number;
  overageLimit: number;
  alertThreshold: number;
  maxConcurrentAgents: number;
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
  networkUp: number;
  networkDown: number;
  activeAgents: number;
  maxAgents: number;
  status: 'healthy' | 'warning' | 'critical';
};
