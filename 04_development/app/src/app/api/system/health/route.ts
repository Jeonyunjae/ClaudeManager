import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import db from '@/lib/db';
import { agents, settings } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';
import os from 'os';
import { execSync } from 'child_process';
import { logError } from '@/lib/error-logger';

// ---------------------------------------------------------------------------
// Disk usage — parse `df -k /` output (macOS / Linux)
// ---------------------------------------------------------------------------

/**
 * 디스크 총량/사용량(바이트). 퍼센트만으로는 UI가 절대값을 표시할 수 없어
 * 총량을 하드코딩(500GB)하고 있었으므로 실측값을 함께 내려준다.
 */
function getDiskBytes(): { total: number; used: number } {
  try {
    const target = process.platform === 'darwin' ? '/System/Volumes/Data' : '/';
    const output = execSync(`df -k ${target}`, { encoding: 'utf-8', timeout: 3000 });
    const lines = output.trim().split('\n');
    if (lines.length < 2) return { total: 0, used: 0 };
    const cols = lines[1].split(/\s+/);
    const used = parseInt(cols[2], 10);
    const available = parseInt(cols[3], 10);
    if (isNaN(used) || isNaN(available)) return { total: 0, used: 0 };
    return { total: (used + available) * 1024, used: used * 1024 };
  } catch {
    return { total: 0, used: 0 };
  }
}

function getDiskPercent(): number {
  try {
    // macOS APFS: df / shows snapshot volume (tiny %), use /System/Volumes/Data for real usage
    const target = process.platform === 'darwin' ? '/System/Volumes/Data' : '/';
    const output = execSync(`df -k ${target}`, { encoding: 'utf-8', timeout: 3000 });
    const lines = output.trim().split('\n');
    if (lines.length < 2) return 0;
    // Header: Filesystem 1K-blocks Used Available Use% Mounted
    const cols = lines[1].split(/\s+/);
    // macOS `df` shows "capacity" (e.g. 85%) in column index 4
    const capacityStr = cols.find((c) => c.endsWith('%'));
    if (capacityStr) {
      return parseFloat(capacityStr.replace('%', ''));
    }
    // Fallback: compute from used / (used + available)
    const used = parseInt(cols[2], 10);
    const available = parseInt(cols[3], 10);
    if (!isNaN(used) && !isNaN(available) && used + available > 0) {
      return (used / (used + available)) * 100;
    }
    return 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Network interface status (macOS: netstat -ib)
// ---------------------------------------------------------------------------

interface NetworkInfo {
  up: boolean;
  interfaceName: string;
  inputBytes: number;
  outputBytes: number;
}

function getNetworkInfo(): NetworkInfo {
  try {
    // Use os.networkInterfaces() which is cross-platform
    const ifaces = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(ifaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (!addr.internal && addr.family === 'IPv4') {
          // Interface is up if we have an IPv4 address
          // Try to get byte counts from netstat on macOS
          let inputBytes = 0;
          let outputBytes = 0;
          try {
            const output = execSync(`netstat -ib -I ${name}`, { encoding: 'utf-8', timeout: 3000 });
            const lines = output.trim().split('\n');
            if (lines.length >= 2) {
              const cols = lines[1].split(/\s+/);
              // netstat -ib columns: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
              if (cols.length >= 10) {
                inputBytes = parseInt(cols[6], 10) || 0;
                outputBytes = parseInt(cols[9], 10) || 0;
              }
            }
          } catch {
            // netstat not available — still return interface as up
          }
          return { up: true, interfaceName: name, inputBytes, outputBytes };
        }
      }
    }
    return { up: false, interfaceName: 'none', inputBytes: 0, outputBytes: 0 };
  } catch {
    return { up: false, interfaceName: 'none', inputBytes: 0, outputBytes: 0 };
  }
}

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증이 필요합니다.' } },
      { status: 401 }
    );
  }

  try {
    // CPU usage — parse `top` for actual user+sys on macOS, fallback to loadavg
    let cpuPercent: number;
    if (process.platform === 'darwin') {
      try {
        const topOut = execSync('top -l 1 -n 0', { encoding: 'utf-8', timeout: 5000 });
        const cpuMatch = topOut.match(/CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys/);
        if (cpuMatch) {
          cpuPercent = parseFloat(cpuMatch[1]) + parseFloat(cpuMatch[2]);
        } else {
          cpuPercent = Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100);
        }
      } catch {
        cpuPercent = Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100);
      }
    } else {
      cpuPercent = Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100);
    }

    // Memory — macOS os.freemem() excludes inactive/purgeable, so use vm_stat
    let memoryPercent: number;
    if (process.platform === 'darwin') {
      try {
        const vmOut = execSync('vm_stat', { encoding: 'utf-8', timeout: 3000 });
        const pageSize = 4096;
        const parse = (label: string): number => {
          const m = vmOut.match(new RegExp(`${label}:\\s+(\\d+)`));
          return m ? parseInt(m[1], 10) * pageSize : 0;
        };
        const free = parse('Pages free');
        const inactive = parse('Pages inactive');
        const purgeable = parse('Pages purgeable');
        const totalMem = os.totalmem();
        const available = free + inactive + purgeable;
        memoryPercent = ((totalMem - available) / totalMem) * 100;
      } catch {
        const totalMem = os.totalmem();
        memoryPercent = ((totalMem - os.freemem()) / totalMem) * 100;
      }
    } else {
      const totalMem = os.totalmem();
      memoryPercent = ((totalMem - os.freemem()) / totalMem) * 100;
    }

    // Disk (GAP-13: real disk usage via df)
    const diskPercent = getDiskPercent();

    // Network (GAP-13: real interface status)
    const network = getNetworkInfo();

    // Active agents
    const [activeResult] = await db.select({ count: count() }).from(agents).where(eq(agents.status, 'active'));

    // Max agents setting
    const maxAgentsSetting = await db.select().from(settings).where(eq(settings.key, 'max_concurrent_agents')).limit(1);
    const maxAgents = maxAgentsSetting.length > 0 ? parseInt(maxAgentsSetting[0].value) : 10;

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (cpuPercent > 90 || memoryPercent > 90 || diskPercent > 95) {
      status = 'critical';
    } else if (cpuPercent > 70 || memoryPercent > 70 || diskPercent > 85) {
      status = 'warning';
    }

    // 절대값(총량/사용량/코어 수) — UI가 임의 값을 지어내지 않도록 함께 내려준다.
    const diskBytes = getDiskBytes();
    const totalMemBytes = os.totalmem();

    return NextResponse.json({
      data: {
        cpu: Math.round(cpuPercent),
        memory: Math.round(memoryPercent),
        disk: Math.round(diskPercent),
        cpuCores: os.cpus().length,
        memoryTotalBytes: totalMemBytes,
        memoryUsedBytes: Math.round((totalMemBytes * memoryPercent) / 100),
        diskTotalBytes: diskBytes.total,
        diskUsedBytes: diskBytes.used,
        loadAvg1m: os.loadavg()[0],
        networkUp: network.up,
        networkInterfaceName: network.interfaceName,
        networkInputBytes: network.inputBytes,
        networkOutputBytes: network.outputBytes,
        activeAgents: activeResult.count,
        maxAgents,
        status,
      },
    });
  } catch (error) {
    logError(error, { requestPath: '/api/system/health' });
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
