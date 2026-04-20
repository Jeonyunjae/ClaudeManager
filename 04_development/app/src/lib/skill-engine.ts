/**
 * Skill Execution Engine — bash-based Skill runner for ClaudeManager.
 *
 * Skills are bash scripts located in ~/.claudemanager/skills/.
 * Each skill supports two modes:
 *   - schema: outputs JSON describing input fields
 *   - execute: runs with input JSON, creates folders/hooks/agents
 *
 * Single inheritance is supported via bash `source` (SKILL_DIR env var).
 */

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CM_HOME = process.env.CLAUDEMANAGER_HOME || path.join(process.env.HOME || '~', '.claudemanager');
const SKILLS_DIR = path.join(CM_HOME, 'skills');
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillSchemaField = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  required: boolean;
  default?: string | number | boolean;
  options?: string[];
  description?: string;
};

export type SkillSchema = {
  name: string;
  displayName: string;
  description: string;
  version: string;
  parent?: string;
  fields: SkillSchemaField[];
};

export type SkillExecuteResult = {
  success: boolean;
  output: string;
  data?: Record<string, unknown>;
  error?: string;
};

// ---------------------------------------------------------------------------
// Directory management
// ---------------------------------------------------------------------------

/**
 * Ensure the skills directory exists.
 */
export function ensureSkillsDir(): string {
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
  return SKILLS_DIR;
}

/**
 * Get the full path to a skill script.
 */
export function getSkillPath(skillName: string): string {
  return path.join(SKILLS_DIR, `${skillName}.sh`);
}

/**
 * Check if a skill exists on disk.
 */
export function skillExists(skillName: string): boolean {
  return fs.existsSync(getSkillPath(skillName));
}

/**
 * List all skill files in the skills directory.
 */
export function listSkillFiles(): string[] {
  ensureSkillsDir();
  return fs
    .readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith('.sh'))
    .map((f) => f.replace('.sh', ''));
}

// ---------------------------------------------------------------------------
// Skill execution
// ---------------------------------------------------------------------------

/**
 * Run a skill in schema mode.
 * Executes: bash skill.sh schema
 * Returns parsed JSON schema.
 */
export async function getSkillSchema(skillName: string): Promise<SkillSchema> {
  const scriptPath = getSkillPath(skillName);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Skill script not found: ${scriptPath}`);
  }

  const env = {
    ...process.env,
    SKILL_DIR: SKILLS_DIR,
    CLAUDEMANAGER_HOME: CM_HOME,
  };

  try {
    const { stdout } = await execFileAsync('bash', [scriptPath, 'schema'], {
      env,
      timeout: DEFAULT_TIMEOUT_MS,
      encoding: 'utf-8',
    });

    const schema = JSON.parse(stdout.trim()) as SkillSchema;
    return schema;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to get skill schema for ${skillName}: ${msg}`);
  }
}

/**
 * Run a skill in execute mode.
 * Executes: bash skill.sh execute '{"input":"data"}'
 * Returns execution result.
 */
export async function executeSkill(
  skillName: string,
  input: Record<string, unknown>
): Promise<SkillExecuteResult> {
  const scriptPath = getSkillPath(skillName);
  if (!fs.existsSync(scriptPath)) {
    return { success: false, output: '', error: `Skill script not found: ${scriptPath}` };
  }

  const env = {
    ...process.env,
    SKILL_DIR: SKILLS_DIR,
    CLAUDEMANAGER_HOME: CM_HOME,
  };

  const inputJson = JSON.stringify(input);

  try {
    const { stdout, stderr } = await execFileAsync('bash', [scriptPath, 'execute', inputJson], {
      env,
      timeout: DEFAULT_TIMEOUT_MS * 2,
      encoding: 'utf-8',
    });

    // Try to parse the last line as JSON result
    const lines = stdout.trim().split('\n');
    let data: Record<string, unknown> | undefined;

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        data = JSON.parse(lines[i]);
        break;
      } catch {
        // not JSON, continue
      }
    }

    return {
      success: true,
      output: stdout,
      data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: msg };
  }
}

// ---------------------------------------------------------------------------
// Version lock
// ---------------------------------------------------------------------------

/**
 * Write a skill-version.lock file for a Part.
 */
export function writeVersionLock(partDir: string, skillName: string, version: string): void {
  const lockPath = path.join(partDir, 'skill-version.lock');
  const lock = {
    skillName,
    version,
    lockedAt: new Date().toISOString(),
  };
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
}

/**
 * Write the input.json used to create a Part.
 */
export function writeInputJson(partDir: string, input: Record<string, unknown>): void {
  const inputPath = path.join(partDir, 'input.json');
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Default skill files
// ---------------------------------------------------------------------------

const BASE_PART_SCRIPT = `#!/bin/bash
# base-part.sh — Base skill for all Part types
# All domain-specific skills inherit from this via: source "$SKILL_DIR/base-part.sh"

set -euo pipefail

SKILL_DIR="\${SKILL_DIR:-$HOME/.claudemanager/skills}"
CM_HOME="\${CLAUDEMANAGER_HOME:-$HOME/.claudemanager}"

# Common functions
create_part_dir() {
  local part_id="$1"
  local part_dir="$CM_HOME/.orchestrator/$part_id"
  mkdir -p "$part_dir"/{sub-contexts,decisions,progress}
  echo "$part_dir"
}

write_context() {
  local part_dir="$1"
  local name="$2"
  local part_id="$3"
  cat > "$part_dir/main-context.md" <<CTX
# $name

- Part ID: $part_id
- Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Status: active
CTX
}

# Default schema (override in child skills)
default_schema() {
  cat <<'SCHEMA'
{
  "name": "base-part",
  "displayName": "Base Part",
  "description": "Base skill for creating a Part (department)",
  "version": "1.0.0",
  "fields": [
    {"key": "name", "label": "Part Name", "type": "text", "required": true, "description": "Name for the new department"},
    {"key": "description", "label": "Description", "type": "text", "required": false, "description": "Department description"},
    {"key": "color", "label": "Theme Color", "type": "select", "required": false, "options": ["blue", "green", "purple", "orange", "red", "teal"], "default": "blue"},
    {"key": "sensitivityLevel", "label": "Sensitivity Level", "type": "select", "required": false, "options": ["normal", "high", "critical"], "default": "normal"}
  ]
}
SCHEMA
}

# Default execute (override in child skills)
default_execute() {
  local input="$1"
  local name=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','Unnamed Part'))" 2>/dev/null || echo "Unnamed Part")
  local part_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
  local part_dir=$(create_part_dir "$part_id")
  write_context "$part_dir" "$name" "$part_id"
  echo "{\\"partId\\":\\"$part_id\\",\\"partDir\\":\\"$part_dir\\",\\"name\\":\\"$name\\"}"
}

# Entry point
case "\${1:-}" in
  schema)
    default_schema
    ;;
  execute)
    default_execute "\${2:-{}}"
    ;;
  *)
    echo "Usage: $0 {schema|execute}" >&2
    exit 1
    ;;
esac
`;

const PROJECT_PART_SCRIPT = `#!/bin/bash
# project-part.sh — Project management domain skill
# Inherits from base-part.sh

set -euo pipefail

SKILL_DIR="\${SKILL_DIR:-$HOME/.claudemanager/skills}"
source "$SKILL_DIR/base-part.sh" 2>/dev/null || true

CM_HOME="\${CLAUDEMANAGER_HOME:-$HOME/.claudemanager}"

case "\${1:-}" in
  schema)
    cat <<'SCHEMA'
{
  "name": "project-part",
  "displayName": "Project Management",
  "description": "Create a project management department with development workflow support",
  "version": "1.0.0",
  "parent": "base-part",
  "fields": [
    {"key": "name", "label": "Department Name", "type": "text", "required": true, "default": "Project Management", "description": "Name for the project management department"},
    {"key": "description", "label": "Description", "type": "text", "required": false, "description": "Department description"},
    {"key": "methodology", "label": "Development Methodology", "type": "select", "required": true, "options": ["agile", "waterfall", "kanban", "hybrid"], "default": "agile", "description": "Preferred development methodology"},
    {"key": "teamSize", "label": "Default Team Size", "type": "number", "required": false, "default": 3, "description": "Default number of instance agents per sub"},
    {"key": "color", "label": "Theme Color", "type": "select", "required": false, "options": ["blue", "green", "purple", "orange", "red", "teal"], "default": "blue"},
    {"key": "sensitivityLevel", "label": "Sensitivity Level", "type": "select", "required": false, "options": ["normal", "high", "critical"], "default": "normal"}
  ]
}
SCHEMA
    ;;
  execute)
    input="\${2:-{}}"
    name=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','Project Management'))" 2>/dev/null || echo "Project Management")
    methodology=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('methodology','agile'))" 2>/dev/null || echo "agile")
    team_size=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('teamSize',3))" 2>/dev/null || echo "3")

    part_id=$(uuidgen | tr '[:upper:]' '[:lower:]')
    part_dir="$CM_HOME/.orchestrator/$part_id"

    mkdir -p "$part_dir"/{sub-contexts,decisions,progress}

    cat > "$part_dir/main-context.md" <<CTX
# $name

- Part ID: $part_id
- Type: Project Management
- Methodology: $methodology
- Default Team Size: $team_size
- Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Status: active

## Workflow
Manages development projects using $methodology methodology.
Each project runs as a Sub orchestrator with up to $team_size instance agents.
CTX

    echo "{\\"partId\\":\\"$part_id\\",\\"partDir\\":\\"$part_dir\\",\\"name\\":\\"$name\\",\\"methodology\\":\\"$methodology\\",\\"teamSize\\":$team_size}"
    ;;
  *)
    echo "Usage: $0 {schema|execute}" >&2
    exit 1
    ;;
esac
`;

/**
 * Install default skill files if they don't exist.
 */
export function installDefaultSkills(): { installed: string[] } {
  ensureSkillsDir();
  const installed: string[] = [];

  const defaults: Record<string, string> = {
    'base-part': BASE_PART_SCRIPT,
    'project-part': PROJECT_PART_SCRIPT,
  };

  for (const [name, content] of Object.entries(defaults)) {
    const filePath = getSkillPath(name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, { mode: 0o755 });
      installed.push(name);
    }
  }

  return { installed };
}
