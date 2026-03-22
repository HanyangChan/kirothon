---
inclusion: auto
---

# Campus Deadline & Alert Agent — Project Steering

## 1. Project Identity

- **Project Name:** Campus Deadline & Alert Agent
- **One-line Definition:** 대학생의 과제, 시험, 팀플 일정, 미이행 학습 정보를 통합 수집·구조화하고, 우선순위와 리스크를 스스로 계산하여 대시보드로 보여주며, 필요 시 텔레그램으로 능동적 알림을 발송하는 대학생활 운영 AI Agent
- **Positioning:** 이 서비스는 단순 일정 관리 앱이나 챗봇이 아니다. 입력된 대학생활 데이터를 작업 단위로 구조화하고, 현재 상태를 재해석하며, 우선 행동이 필요한 항목을 재정렬하고, 조건 충족 시 직접 알림까지 수행하는 **운영형(agentic) AI Agent**다.

## 2. Why This Project Exists

대학생은 정보가 부족해서가 아니라, 정보가 여러 플랫폼과 문맥에 흩어져 있어서 중요한 일을 놓친다.

핵심 문제:
- 과제 마감일을 뒤늦게 인지함
- 시험 일정을 따로 관리하지 않아 준비 시점을 놓침
- 팀플 회의/발표 일정이 채팅이나 공지에 묻힘
- 강의 영상 미시청 상태로 학습 마감이 다가옴
- 여러 일정이 겹칠 때 무엇을 먼저 해야 하는지 판단하기 어려움

기존 캘린더나 메모 앱은 일정 저장에는 도움이 되지만, 대학생 특유의 과제/시험/팀플/학습진도를 통합 해석하고 **"지금 가장 위험한 일"**을 판단해주지는 못한다.

## 3. Steering Principles

1. **범위보다 완성도:** 넓은 기능보다, 입력-판단-행동으로 이어지는 핵심 agent loop가 실제로 작동하는 것을 우선한다.
2. **챗봇보다 에이전트성:** 사용자 질문에 답하는 인터페이스보다, `입력 구조화 → 우선순위 재계산 → 리스크 탐지 → 행동(알림)` 흐름이 핵심이다.
3. **설명 가능성 우선:** 판단 기준은 최대한 명확하고 설명 가능한 형태로 유지한다. 발표 시 "왜 이 항목이 위험한가"를 규칙과 점수 구조로 설명할 수 있어야 한다.
4. **인간 검토 중심:** Kiro가 생성한 결과를 그대로 수용하지 않고, 팀이 각 단계에서 해석·수정·승인한다. 모든 문서는 초안 생성 후 팀 리뷰를 거쳐 범위 적합성, 데모 가능성, 설명 가능성을 기준으로 승인한다.
5. **배포 가능성 유지:** 시연 가능한 URL과 안정적인 build를 우선하며, 기능 과확장을 금지한다.

## 4. Hackathon Success Criteria

| 심사 기준 | 배점 | 대응 전략 |
|---|---:|---|
| Prompt/Spec Quality | 25점 | 문제 정의, 요구사항, 설계 구조, 제외 범위를 명확히 문서화 |
| Agentic Thinking | 25점 | 구조화 → 우선순위 계산 → 리스크 감지 → 재계산 → 알림 발송의 자율 워크플로우 |
| Campus Impact | 15점 | 대학생 마감 놓침/학습 미이행 문제를 직접 해결 |
| Completeness | 15점 | 배포 가능한 프로토타입과 안정적인 데모 시나리오 확보 |
| 출석 | 20점 | 전 일정 참여 및 최종 시연 준비 |

본 프로젝트의 성공은 기능 구현 자체뿐 아니라,
**Kiro가 제안한 Spec을 사람이 어떻게 검토·수정·승인했는지**,
**Hooks와 Subagent를 통해 어떤 자율 개발 흐름을 설계했는지**까지 포함하여 판단한다.

## 5. Official Alignment with Kirothon

- 본 대회는 단순 코딩 숙련도가 아니라, **Spec 중심의 자율 개발 공정**을 얼마나 논리적이고 안정적으로 수행했는지를 평가한다.
- 아이디어 정의 → Spec 생성 → 구현 → 배포 → 자동 테스트(Hooks)로 이어지는 전체 에이전트 워크플로우를 보여줘야 한다.
- 최종 발표에서는 "무엇을 만들었는가"뿐 아니라 **"어떻게 AI와 협업하여 개발했는가"**를 설명할 수 있어야 한다.

## 6. Core Problem Scope

포함 영역:
- **assignment:** 과제 마감
- **exam:** 시험 일정
- **team_schedule:** 팀플 회의 / 발표 / 준비 일정
- **study_progress:** 미시청 강의, 미이행 학습 상태

이 네 가지는 대학생의 실제 마감 스트레스와 가장 직접적으로 연결되며,
하나의 대시보드와 하나의 리스크 엔진으로 통합하기에 가장 적절한 범위다.

## 7. MVP Scope

### 반드시 포함
- 수동 입력 또는 반구조화 import를 통한 일정/학습 데이터 수집
- 입력 데이터를 구조화하는 parser
- 우선순위 및 리스크 점수 계산 엔진
- 통합 대시보드
- 위험 항목에 대한 텔레그램 알림 발송
- 새 데이터 입력 시 자동 재계산

### Dashboard Sections
- Today Top Tasks
- This Week Deadlines
- Risk Alerts
- Need Clarification
- Study Alerts

### MVP 사용자 흐름
입력 → 구조화 → 우선순위/리스크 계산 → 정보 불명확 항목 식별 → 대시보드 재배치 → 고위험 항목 텔레그램 알림 → 새 입력 시 재계산

## 8. Agentic Workflow Definition

### Agent Loop
```text
입력 수집 → 항목 구조화 → 우선순위 계산 → 리스크 분류 → 대시보드 재정렬 → 알림 판단 → 텔레그램 발송 → 새 입력 시 재계산
```

### 에이전틱 속성
- 사용자 입력을 내부 작업 모델로 변환
- 현재 상태를 스스로 해석
- 우선 대응 항목을 계산
- 조건 충족 시 행동 수행
- 새 정보가 들어오면 상태를 다시 평가

### Why This Counts as an Agent
이 시스템은 단순 저장소나 챗봇이 아니다. 입력된 데이터를 해석하고, 판단 기준에 따라 상태를 재분류하고, 행동까지 수행하는 운영형 워크플로우를 가진다.

## 9. Human-AI Collaboration Policy

- Kiro 초안 → 사람 검토 → 수정 → 승인 순서를 따른다.
- 문제 정의, 범위, 기능 우선순위는 사람이 최종 결정한다.
- 구현 전 Steering / Spec / Design / Tasks를 단계별로 리뷰한다.
- AI 제안 중 과확장 요소는 제거한다.
- 발표 시 "채택한 제안 / 수정한 제안 / 기각한 제안"을 설명 가능해야 한다.
- Design과 Tasks 변경 사항은 팀 리뷰를 통해 accept / modify / reject로 기록한다.

### 문서 리뷰 체크포인트
- 이 기능이 대학생활 문제 해결과 직접 연결되는가?
- 이 기능이 agentic 판단을 보여주는가?
- 14시간 내 구현 가능한가?
- 데모와 배포 안정성을 해치지 않는가?
- 설명 가능한 규칙으로 유지되는가?

## 10. Hooks and Subagent Strategy

### 확정 Hooks
- 입력 파싱 테스트 자동 실행
- risk scoring 테스트 자동 실행
- build 성공 여부 검증

### 추가 Hooks 후보
- 리스크 분류 regression test
- 알림 조건 검증 test

### 확정 Subagent
- 테스트 코드 초안 생성
- Telegram integration 보조

### 추가 Subagent 후보
- UI scaffold 보조
- optional import module 보조

### 적용 원칙
- 반복적이고 독립 가능한 하위 과업은 AI에 위임할 수 있다.
- 핵심 비즈니스 판단과 최종 승인 권한은 팀이 가진다.
- Hooks와 Subagent는 "AI가 배경에서 실제 과업을 수행했다"는 증거로 활용한다.

## 11. LMS / Canvas Positioning

### MVP 허용
- 단일 사용자 테스트용 token 기반 import
- Canvas API 구조를 반영한 optional import 설계
- 데모용 제한적 연동 또는 mock import

### MVP 제외
- OAuth 2.0 기반 다중 사용자 인증
- 장기 토큰 저장
- 운영용 DB
- 실제 서비스 수준 scheduler
- 프로덕션 운영을 전제로 한 LMS 계정 통합

### 판단 원칙
Canvas 연동은 매력적이지만, MVP의 중심은 LMS 연동 자체가 아니라 분산된 대학생활 정보를 agent가 구조화·판단·알림하는 핵심 루프다.

## 12. Parsing and Decision Logic Policy

### Parser: 규칙 기반
채택 이유:
- API 키 의존 제거
- 발표 안정성 확보
- 결과 설명 가능성 향상
- 테스트 용이성 확보

### Parsing Targets
날짜, 카테고리, 제목 후보, 팀플 관련 인원/역할, 학습 진도 상태, 정보 누락 여부

### Decision Engine 요소
urgency, importance, conflict, effort, clarity, studyPenalty, alertPriority

## 13. Risk Model

### 주요 위험 유형
마감 임박, 일정 충돌, 미이행 학습, 정보 불명확, 장시간 방치된 과제

구현 문서에서의 내부 명칭 매핑:
- 마감 임박 = `deadline_soon`
- 일정 충돌 = `schedule_conflict`
- 미이행 학습 = `incomplete_study`
- 정보 불명확 = `needs_clarification`
- 장시간 방치 = `stale_task`

### 알림 대상 조건
아래 중 하나라도 강하게 충족하면 알림 후보가 된다:
- 마감이 매우 가까움
- 중요도 높은데 미착수
- 미시청 강의/학습이 누적됨
- 일정 충돌로 놓침 가능성이 높음
- 정보가 불명확하여 즉시 확인이 필요함

### 서비스 관점
대시보드는 단순 목록이 아니라, **"지금 행동해야 할 일"**을 중심으로 재정렬되는 운영판이어야 한다.

## 14. Technical Direction

- Frontend: 기존 MVP 웹 UI 유지
- Backend: 기존 API route / planner / parser 기반 유지
- Notification: Telegram Bot API
- Storage: 인메모리 또는 JSON/demo data 중심
- Deploy: build 안정성 최우선의 단순 배포 구조

### 기술 원칙
- 새로운 스택으로 재구축하지 않는다.
- 기존 MVP 자산을 최대한 재사용한다.
- 재개발보다 안정화와 데모 완성도를 우선한다.

## 15. Out of Scope

다음은 이번 해커톤 MVP에서 제외한다:
로그인/회원가입, 다중 사용자 지원, 운영용 DB, OAuth 기반 Canvas 통합, 복잡한 자연어 챗 인터페이스, 모바일 앱, 커뮤니티 기능, 고급 통계 분석, 프로덕션급 스케줄러, 지나치게 화려한 UI 효과

### 제외 이유
이 기능들은 흥미롭지만, 현재 평가 목표인 Spec 품질, agentic workflow, 캠퍼스 문제 해결력, 배포 가능한 완성도를 오히려 약화시킬 가능성이 높다.

## 16. Deliverable Definition

### 완료 기준 3단계
1. **기능 데모 가능한 MVP:** 핵심 에이전틱 루프(입력 → 구조화 → 계산 → 대시보드 → 알림)가 end-to-end로 작동하는 상태. Tasks 문서의 Freeze line(Task 11) 기준.
2. **제출 가능한 안정 상태:** P0 테스트(parser, scoring, dashboard rendering, build smoke)가 통과하고 Hooks에 연결된 상태. Tasks 문서의 Task 12 완료 기준.
3. **최종 제출 패키지:** 배포 가능한 결과물 URL, 데모 재현용 sample input dataset, 핵심 Hooks 검증 결과, 발표용 협업 스토리라인

### Deliverables
1. **서비스 프로토타입:** 입력 → 판단 → 출력 → 알림 흐름이 작동하는 웹 서비스
2. **문서 세트:** Steering, Spec, Design, Tasks
3. **AI-human collaboration evidence:** Kiro 초안, 팀 검토/수정 흔적, Hooks 적용 포인트, Subagent 위임 포인트

## 17. Team Decision Rule

모든 의사결정은 아래 질문으로 판단한다:
1. Prompt/Spec Quality에 도움이 되는가?
2. Agentic Thinking을 더 분명하게 보여주는가?
3. 대학생활 문제 해결과 직접 연결되는가?
4. Completeness를 해치지 않는가?
5. 14시간 내 구현과 데모가 가능한가?

하나라도 강하게 "아니오"면, 그 기능은 넣지 않거나 뒤로 미룬다.

## 18. Final Steering Statement

Campus Deadline & Alert Agent는 대학생의 과제, 시험, 팀플, 미이행 학습 문제를 단순 기록이 아닌 운영 가능한 작업 체계로 전환하는 AI Agent를 목표로 한다.

우리는 범용 챗봇이 아니라, 입력을 구조화하고, 우선순위를 판단하고, 리스크를 탐지하고, 행동 가능한 알림까지 수행하는 대학생 특화 운영 에이전트를 만든다.

그리고 그 과정 또한 Kiro의 Spec 생성 → 인간의 검토/수정 → Subagent 활용 → Hooks 기반 검증 → 배포 라는 대회 취지에 맞는 방식으로 설계한다.
