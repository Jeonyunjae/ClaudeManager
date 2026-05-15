'use client';

import { useEffect } from 'react';
import wsClient from '@/lib/ws';
import { useAgentStore } from '@/stores/agentStore';
import { useChatStore } from '@/stores/chatStore';
import { useApprovalStore } from '@/stores/approvalStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useCostStore } from '@/stores/costStore';
import { useSystemStore } from '@/stores/systemStore';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import type { ChatMessage } from '@/types/chat';
import type { Approval } from '@/types/approval';
import type { Notification } from '@/types/notification';

export function useWebSocket(): void {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Agent events
    unsubscribers.push(
      wsClient.on('agent:status', (payload) => {
        const data = payload as { agentId: string; status: string; statusMessage?: string };
        useAgentStore.getState().updateAgentStatus(data.agentId, data.status, data.statusMessage);
      })
    );

    unsubscribers.push(
      wsClient.on('agent:created', (payload) => {
        const data = payload as { agent: import('@/types/agent').AgentTreeNode };
        useAgentStore.getState().addAgent(data.agent);
      })
    );

    unsubscribers.push(
      wsClient.on('agent:removed', (payload) => {
        const data = payload as { agentId: string };
        useAgentStore.getState().removeAgent(data.agentId);
      })
    );

    // Chat events
    unsubscribers.push(
      wsClient.on('chat:message', (payload) => {
        const message = payload as ChatMessage;
        useChatStore.getState().addMessage(message);
        // Also deliver to agent detail popup (async chat)
        useAgentDetailStore.getState().receiveWsMessage(message as unknown as { id: string; sender: string; content: string; messageType: string; agentId: string });
      })
    );

    unsubscribers.push(
      wsClient.on('chat:typing', (payload) => {
        const data = payload as { isTyping: boolean; agentId: string };
        useChatStore.getState().setTyping(data.isTyping);
        useAgentDetailStore.getState().receiveWsTyping(data);
      })
    );

    unsubscribers.push(
      wsClient.on('chat:stream', (payload) => {
        const data = payload as { agentId: string; responseMsgId: string; content: string };
        useAgentDetailStore.getState().receiveWsStream(data);
      })
    );

    // Approval events
    unsubscribers.push(
      wsClient.on('approval:request', (payload) => {
        const approval = payload as Approval;
        useApprovalStore.getState().addPending(approval);
      })
    );

    unsubscribers.push(
      wsClient.on('approval:resolved', (payload) => {
        const data = payload as { id: string };
        useApprovalStore.getState().removePending(data.id);
      })
    );

    // Notification events
    unsubscribers.push(
      wsClient.on('notification:new', (payload) => {
        const data = payload as { notification: Notification };
        useNotificationStore.getState().addNotification(data.notification);
      })
    );

    // Cost events
    unsubscribers.push(
      wsClient.on('cost:updated', (payload) => {
        const data = payload as { totalCost: number; overageLimit: number; overage: number; overageRemaining: number; percentage: number };
        useCostStore.getState().updateSummary(data);
      })
    );

    // System events
    unsubscribers.push(
      wsClient.on('system:health', (payload) => {
        const data = payload as Record<string, number>;
        useSystemStore.getState().updateHealth(data as unknown as import('@/types/settings').SystemHealth);
      })
    );

    unsubscribers.push(
      wsClient.on('system:recovery', (payload) => {
        const data = payload as { phase: string; progress: number; recoveredAgents: string[] };
        useSystemStore.getState().setRecoveryStatus(data);
      })
    );

    // Note updates
    unsubscribers.push(
      wsClient.on('note:updated', (payload) => {
        const data = payload as { agentId: string; file: string; content: string };
        useAgentDetailStore.getState().updateNote(data.file, data.content);
      })
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}
