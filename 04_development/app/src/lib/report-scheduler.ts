import { v4 as uuidv4 } from 'uuid';
import db from './db';
import { agents, chatMessages } from './schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const FINANCE_SUB_ID = 'agent_finance_sub';
const CHECK_INTERVAL_MS = 60_000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastFiredKey = '';

type BroadcastFn = (type: string, payload: unknown) => void;
type CliExecuteHandler = (req: {
  agentId: string;
  agentName: string;
  modelName?: string;
  cliPrompt: string;
  systemPrompt: string;
  responseMsgId: string;
  userId: string;
}) => Promise<void>;

let broadcastFn: BroadcastFn | null = null;
let cliExecuteHandler: CliExecuteHandler | null = null;

export function setReportSchedulerBroadcast(fn: BroadcastFn): void {
  broadcastFn = fn;
}

export function setReportSchedulerCliHandler(fn: CliExecuteHandler): void {
  cliExecuteHandler = fn;
}

interface ScheduleEntry {
  id: string;
  name: string;
  hour: number;
  minute: number;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  prompt: string;
}

const SCHEDULES: ScheduleEntry[] = [
  {
    id: 'SC2',
    name: '일간 PM 마감 요약',
    hour: 18,
    minute: 30,
    days: [1, 2, 3, 4, 5],
    prompt: `[정기 리포트 SC2] 일간 PM 마감 요약을 작성해주세요.

## 필수 참조 파일 (반드시 Read 도구로 먼저 읽을 것)
1. /Users/jeon-yunjae/Documents/윤재 자료 정리/04.Project/07. Finance Bot/01_전략/💎 보유 트리플.md — 보유 종목 entry/target/stop
2. /Users/jeon-yunjae/Documents/윤재 자료 정리/05.Finance/00_profile/투자성향.md — 투자 원칙·한도
3. /Users/jeon-yunjae/Documents/윤재 자료 정리/05.Finance/ 하위 최신 날짜 폴더 — 최근 계좌 스냅샷

## PR2 실행 항목
1. KOSPI·KOSDAQ 종가·등락률·거래대금 (네이버금융 WebFetch)
2. 보유 종목 각각의 오늘 종가 조회 + 트리플(entry/target/stop) 대비 위치 표기
3. 각 보유 종목 트리플 체크: 목표가 도달 🟢 / 손절가 도달 🔴 / 기관 이탈 🟡
4. 관심 종목 수급·등락 요약 + Instance A 4단계 분류
5. 원칙 위반 플래그 (종목 15% / 섹터 30% / 현금 20% / 손절 -10%)

## 저장
작성 후 옵시디언 노트에 저장: 02_리포트/{현재 YYYY-MM}/{오늘 YYYY-MM-DD}-pm.md`,
  },
];

function ts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function checkSchedules(): Promise<void> {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dateKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

  for (const schedule of SCHEDULES) {
    if (!schedule.days.includes(day)) continue;
    if (hour !== schedule.hour || minute !== schedule.minute) continue;

    const fireKey = `${schedule.id}-${dateKey}`;
    if (fireKey === lastFiredKey) continue;
    lastFiredKey = fireKey;

    console.log(`[${ts()}] [report-scheduler] Triggering ${schedule.id}: ${schedule.name}`);
    await triggerReport(schedule);
  }
}

async function triggerReport(schedule: ScheduleEntry): Promise<void> {
  if (!cliExecuteHandler || !broadcastFn) {
    console.warn(`[${ts()}] [report-scheduler] CLI handler or broadcast not set, skipping`);
    return;
  }

  const [agent] = await db.select().from(agents).where(eq(agents.id, FINANCE_SUB_ID)).limit(1);
  if (!agent) {
    console.warn(`[${ts()}] [report-scheduler] Finance Sub agent not found`);
    return;
  }

  let systemPrompt: string;
  if (agent.projectRoot) {
    try {
      const claudeMdPath = path.join(agent.projectRoot, 'CLAUDE.md');
      systemPrompt = fs.readFileSync(claudeMdPath, 'utf-8');
    } catch {
      systemPrompt = `You are ${agent.name}, an AI agent managed by YJ Manager. Respond concisely and helpfully. When the user writes in Korean, respond in Korean.`;
    }
  } else {
    systemPrompt = `You are ${agent.name}, an AI agent managed by YJ Manager. Respond concisely and helpfully. When the user writes in Korean, respond in Korean.`;
  }

  const userMsgId = uuidv4();
  const responseMsgId = uuidv4();

  await db.insert(chatMessages).values({
    id: userMsgId,
    sender: 'scheduler',
    content: `⏰ [${schedule.id}] ${schedule.name}`,
    messageType: 'text',
    metadata: JSON.stringify({ agentId: FINANCE_SUB_ID, source: 'scheduler', scheduleId: schedule.id }),
  });

  broadcastFn('chat:message', {
    id: userMsgId,
    sender: 'scheduler',
    content: `⏰ [${schedule.id}] ${schedule.name}`,
    messageType: 'text',
    agentId: FINANCE_SUB_ID,
    createdAt: new Date().toISOString(),
  });

  broadcastFn('chat:typing', { agentId: FINANCE_SUB_ID, isTyping: true });

  await cliExecuteHandler({
    agentId: FINANCE_SUB_ID,
    agentName: agent.name,
    modelName: agent.modelName || undefined,
    cliPrompt: schedule.prompt,
    systemPrompt,
    responseMsgId,
    userId: 'scheduler',
  });

  console.log(`[${ts()}] [report-scheduler] ${schedule.id} dispatched to CLI`);
}

export function startReportScheduler(): void {
  if (intervalId) return;

  intervalId = setInterval(() => {
    checkSchedules().catch((err) => {
      console.error(`[${ts()}] [report-scheduler] Error:`, err);
    });
  }, CHECK_INTERVAL_MS);

  const scheduleDesc = SCHEDULES.map(s => `${s.id} ${s.name} (${s.hour}:${String(s.minute).padStart(2, '0')})`).join(', ');
  console.log(`[report-scheduler] Started — ${scheduleDesc}`);
}

export function stopReportScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[report-scheduler] Stopped');
  }
}
