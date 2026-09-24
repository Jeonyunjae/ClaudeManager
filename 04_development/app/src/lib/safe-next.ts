/** 제어문자(0x00~0x1f — 탭·개행 포함) */
const CONTROL_CHAR_RE = /[\x00-\x1f]/;

/** 백슬래시나 제어문자가 있으면 안전하지 않다고 본다 (SEC-001). */
function hasUnsafeChars(value: string): boolean {
  return CONTROL_CHAR_RE.test(value) || value.includes('\\');
}

/**
 * 로그인 후 복귀 경로(`next` 쿼리 파라미터) 검증.
 *
 * 같은 출처의 상대 경로만 허용한다 — Open Redirect 방지 (NFR-003, SEC-001).
 * - `/`로 시작해야 한다 (상대 경로)
 * - `//`로 시작하면 거부한다 (프로토콜 없는 외부 절대 URL, 예: `//evil.com`)
 * - 그 외(스킴이 있는 절대 URL 등)는 `/`로 시작하지 않으므로 자동 거부된다
 * - 백슬래시·제어문자(탭·개행 등)를 포함하면 거부한다 — 일부 브라우저/파서가 백슬래시를
 *   슬래시로, 또는 탭을 제거해 다루는 것을 이용한 우회를 막는다
 *   (`/\evil.com`, `/\tevil` 류)
 * - **%-인코딩으로 위 문자를 감춘 값**(`/%5Cevil.com` → 디코드하면 `/\evil.com`,
 *   `/%09/evil.com` → 디코드하면 `/<TAB>/evil.com`)도 한 번 디코드해 같은 기준으로 거부한다.
 *   `searchParams.get()`이 쿼리스트링을 이미 한 번 디코드하므로, 공격자가 이중 인코딩하면
 *   이 함수가 받는 문자열엔 `%`가 그대로 남아 있을 수 있다 — 그래서 원문 검사와 디코드 후
 *   검사를 모두 한다.
 * - 마지막으로 `new URL(next, 'http://x')`로 파싱해 origin이 같은지 재확인하고,
 *   `pathname + search + hash`만 반환한다(스킴·호스트가 섞여 들어올 길을 원천 차단).
 *
 * 유효하지 않으면 `null`을 반환한다 (호출부는 기본 경로로 대체한다).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (hasUnsafeChars(next)) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return null; // 잘못된 %-인코딩
  }
  if (hasUnsafeChars(decoded)) return null;

  if (!next.startsWith('/') || next.startsWith('//')) return null;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;

  let url: URL;
  try {
    url = new URL(next, 'http://x.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'http://x.invalid') return null;

  const result = `${url.pathname}${url.search}${url.hash}`;
  if (!result.startsWith('/') || result.startsWith('//') || hasUnsafeChars(result)) return null;

  return result;
}
