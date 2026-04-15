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
  modelName?: string;
  modelProvider?: string;
  taskType?: string;
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
};

export type AgentConversation = {
  id: string;
  timestamp: string;
  fromAgent: string;
  toAgent: string;
  content: string;
  type: 'instruction' | 'report' | 'question' | 'approval';
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
