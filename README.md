# whoofolio

후잉 데이터를 더 읽기 쉽게 보여주는 개인용 자산/가계 흐름 뷰어입니다.

현재 화면 구성:
- `대시보드`
- `월간분석`
- `수입분석`
- `지출분석`
- `거래내역`

## 프로젝트 구조

- `app/web`: React + Vite 프론트엔드
- `app/api`: Go API 서버
- `app/api/public`: 프론트 빌드 결과물 정적 서빙 디렉터리
- `docs`: 설계/운영 문서
- `scripts`: 로컬 실행 스크립트

## 환경 변수

루트에 `.env` 파일을 두고 실행합니다. 예시는 `.env.example`을 참고합니다.

주요 값:
- `WHOOING_API_KEY`
- `PORT`
- `VITE_API_PROXY_TARGET`

기본 개발 조합 예시:

```env
PORT=8080
VITE_API_PROXY_TARGET=http://127.0.0.1:8080
```

## 로컬 개발

### API 서버 실행

```bash
bash scripts/run-api.sh
```

- 루트 `.env`를 자동으로 읽습니다.
- 다른 env 파일을 쓰려면:

```bash
ENV_FILE=/path/to/.env bash scripts/run-api.sh
```

직접 실행도 가능합니다.

```bash
cd app/api
go run ./cmd/server
```

### 프론트 개발 서버 실행

```bash
cd app/web
npm install
npm run dev
```

- 기본 주소: `http://127.0.0.1:5173`
- `/api` 요청은 `VITE_API_PROXY_TARGET`으로 프록시됩니다.

## 정적 빌드

프론트 결과물을 API 서버의 정적 디렉터리로 복사합니다.

```bash
bash scripts/build-web.sh
```

동작:
- `app/web`에서 `npm run build`
- 산출물을 `app/api/public`으로 복사

## 주요 기능

### 대시보드

- 순자산 히어로 차트
- 기간 preset: `1W / 1M / 3M / 6M / 1Y / 3Y / 5Y`
- 금액 숨기기
- 다크/라이트 모드 전환

### 월간분석

- 최근 5개월 preset
- 월 수입 / 지출 / 순현금흐름 요약
- 월 누적 지출 추이
- 월 지출 구성
- 월 수입 구성
- 월 아이템 목록

### 수입분석

- preset: `최근 1년 / 작년 / 올해`
- 수입총계 / 수입평균
- 월별 수입 막대 + 누적 수입 선 그래프

### 지출분석

- preset: `최근 1년 / 작년 / 올해`
- 지출총계 / 지출평균
- 월별 지출 막대 + 누적 지출 선 그래프

### 거래내역

- 기간 preset
- 계정 필터
- 키워드 검색

## API 엔드포인트

- `GET /api/overview`
- `GET /api/overview/trend?range=1Y`
- `GET /api/reports/monthly?month=YYYY-MM`
- `GET /api/transactions`
- `GET /api/accounts`

## 참고

- 프론트 빌드 명령: `cd app/web && npm run build`
- 백엔드 테스트 명령: `cd app/api && go test ./...`
- 라이선스: `MIT` ([LICENSE](/home/hwiyel/hwiyel/whoofolio/LICENSE))
- 문서 인덱스: [docs/README.md](/home/hwiyel/hwiyel/whoofolio/docs/README.md)
