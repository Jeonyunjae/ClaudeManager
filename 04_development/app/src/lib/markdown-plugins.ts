import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';

/**
 * 모든 마크다운 렌더러가 쓰는 기본 플러그인 (BUG-035).
 *
 * CommonMark 규칙상 `**굵게(①)**에서`처럼 닫는 `**` 앞이 문장부호이고 뒤가 한글이면 강조로
 * 인정되지 않아 `**`가 그대로 보인다. 한국어 답변에서 흔한 형태라 CJK 보완 플러그인을 함께 쓴다.
 */
export const baseRemarkPlugins = [remarkCjkFriendly, remarkGfm];
