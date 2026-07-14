#!/usr/bin/env bash
#
# 두 기기(교사=노트북 / 학부모=폰)로 M4 실시간 STT·Hold를 테스트하기 위한 개발 환경.
#
#   - Next.js dev 서버를 localhost:3000 에 띄운다 (교사는 여기로 접속 → 카카오 로그인 정상).
#   - cloudflared 퀵 터널로 공개 HTTPS URL을 뚫는다 (학부모 폰은 여기로 접속 → 마이크/STT는
#     secure context가 필수라 http LAN IP로는 안 되고 HTTPS가 반드시 필요).
#
# 사용법:  ./scripts/dev-tunnel.sh
# 종료:    Ctrl+C  (dev 서버와 터널을 함께 정리)
#
set -euo pipefail

PORT=3000
MODE="${1:-prod}"   # prod(기본, 실기기 테스트용) | dev(데스크톱 빠른 반복용)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v cloudflared >/dev/null 2>&1 || { echo "❌ cloudflared 가 없습니다.  brew install cloudflared"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm 이 없습니다."; exit 1; }

TUNNEL_LOG="$(mktemp -t cf-tunnel)"
DEV_PID=""
CF_PID=""

cleanup() {
  echo ""
  echo "🧹 정리 중..."
  [[ -n "$CF_PID"  ]] && kill "$CF_PID"  2>/dev/null || true
  [[ -n "$DEV_PID" ]] && kill "$DEV_PID" 2>/dev/null || true
  rm -f "$TUNNEL_LOG"
}
trap cleanup EXIT INT TERM

if [[ "$MODE" == "prod" ]]; then
  echo "▶️  프로덕션 빌드 (npm run build) — 실기기 테스트는 이 모드 권장..."
  npm run build
  echo "▶️  Next.js 프로덕션 서버 시작 (localhost:$PORT)..."
  npx next start -p "$PORT" >/dev/null 2>&1 &
  DEV_PID=$!
else
  echo "▶️  Next.js dev 서버 시작 (localhost:$PORT) — 데스크톱 반복용 (모바일 hydration 불안정)..."
  npm run dev -- -p "$PORT" >/dev/null 2>&1 &
  DEV_PID=$!
fi

# dev 서버가 포트를 열 때까지 대기 (최대 ~40초)
echo -n "   서버 준비 대기"
for _ in $(seq 1 80); do
  if curl -s -o /dev/null "http://localhost:$PORT" 2>/dev/null; then break; fi
  echo -n "."
  sleep 0.5
done
echo " OK"

echo "▶️  cloudflared 터널 시작..."
cloudflared tunnel --url "http://localhost:$PORT" >"$TUNNEL_LOG" 2>&1 &
CF_PID=$!

# 터널 로그에서 공개 URL 추출 (최대 ~30초)
TUNNEL_URL=""
for _ in $(seq 1 60); do
  TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
  [[ -n "$TUNNEL_URL" ]] && break
  sleep 0.5
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "❌ 터널 URL을 찾지 못했습니다. 로그:"; cat "$TUNNEL_LOG"; exit 1
fi

cat <<BANNER

┌────────────────────────────────────────────────────────────────────┐
│  ✅ 테스트 환경 준비 완료                                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  👩‍🏫 교사(노트북, 이 컴퓨터):                                        │
│      http://localhost:$PORT/dashboard                                  │
│      → 카카오 로그인 → 방 생성 → "공유 링크 복사"                    │
│                                                                      │
│  📱 학부모(폰): 복사한 링크의 앞부분을 아래 터널 주소로 바꿔 접속    │
│      $TUNNEL_URL/call/<token>
│                                                                      │
│      (예: 복사된 http://localhost:$PORT/call/ABC123 →                  │
│            $TUNNEL_URL/call/ABC123)
│                                                                      │
├────────────────────────────────────────────────────────────────────┤
│  ⚠️  두 기기를 같은 WiFi에 두세요 (TURN 없이 STUN만 쓰므로           │
│      서로 다른 네트워크면 P2P 연결이 안 될 수 있음).                 │
│  ⚠️  폰에서 마이크 권한을 허용하세요.                                │
├────────────────────────────────────────────────────────────────────┤
│  종료: Ctrl+C                                                        │
└────────────────────────────────────────────────────────────────────┘

BANNER

# 두 프로세스가 살아있는 동안 대기
wait
