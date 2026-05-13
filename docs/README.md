# 문서 개요

이 폴더는 `whoofolio`의 제품 방향과 구현 설계를 정리합니다. `whoofolio`는 후잉 데이터를 더 보기 좋게 읽고 분석하기 위한 개인용 클라이언트입니다.

## 문서 구조

- `product/vision.md`: 제품 목표, 범위, MVP 원칙
- `product/screens.md`: 정보구조와 핵심 화면 설계
- `product/reports.md`: 1차 보고서 범위와 구현 순서
- `architecture/system-design.md`: 시스템 구성, 데이터 흐름, 기술 스택
- `architecture/stack-decisions.md`: 기술별 역할과 선택 이유
- `architecture/project-structure.md`: 초기 폴더 구조 제안
- `deployment/docker.md`: 개인 서버용 Docker 배포 방안
- `todo.md`: 현재 구현 우선순위와 다음 작업 목록

## 기본 원칙

- 원장은 후잉이 맡고, `whoofolio`는 조회와 분석에 집중한다.
- 초기 버전은 read-only를 기본으로 한다.
- 멀티테넌시보다 단일 사용자 운영 단순성을 우선한다.
- 로컬 저장소는 캐시와 사용자 설정 저장용이지, 원장 대체물이 아니다.
