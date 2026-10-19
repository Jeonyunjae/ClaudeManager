/**
 * 화면에 보이는 버전 (FEAT-005) — 실제로 돌고 있는 코드의 커밋과 그 커밋 시각.
 * 값은 next.config.ts가 서버 기동 시 git에서 읽어 넣는다.
 */
export type BuildInfo = { commit: string; commitTime: string };

export function getBuildInfo(): BuildInfo {
  return {
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? '',
    commitTime: process.env.NEXT_PUBLIC_BUILD_COMMIT_TIME ?? '',
  };
}

/** "버전 91879f9 (10/19 11:51)" — 시각은 보는 사람 기준 현지 시각 */
export function formatBuildLabel(info: BuildInfo): string {
  if (!info.commit) return '버전 정보 없음';
  const d = new Date(info.commitTime);
  if (Number.isNaN(d.getTime())) return `버전 ${info.commit}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `버전 ${info.commit} (${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())})`;
}
