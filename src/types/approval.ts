export type ApprovalUrgency = 'low' | 'normal' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export type Approval = {
  id: string;
  title: string;
  content: string;
  urgency: ApprovalUrgency;
  status: ApprovalStatus;
  sourceAgentId?: string;
  sourceAgentName?: string;
  projectId?: string;
  projectName?: string;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
};

export type ApprovalAction = {
  comment?: string;
};
