import type { NextConfig } from "next";
import { execSync } from "child_process";

// 화면에 보이는 버전 (FEAT-005). 운영은 배포 때마다 pm2 restart로 이 설정을 다시 읽으므로
// 그 시점의 커밋이 그대로 표시된다. git이 없으면 빈 값 → 화면은 "버전 정보 없음".
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // 이 콘솔은 워크스테이션(spark-3f44)에서 띄우고 같은 랜의 다른 PC 브라우저로
  // 접속해 쓴다. Next dev는 LAN IP로 들어온 /_next/* 요청을 기본 차단하는데,
  // 그러면 HTML만 오고 하이드레이션이 되지 않아 모든 입력·버튼이 죽는다.
  // 100.110.241.84 는 이 호스트의 Tailscale 주소 — 랜 밖에서 들어올 때 쓴다.
  allowedDevOrigins: ['192.168.30.24', 'spark-3f44', 'spark-3f44.local', '100.110.241.84', 'spark-3f44.tailed65d5.ts.net'],
  // 운영이 next dev라 개발 표시기(화면 좌하단 "N" 버튼)가 모바일 하단 탭
  // [대화]를 가린다(BUG-025). 운영 환경에서는 끈다.
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: git("rev-parse --short HEAD"),
    NEXT_PUBLIC_BUILD_COMMIT_TIME: git("log -1 --format=%cI"),
  },
};

export default nextConfig;
