import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  const result: {
    installed: boolean;
    version: string | null;
    loggedIn: boolean;
    email: string | null;
    authMethod: string | null;
    subscriptionType: string | null;
    orgName: string | null;
  } = {
    installed: false,
    version: null,
    loggedIn: false,
    email: null,
    authMethod: null,
    subscriptionType: null,
    orgName: null,
  };

  try {
    const { stdout: versionOut } = await execAsync('claude --version');
    result.installed = true;
    result.version = versionOut.trim();
  } catch {
    return NextResponse.json({ data: result });
  }

  try {
    const { stdout: authOut } = await execAsync('claude auth status');
    const auth = JSON.parse(authOut);
    result.loggedIn = auth.loggedIn === true;
    result.email = auth.email ?? null;
    result.authMethod = auth.authMethod ?? null;
    result.subscriptionType = auth.subscriptionType ?? null;
    result.orgName = auth.orgName ?? null;
  } catch {
    // CLI installed but auth check failed
  }

  return NextResponse.json({ data: result });
}
