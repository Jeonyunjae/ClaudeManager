/**
 * Skill Loader — loads skill markdown files and provides system prompts for agents.
 */

import fs from 'fs';
import path from 'path';

const SKILLS_DIR = path.join(process.cwd(), 'src', 'skills');

/**
 * Load a skill file by name and return its content as a system prompt string.
 */
export function loadSkill(skillName: string): string | null {
  const filePath = path.join(SKILLS_DIR, `${skillName}.md`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[SkillLoader] Skill file not found: ${filePath}`);
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Load the Main agent skill.
 */
export function loadMainSkill(): string {
  const skill = loadSkill('main-agent');
  if (!skill) {
    return 'You are the Main agent, the project management orchestrator. Respond concisely and helpfully. When the user writes in Korean, respond in Korean.';
  }
  return skill;
}

/**
 * Parse action blocks from agent response text.
 * Format: <<ACTION:TYPE>>{ json }<<END_ACTION>>
 * Returns: { actions: ParsedAction[], cleanText: string }
 */
export interface ParsedAction {
  type: string;  // e.g., 'CREATE_PART', 'CREATE_SUB'
  payload: Record<string, unknown>;
  raw: string;   // original matched block
}

export function parseActions(text: string): { actions: ParsedAction[]; cleanText: string } {
  const actionRegex = /<<ACTION:(\w+)>>\s*([\s\S]*?)\s*<<END_ACTION>>/g;
  const actions: ParsedAction[] = [];
  let cleanText = text;

  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    const [raw, type, jsonStr] = match;
    try {
      const payload = JSON.parse(jsonStr) as Record<string, unknown>;
      actions.push({ type, payload, raw });
    } catch (e) {
      console.warn(`[SkillLoader] Failed to parse action JSON: ${jsonStr.substring(0, 100)}`);
    }
    cleanText = cleanText.replace(raw, '');
  }

  // Clean up extra whitespace from removed action blocks
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { actions, cleanText };
}
