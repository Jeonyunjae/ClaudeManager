export type AgentRole = 'main' | 'part' | 'sub' | 'instance';
export type AgentStatus = 'active' | 'idle' | 'pending' | 'error' | 'stopped' | 'retrying';

export type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  statusMessage?: string;
  partId?: string;
  parentId?: string;
  tmuxSession?: string;
  cliSessionId?: string;
  modelName?: string;
  modelProvider?: string;
  taskType?: string;
  notesPath?: string;
  startedAt?: string;
  stoppedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentTreeNode = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  statusMessage?: string;
  partId?: string;
  children: AgentTreeNode[];
};

export type AgentDetail = Agent & {
  uptimeSeconds?: number;
  totalCost?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  interactionCount?: number;
};

export type AgentConversation = {
  id: string;
  timestamp: string;
  fromAgent: string;
  toAgent: string;
  content: string;
  type: 'instruction' | 'report' | 'question' | 'approval';
  /** 도구 사용 목록·대기·취소 표시 */
  metadata?: {
    tools?: { name: string; target?: string }[];
    queued?: boolean;
    cancelled?: boolean;
  };
};

export type AgentNote = {
  file: string;
  content: string;
  updatedAt: string;
};

export type AgentLog = {
  id: number;
  eventType: string;
  message?: string;
  detail?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  createdAt: string;
};
