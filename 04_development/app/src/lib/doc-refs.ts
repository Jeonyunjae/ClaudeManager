/**
 * 대화 속 문서 참조 → 누르면 문서로 이동 (FEAT-004, D-29).
 *
 * 에이전트 답변의 `docs/reports/a.md`, `00-approvals.md` 같은 문서 경로를 마크다운 링크로 바꾼다.
 * 링크 주소는 `#cmdoc=<인코딩된 경로>` — react-markdown 기본 URL 검사를 통과하는 같은 페이지 앵커라
 * 위험한 프로토콜을 허용할 필요가 없고, 화면 쪽 `a` 렌더러가 이 접두어를 보고 문서 화면으로 보낸다.
 */

export const DOC_REF_HASH = '#cmdoc=';

/** 문서 참조 하나 (.md·.txt). 앞뒤가 경로 문자면 더 긴 토큰의 일부라 잡지 않는다 */
const DOC_REF_SOURCE = String.raw`(?<![\w가-힣/.~-])((?:~|\.{1,2})?\/?(?:[\w가-힣.@-]+\/)*[\w가-힣.@-]*[\w가-힣-]\.(?:md|txt))(?![\w가-힣/])`;

export function findDocRefs(text: string): { ref: string; index: number }[] {
  const re = new RegExp(DOC_REF_SOURCE, 'gi');
  const out: { ref: string; index: number }[] = [];
  for (const m of text.matchAll(re)) out.push({ ref: m[1], index: m.index ?? 0 });
  return out;
}

/** 문자열 전체가 문서 참조 하나인가 (인라인 코드 `docs/a.md` 판정용) */
export function isWholeDocRef(text: string): boolean {
  return new RegExp(`^${DOC_REF_SOURCE}$`, 'i').test(text.trim());
}

export function docRefHref(ref: string): string {
  return DOC_REF_HASH + encodeURIComponent(ref);
}

/** `#cmdoc=...` 링크면 참조 경로, 아니면 null */
export function docRefFromHref(href: string | undefined | null): string | null {
  if (!href || !href.startsWith(DOC_REF_HASH)) return null;
  try {
    return decodeURIComponent(href.slice(DOC_REF_HASH.length));
  } catch {
    return null;
  }
}

/** 외부(웹) 링크인가 — 새 창으로 연다 */
export function isExternalHref(href: string | undefined | null): boolean {
  return !!href && /^https?:\/\//i.test(href);
}

// ── remark 플러그인 (mdast를 직접 다룬다 — 타입 패키지 없이 필요한 모양만 정의) ──

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };

/** 링크·코드 블록·HTML 안은 건드리지 않는다 */
const SKIP = new Set(['link', 'linkReference', 'definition', 'code', 'html', 'image', 'imageReference']);

function linkNode(ref: string, child: MdNode): MdNode {
  return { type: 'link', url: docRefHref(ref), children: [child] };
}

function splitText(value: string): MdNode[] | null {
  const refs = findDocRefs(value);
  if (refs.length === 0) return null;
  const out: MdNode[] = [];
  let last = 0;
  for (const { ref, index } of refs) {
    if (index > last) out.push({ type: 'text', value: value.slice(last, index) });
    out.push(linkNode(ref, { type: 'text', value: ref }));
    last = index + ref.length;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

function walk(node: MdNode): void {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (SKIP.has(child.type)) {
      next.push(child);
    } else if (child.type === 'inlineCode' && child.value && isWholeDocRef(child.value)) {
      next.push(linkNode(child.value.trim(), child));
    } else if (child.type === 'text' && child.value) {
      const parts = splitText(child.value);
      if (parts) next.push(...parts);
      else next.push(child);
    } else {
      walk(child);
      next.push(child);
    }
  }
  node.children = next;
}

/** react-markdown `remarkPlugins`에 넣는다: `[remarkGfm, remarkDocRefs]` */
export function remarkDocRefs() {
  return (tree: MdNode) => {
    walk(tree);
  };
}
