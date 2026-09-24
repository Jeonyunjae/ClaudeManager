/**
 * 데스크톱 TopNav 알림 클릭 이동 판정 (순수 함수) — BUG-002 (NFR-001).
 *
 * 알림 생성 공통 함수(`lib/notify.ts`)는 모바일 화면 경로(`/m/...`)를 기본 targetUrl로
 * 쓴다(DES-009 §알림 이동 규칙). 그런데 데스크톱(≥768px) TopNav가 이 값을 그대로
 * `router.push`에 넘기면 데스크톱 사용자가 모바일 셸로 튕겨 나간다 — NFR-001 위반.
 *
 * 데스크톱에서는 `/m/`로 시작하는 targetUrl로는 이동하지 않는다(읽음 처리만 하고 그대로
 * 머문다). 그 외 경로는 기존처럼 이동한다.
 */
export function desktopTargetFor(targetUrl: string | null | undefined): string | null {
  if (!targetUrl) return null;
  if (targetUrl.startsWith('/m/')) return null;
  return targetUrl;
}
