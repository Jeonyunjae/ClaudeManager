import path from 'path';
import { MAX_CHAT_ATTACHMENTS } from '@/lib/constants';

/** `/api/upload`이 파일을 저장하는 폴더 */
export const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

export type ChatAttachmentInput = { filename: string; path: string; type: string };

/**
 * 첨부 경로가 업로드 폴더 바로 아래 파일인지 확인한다 (FEAT-001 보안 보완).
 * 채팅 API는 이 경로의 파일을 읽어 에이전트에게 넘기므로, 클라이언트가 보낸 경로를
 * 그대로 믿으면 서버의 임의 파일(`.env.local` 등)을 읽게 된다.
 */
export function isSafeUploadPath(p: unknown, uploadDir: string = UPLOAD_DIR): boolean {
  if (typeof p !== 'string' || p.length === 0) return false;
  const resolved = path.resolve(p);
  return path.dirname(resolved) === path.resolve(uploadDir);
}

/**
 * 채팅 API로 들어온 첨부 목록을 검증한다.
 * 형식이 틀리거나 업로드 폴더 밖을 가리키는 항목이 하나라도 있으면 null(→ 400)을 돌려준다.
 */
export function validateChatAttachments(
  input: unknown,
  uploadDir: string = UPLOAD_DIR
): ChatAttachmentInput[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_CHAT_ATTACHMENTS) return null;

  const out: ChatAttachmentInput[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') return null;
    const { filename, path: p, type } = item as Record<string, unknown>;
    if (typeof filename !== 'string' || typeof type !== 'string') return null;
    if (!isSafeUploadPath(p, uploadDir)) return null;
    out.push({ filename: path.basename(filename).slice(0, 200), path: path.resolve(p as string), type });
  }
  return out;
}
