# 초기 프로젝트 구조

## 목표

초기 구조는 작고 명확해야 한다. 단일 사용자, 단일 서비스, read-only 중심이라는 전제를 코드 구조에도 반영한다.

## 권장 폴더 구조

```text
whoofolio/
├─ docs/
├─ infra/
│  └─ docker/
│     ├─ compose.yml
│     └─ Caddyfile
├─ app/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ pages/
│  │  │  ├─ components/
│  │  │  ├─ features/
│  │  │  ├─ hooks/
│  │  │  ├─ lib/
│  │  │  └─ styles/
│  │  ├─ public/
│  │  └─ package.json
│  └─ api/
│     ├─ cmd/server/
│     ├─ internal/
│     │  ├─ whooing/
│     │  ├─ sync/
│     │  ├─ overview/
│     │  ├─ transactions/
│     │  ├─ categories/
│     │  ├─ accounts/
│     │  ├─ db/
│     │  └─ config/
│     ├─ migrations/
│     └─ go.mod
└─ .env.example
```

## 프론트엔드 구조 설명

- `app/web/src/app/`: 라우터, 전역 provider, 앱 시작점
- `app/web/src/pages/`: 화면 단위 페이지
- `app/web/src/components/`: 여러 페이지에서 재사용하는 UI
- `app/web/src/features/`: 거래, 카테고리, 계정 같은 도메인별 묶음
- `app/web/src/hooks/`: 공통 훅
- `app/web/src/lib/`: 포맷터, API 클라이언트, 공통 유틸

초기에는 `pages`와 `features`를 같이 쓰되, 지나친 추상화는 피한다.

## 백엔드 구조 설명

- `cmd/server/`: 실행 진입점
- `internal/whooing/`: 후잉 API 클라이언트
- `internal/sync/`: 동기화 로직과 스케줄 작업
- `internal/overview/`: 개요 화면용 집계 API
- `internal/transactions/`: 거래 조회와 필터 API
- `internal/categories/`: 카테고리 집계 API
- `internal/accounts/`: 계정별 잔액과 흐름 API
- `internal/db/`: DB 연결, 쿼리, 저장소 계층
- `internal/config/`: 환경 변수와 설정 로딩
- `migrations/`: 스키마 변경 관리

## 이 구조를 택하는 이유

- 프론트와 백엔드 책임이 분명히 나뉜다
- Docker 배포 단위와 코드 구조가 자연스럽게 맞는다
- 후잉 연동, 동기화, 조회 API가 어디에 있는지 금방 찾을 수 있다
- 개인 프로젝트에서 과한 모노레포 복잡도를 피할 수 있다

## 일부러 하지 않는 것

- `packages/` 기반 대형 모노레포
- 마이크로서비스 분리
- 복잡한 이벤트 버스
- 범용 플러그인 시스템

지금 필요한 것은 확장성 과시가 아니라, 빨리 끝내고 오래 쓰는 구조다.
