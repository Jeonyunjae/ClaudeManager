export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { agentManager } = await import('@/lib/agent-manager');
    const { db } = await import('@/lib/db');
    const { agents, chatMessages } = await import('@/lib/schema');
    const { eq } = await import('drizzle-orm');
    const { v4: uuidv4 } = await import('uuid');

    // --- WS Server integration ---
    const { createWSServer, onClientEvent, broadcast, sendToSocket, setCliExecuteHandler, setCliCancelHandler, setQueueCancelHandler } = await import('@/server/ws-server');
    const { processChatInBackground, enqueueChat, cancelQueued } = await import('@/server/cli-executor');
    const { connectTerminal, writeTerminal, resizeTerminal, disconnectTerminal, setOnDataHandler, setOnExitHandler } = await import('@/lib/terminal-manager');
    const { setWatcherBroadcast, startFileWatcher } = await import('@/lib/file-watcher');
    const { startBackupScheduler } = await import('@/lib/backup-scheduler');
    const { startKeyExpiryChecker } = await import('@/lib/key-expiry-checker');
    const { startReportScheduler, setReportSchedulerBroadcast, setReportSchedulerCliHandler } = await import('@/lib/report-scheduler');
    const { WS_PORT } = await import('@/lib/constants');

    // Terminal -> WS broadcast
    setOnDataHandler((sessionId, data) => {
      broadcast('terminal:output', { sessionId, data });
    });
    setOnExitHandler((sessionId) => {
      broadcast('terminal:output', { sessionId, data: '\r\n[Session ended]\r\n' });
    });

    // Client event handlers
    onClientEvent('terminal:connect', async (ws, payload) => {
      const { agentId } = payload as { agentId: string };
      if (!agentId) return;
      // 터미널 연결 시 해당 에이전트의 활성 CLI 프로세스 종료 (세션 충돌 방지)
      if (agentManager.cancelProcess(agentId)) {
        console.log(`[Terminal] Cancelled active CLI process for ${agentId} before terminal connect`);
      }
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
      if (!agent?.tmuxSession) {
        sendToSocket(ws, 'terminal:output', { sessionId: '', data: 'Error: Agent has no tmux session\r\n' });
        return;
      }
      const sessionId = connectTerminal(agentId, agent.tmuxSession);
      if (sessionId) {
        sendToSocket(ws, 'terminal:connect', { sessionId, agentId });
      } else {
        sendToSocket(ws, 'terminal:output', { sessionId: '', data: `Error: Could not attach to tmux session "${agent.tmuxSession}"\r\n` });
      }
    });

    onClientEvent('terminal:input', (_ws, payload) => {
      const { sessionId, data } = payload as { sessionId: string; data: string };
      if (sessionId && data) writeTerminal(sessionId, data);
    });

    onClientEvent('terminal:resize', (_ws, payload) => {
      const { sessionId, cols, rows } = payload as { sessionId: string; cols: number; rows: number };
      if (sessionId && cols && rows) resizeTerminal(sessionId, cols, rows);
    });

    onClientEvent('terminal:disconnect', (_ws, payload) => {
      const { sessionId } = payload as { sessionId: string };
      if (sessionId) disconnectTerminal(sessionId);
    });

    onClientEvent('chat:send', async (_ws, payload) => {
      const { content } = payload as { content: string };
      if (!content) return;
      const id = uuidv4();
      await db.insert(chatMessages).values({ id, sender: 'user', content, messageType: 'text' });
      broadcast('chat:message', { id, sender: 'user', content, messageType: 'text' });
    });

    // Wire CLI executor
    setCliExecuteHandler(enqueueChat);
    setQueueCancelHandler(cancelQueued);
    setCliCancelHandler((agentId: string) => agentManager.cancelProcess(agentId));

    // Start WS server
    const port = parseInt(process.env.WS_PORT || String(WS_PORT), 10);
    createWSServer(port);

    // Auxiliary services
    setWatcherBroadcast(broadcast);
    startFileWatcher().catch((err) => console.warn('[Boot] File watcher failed:', err));
    startBackupScheduler();
    startKeyExpiryChecker();
    setReportSchedulerBroadcast(broadcast);
    setReportSchedulerCliHandler(processChatInBackground);
    startReportScheduler();

    // --- Agent Manager setup ---
    agentManager.setSessionPersister(async (agentId, sessionId) => {
      await db.update(agents)
        .set({ cliSessionId: sessionId, updatedAt: new Date().toISOString() })
        .where(eq(agents.id, agentId));
    });

    agentManager.setSessionLoader(async (agentId) => {
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
      return { sessionId: agent?.cliSessionId || null, projectRoot: agent?.projectRoot || null };
    });

    const [mainAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.role, 'main'))
      .limit(1);

    if (!mainAgent) {
      console.warn('[Boot] No Main agent found in DB. Skipping auto-start.');
      return;
    }

    const systemPrompt = `You are ${mainAgent.name}, the main AI orchestrator agent managed by YJ Manager. Respond concisely and helpfully. When the user writes in Korean, respond in Korean.`;

    if (mainAgent.cliSessionId) {
      console.log(`[Boot] Resuming Main agent session (${mainAgent.cliSessionId.substring(0, 8)}...)`);
      agentManager.resumeAgent(mainAgent.id, mainAgent.cliSessionId, systemPrompt, mainAgent.projectRoot || undefined);

      await db.update(agents)
        .set({ status: 'active', startedAt: new Date().toISOString() })
        .where(eq(agents.id, mainAgent.id));

      console.log('[Boot] Main agent session resumed.');
    } else {
      console.log('[Boot] No existing Main session. Will create on first chat message.');
    }
  }
}
