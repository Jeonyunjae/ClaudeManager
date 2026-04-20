export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { agentManager } = await import('@/lib/agent-manager');
    const { db } = await import('@/lib/db');
    const { agents } = await import('@/lib/schema');
    const { eq } = await import('drizzle-orm');

    // Wire up session persister — saves session_id to DB
    agentManager.setSessionPersister(async (agentId, sessionId) => {
      await db.update(agents)
        .set({ cliSessionId: sessionId, updatedAt: new Date().toISOString() })
        .where(eq(agents.id, agentId));
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
      // Resume existing session — no API call needed, instant
      console.log(`[Boot] Resuming Main agent session (${mainAgent.cliSessionId.substring(0, 8)}...)`);
      agentManager.resumeAgent(mainAgent.id, mainAgent.cliSessionId, systemPrompt);

      await db.update(agents)
        .set({ status: 'active', startedAt: new Date().toISOString() })
        .where(eq(agents.id, mainAgent.id));

      console.log('[Boot] Main agent session resumed.');
    } else {
      // First time — init new session
      console.log(`[Boot] Initializing new Main agent session...`);
      try {
        await agentManager.initAgent(mainAgent.id, systemPrompt);

        await db.update(agents)
          .set({ status: 'active', startedAt: new Date().toISOString() })
          .where(eq(agents.id, mainAgent.id));

        console.log('[Boot] Main agent session created.');
      } catch (err) {
        console.error('[Boot] Failed to init Main agent:', err);
      }
    }
  }
}
