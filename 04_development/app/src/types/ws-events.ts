export type WSMessage = {
  type: string;
  payload: unknown;
  timestamp: string;
};

// Server -> Client event types
export type AgentStatusEvent = {
  agentId: string;
  status: string;
  statusMessage?: string;
};

export type AgentMessageEvent = {
  agentId: string;
  text: string;
};

export type ChatMessageEvent = {
  id: string;
  sender: 'user' | 'main';
  content: string;
  messageType: string;
  metadata?: Record<string, unknown>;
};

export type ChatTypingEvent = {
  isTyping: boolean;
};

export type ApprovalRequestEvent = {
  id: string;
  title: string;
  content: string;
  urgency: string;
  sourceAgent: string;
};

export type ProjectProgressEvent = {
  projectId: string;
  stage: string;
  percentage: number;
};

export type PartCreatedEvent = {
  part: { id: string; name: string; color: string };
};

export type CostUpdatedEvent = {
  totalCost: number;
  overageLimit: number;
  overage: number;
  overageRemaining: number;
  percentage: number;
};

export type SystemHealthEvent = {
  cpu: number;
  memory: number;
  disk: number;
  networkUp: number;
  networkDown: number;
};

export type SystemRecoveryEvent = {
  phase: string;
  progress: number;
  recoveredAgents: string[];
};

export type NoteUpdatedEvent = {
  agentId: string;
  file: string;
  content: string;
};

export type TerminalOutputEvent = {
  sessionId: string;
  data: string;
};

// Client -> Server event types
export type TerminalInputMessage = {
  sessionId: string;
  data: string;
};

export type TerminalResizeMessage = {
  sessionId: string;
  cols: number;
  rows: number;
};
