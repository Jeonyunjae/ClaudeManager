/**
 * 로그인 후 복귀 경로(`next` 쿼리 파라미터) 검증.
 *
 * 같은 출처의 상대 경로만 허용한다 — Open Redirect 방지 (NFR-003).
 * - `/`로 시작해야 한다 (상대 경로)
 * - `//`로 시작하면 거부한다 (프로토콜 없는 외부 절대 URL, 예: `//evil.com`)
 * - 그 외(스킴이 있는 절대 URL 등)는 `/`로 시작하지 않으므로 자동 거부된다
 *
 * 유효하지 않으면 `null`을 반환한다 (호출부는 기본 경로로 대체한다).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  return next;
}
