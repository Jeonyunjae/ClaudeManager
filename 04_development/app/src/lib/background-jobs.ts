/**
 * 기동 작업(백업·리포트·키 만료 검사·Main 재개·파일 감시) 실행 여부 판정.
 *
 * 테스트 인스턴스(claudemanager-mtest)는 운영 DB를 건드리지 않기 위해
 * 이 작업들을 건너뛴다 (NFR-002, DES-001 §테스트 인스턴스 구성).
 * WS 서버·WS 핸들러·세션 persister/loader는 이 판정과 무관하게 항상 켜져 있다.
 *
 * 값이 없거나 'off'가 아니면(오탈자·다른 값 포함) 항상 true — 운영 환경은
 * 이 변수를 설정하지 않으므로 기존 동작이 그대로 유지된다.
 */
export type BackgroundJobsEnv = Record<string, string | undefined>;

export function backgroundJobsEnabled(env: BackgroundJobsEnv): boolean {
  return env.CM_BACKGROUND_JOBS !== 'off';
}
