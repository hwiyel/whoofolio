# whoofolio

후잉 데이터를 더 보기 쉽게 읽기 위한 개인용 뷰어입니다.  
`개요`, `거래`, `분석`, `계정` 화면을 제공합니다.

## 프로젝트 구조

- `app/web`: React + Vite 프론트엔드
- `app/api`: Go API 서버 (후잉 API 연동)
- `app/api/public`: 프론트 빌드 산출물(서버 정적 서빙)
- `docs`: 설계/운영 문서
- `infra/docker`: Docker 관련 파일
- `scripts`: 로컬 실행 스크립트

## 실행 전 준비

1. 루트 `.env` 작성 (`.env.example` 참고)
2. 필수 값 설정:
- `WHOOING_API_KEY`
- `PORT` (예: `18080`)

## 로컬 실행

### 1) 프론트 빌드 + 정적 반영

```bash
bash scripts/build-web.sh
```

### 2) API 서버 실행

```bash
bash scripts/run-api.sh
```

브라우저에서 `http://127.0.0.1:<PORT>`로 접속합니다.

### 실행 참고

- `scripts/run-api.sh`는 기본적으로 루트 `.env`를 읽어 환경변수를 로드합니다.
- 다른 환경파일을 쓰려면 아래처럼 실행합니다:

```bash
ENV_FILE=/path/to/.env bash scripts/run-api.sh
```

## 주요 기능

- 개요: 순자산 추이 차트
- 거래: 기간 preset(1M/3M/6M/1Y), 계정/키워드 필터
- 분석:
- 월간 분석(수익/비용/남은돈/남는비율)
- 월간 누적 비용 추이
- 카테고리별 비용
- 비용/수익 6개월 추이

## 참고

- 테스트 코드는 아직 없습니다 (`go test ./...` => `No tests found`)
- 문서 인덱스: [docs/README.md](/home/hwiyel/hwiyel/whoofolio/docs/README.md)
