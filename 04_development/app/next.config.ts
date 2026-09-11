import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 콘솔은 워크스테이션(spark-3f44)에서 띄우고 같은 랜의 다른 PC 브라우저로
  // 접속해 쓴다. Next dev는 LAN IP로 들어온 /_next/* 요청을 기본 차단하는데,
  // 그러면 HTML만 오고 하이드레이션이 되지 않아 모든 입력·버튼이 죽는다.
  allowedDevOrigins: ['192.168.30.24', 'spark-3f44', 'spark-3f44.local'],
};

export default nextConfig;
