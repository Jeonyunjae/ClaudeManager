/**
 * Parse Claude Code CLI JSONL log files for usage/cost data.
 * Reads from ~/.claude/projects/ to get all session usage.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number; cacheCreate: number; cacheRead: number }> = {
  'claude-opus-4-6': { input: 15, output: 75, cacheCreate: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4, cacheCreate: 1, cacheRead: 0.08 },
};
const DEFAULT_PRICING = { input: 3, output: 15, cacheCreate: 3.75, cacheRead: 0.3 };

export interface UsageEntry {
  date: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreateTokens: number;
  cacheReadTokens: number;
  cost: number;
}

function calcCost(model: string, input: number, output: number, cacheCreate: number, cacheRead: number): number {
  const p = PRICING[model] || DEFAULT_PRICING;
  return (input * p.input + output * p.output + cacheCreate * p.cacheCreate + cacheRead * p.cacheRead) / 1_000_000;
}

/**
 * Parse all JSONL files under ~/.claude/projects/ and return usage entries.
 * Optionally filter by date range.
 */
export function parseAllUsage(since?: string): UsageEntry[] {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const entries: UsageEntry[] = [];
  const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true });

  for (const dir of projectDirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(projectsDir, dir.name);

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            const d = JSON.parse(line);
            const msg = d.message;
            if (!msg?.usage || !msg.model) continue;

            const ts = d.timestamp || '';
            const date = ts.substring(0, 10);
            if (!date) continue;
            if (since && date < since) continue;

            const u = msg.usage;
            const inputTokens = u.input_tokens || 0;
            const outputTokens = u.output_tokens || 0;
            const cacheCreateTokens = u.cache_creation_input_tokens || 0;
            const cacheReadTokens = u.cache_read_input_tokens || 0;

            entries.push({
              date,
              model: msg.model,
              inputTokens,
              outputTokens,
              cacheCreateTokens,
              cacheReadTokens,
              cost: calcCost(msg.model, inputTokens, outputTokens, cacheCreateTokens, cacheReadTokens),
            });
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  return entries;
}

export interface DailySummary {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

export interface ModelSummary {
  model: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
}

export function aggregateByDate(entries: UsageEntry[]): DailySummary[] {
  const map = new Map<string, DailySummary>();
  for (const e of entries) {
    const existing = map.get(e.date) || { date: e.date, cost: 0, inputTokens: 0, outputTokens: 0, calls: 0 };
    existing.cost += e.cost;
    existing.inputTokens += e.inputTokens + e.cacheCreateTokens + e.cacheReadTokens;
    existing.outputTokens += e.outputTokens;
    existing.calls += 1;
    map.set(e.date, existing);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateByModel(entries: UsageEntry[]): ModelSummary[] {
  const map = new Map<string, ModelSummary>();
  for (const e of entries) {
    const existing = map.get(e.model) || { model: e.model, cost: 0, inputTokens: 0, outputTokens: 0, calls: 0 };
    existing.cost += e.cost;
    existing.inputTokens += e.inputTokens + e.cacheCreateTokens + e.cacheReadTokens;
    existing.outputTokens += e.outputTokens;
    existing.calls += 1;
    map.set(e.model, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}
