/**
 * JWT `exp` 클레임을 서명 검증 없이 디코드한다 (NFR-003).
 *
 * 서버가 서명을 검증하므로 클라이언트는 만료 임박 여부만 판단하면 된다.
 * 형식이 JWT가 아니거나 payload에 `exp`(숫자)가 없으면 `null`을 반환한다 —
 * 호출부는 이 경우 기존 동작(추가 처리 없음)을 유지해야 한다.
 */
export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return payload.exp;
  } catch {
    return null;
  }
}

/** `exp`(초 단위 epoch)까지 남은 일수. 음수면 이미 만료. */
export function getRemainingDays(expSeconds: number, nowMs: number = Date.now()): number {
  return (expSeconds * 1000 - nowMs) / (24 * 60 * 60 * 1000);
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad === 1) throw new Error('Invalid base64url string');

  if (typeof atob === 'function') {
    return atob(base64);
  }
  // Node 환경 폴백 (atob 미제공 구버전)
  return Buffer.from(base64, 'base64').toString('utf-8');
}
