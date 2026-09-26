/**
 * 첨부 경로 검증 단위 테스트 — FEAT-001 보안 보완
 * 채팅 API는 첨부 경로의 파일을 읽어 에이전트에게 넘기므로 업로드 폴더 밖 경로를 막아야 한다.
 */
import { describe, it, expect } from 'vitest';
import { isSafeUploadPath, validateChatAttachments } from '@/lib/uploads';
import { MAX_CHAT_ATTACHMENTS } from '@/lib/constants';

const DIR = '/srv/app/data/uploads';
const ok = (name: string) => ({ filename: 'IMG_0001.jpg', path: `${DIR}/${name}`, type: 'image/jpeg' });

describe('isSafeUploadPath', () => {
  it('업로드 폴더 바로 아래 파일은 허용한다', () => {
    expect(isSafeUploadPath(`${DIR}/abc.jpg`, DIR)).toBe(true);
  });

  it.each([
    ['상위 폴더 탈출', `${DIR}/../../.env.local`],
    ['다른 절대 경로', '/etc/passwd'],
    ['업로드 폴더 자체', DIR],
    ['하위 폴더', `${DIR}/sub/abc.jpg`],
    ['이름이 비슷한 형제 폴더', `${DIR}-evil/abc.jpg`],
    ['빈 문자열', ''],
  ])('%s는 거부한다', (_label, p) => {
    expect(isSafeUploadPath(p, DIR)).toBe(false);
  });

  it('문자열이 아니면 거부한다', () => {
    expect(isSafeUploadPath(undefined, DIR)).toBe(false);
    expect(isSafeUploadPath(42, DIR)).toBe(false);
  });
});

describe('validateChatAttachments', () => {
  it('첨부가 없으면 빈 배열', () => {
    expect(validateChatAttachments(undefined, DIR)).toEqual([]);
    expect(validateChatAttachments(null, DIR)).toEqual([]);
  });

  it('정상 첨부는 그대로 돌려준다', () => {
    expect(validateChatAttachments([ok('a.jpg')], DIR)).toEqual([ok('a.jpg')]);
  });

  it('하나라도 폴더 밖이면 전체를 거부(null)한다', () => {
    expect(validateChatAttachments([ok('a.jpg'), { ...ok('b.jpg'), path: '/etc/passwd' }], DIR)).toBeNull();
  });

  it('배열이 아니거나 형식이 틀리면 거부한다', () => {
    expect(validateChatAttachments('x', DIR)).toBeNull();
    expect(validateChatAttachments([{ path: `${DIR}/a.jpg` }], DIR)).toBeNull();
    expect(validateChatAttachments([null], DIR)).toBeNull();
  });

  it(`${MAX_CHAT_ATTACHMENTS}개를 넘으면 거부한다`, () => {
    const list = Array.from({ length: MAX_CHAT_ATTACHMENTS + 1 }, (_, i) => ok(`${i}.jpg`));
    expect(validateChatAttachments(list, DIR)).toBeNull();
    expect(validateChatAttachments(list.slice(0, MAX_CHAT_ATTACHMENTS), DIR)).toHaveLength(MAX_CHAT_ATTACHMENTS);
  });

  it('파일명에서 경로 부분을 떼어낸다', () => {
    const [a] = validateChatAttachments([{ ...ok('a.jpg'), filename: '../../x/IMG.jpg' }], DIR)!;
    expect(a.filename).toBe('IMG.jpg');
  });
});
