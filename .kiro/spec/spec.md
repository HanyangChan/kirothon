---
inclusion: auto
---

# Campus Deadline & Alert Agent — Product Spec

## 1. Spec Purpose

이 문서는 Campus Deadline & Alert Agent의 핵심 문제, 사용자 시나리오, 기능 요구사항, 비기능 요구사항, 범위 제한, 수용 기준(acceptance criteria)을 정의한다.

본 Spec의 목적은 다음과 같다.
- 해커톤 MVP 범위를 명확히 고정한다.
- 구현 전 팀이 기능 우선순위를 합의할 수 있게 한다.
- Kiro가 제안한 기능을 사람이 검토·수정·승인할 수 있게 한다.
- 발표 시 "무엇을 왜 이렇게 만들었는가"를 설명 가능하게 한다.

이 문서는 Steering 문서의 원칙을 실제 구현 요구사항으로 구체화한 결과물이다.

## 2. Problem Statement

대학생은 일정이 없어서가 아니라,
과제 / 시험 / 팀플 일정 / 미이행 학습 정보가 여러 플랫폼과 문맥에 흩어져 있어서
무엇을 먼저 해야 하는지 판단하기 어렵고,
결과적으로 중요한 마감을 놓치거나 준비 시점을 놓치는 문제가 반복된다.

대표적인 실패 상황:
- 과제 마감 직전에야 공지를 다시 확인함
- 시험 일정을 따로 정리하지 않아 준비 기간이 부족해짐
- 팀플 발표/회의 일정이 메시지 기록에 묻혀 놓침
- 강의 영상 시청이 밀려 학습 마감 직전에 몰림
- 여러 일정이 동시에 겹쳐 우선순위를 정하지 못함

기존 캘린더나 메모 도구는 정보를 저장할 수는 있지만,
대학생 특유의 입력을 통합 해석하고
"지금 가장 위험한 일"을 스스로 판단하여
즉시 행동 가능한 작업판으로 재구성해주지는 못한다.

## 3. Product Goal

이 서비스의 목표는 다음 세 가지다.

1. 분산된 대학생활 정보를 한곳에 통합한다.
2. 시스템이 우선순위와 리스크를 스스로 계산한다.
3. 중요한 항목은 대시보드와 텔레그램 알림으로 즉시 행동 가능하게 만든다.

즉, 이 제품은 단순 일정 저장 앱이 아니라
대학생의 실행 실패를 줄이기 위한 **운영형 AI Agent**를 목표로 한다.

## 4. Target User

### Primary User
- 과제, 시험, 팀플, 온라인 강의를 동시에 관리해야 하는 대학생
- LMS, 개인 메모, 단체 채팅 등 여러 소스에 일정이 흩어져 있는 사용자
- "무엇을 먼저 해야 하는지"를 빠르게 알고 싶은 사용자

### User Characteristics
- 모든 일정을 체계적으로 정리하지는 못함
- 정보는 갖고 있지만 행동 우선순위를 놓치기 쉬움
- 마감 임박 시점에서 스트레스를 크게 느낌
- 완전 자동화보다도, "지금 가장 위험한 것"을 알려주는 도구를 원함

## 5. Core User Scenario

### Scenario A — 기본 입력 및 정리
1. 사용자가 과제, 시험, 팀플, 학습 관련 정보를 입력한다.
2. 시스템은 입력 내용을 구조화된 작업 항목으로 변환한다.
3. 시스템은 각 항목의 우선순위와 리스크를 계산한다.
4. 대시보드는 Today Top Tasks / This Week Deadlines / Risk Alerts / Study Alerts 등으로 재정렬된다.

### Scenario B — 위험 항목 탐지 및 알림
1. 사용자가 입력한 항목 중 하나 이상이 위험 조건을 만족한다.
2. 시스템은 해당 항목을 Risk Alerts에 노출한다.
3. 시스템은 알림 우선순위가 높은 경우 텔레그램 메시지를 발송한다.

### Scenario C — 정보 불명확 항목 처리
1. 입력 중 날짜, 제목, 역할, 준비 범위 등이 불명확한 항목이 존재한다.
2. 시스템은 해당 항목을 Need Clarification 섹션으로 분류한다.
3. 사용자는 추가 입력을 통해 항목을 명확히 할 수 있다.
4. 정보가 보완되면 시스템은 전체 우선순위를 다시 계산한다.

### Scenario D — 학습 미이행 관리
1. 사용자가 미시청 강의 또는 낮은 학습 진도 정보를 입력한다.
2. 시스템은 학습 마감이 가까울수록 studyPenalty를 증가시킨다.
3. 위험 조건을 만족하면 Study Alerts에 표시하고, 필요 시 알림을 보낸다.

## 6. Input Sources

MVP에서 허용하는 입력 소스는 다음과 같다.
- assignment
- exam
- team_schedule
- study_progress
- optional_canvas_import

### MVP 입력 방식
- 수동 입력
- 반구조화 텍스트 import
- 데모용 JSON import
- 선택적으로 단일 사용자 token 기반 Canvas import 또는 mock import

### 비허용 입력 방식
- 다중 사용자 OAuth 기반 LMS 연동
- 장기 토큰 저장
- 프로덕션 연동을 전제로 한 외부 시스템 통합

## 7. Functional Requirements

### FR-1. Input Collection
시스템은 사용자가 대학생활 관련 정보를 직접 입력하거나 import할 수 있어야 한다.

입력 필드는 **필수 항목**과 **선택 항목**으로 구분한다.

#### 필수 항목
- title 또는 title candidate
- item type
- dueDate 또는 eventDate

#### 입력 경로별 보존 필드
- rawInput 또는 source text: import 경로에서는 원본 텍스트를 보존하는 필드이며, 수동 입력 경로에서는 시스템이 생성하거나 보완할 수 있다. 사용자 필수 입력은 아니다.

#### 선택 항목
- category
- course or context
- importance
- team role / team preparation state
- study progress state
- additional description

MVP에서는 **최소 필수 항목만으로도 항목 생성이 가능해야 하며**,
선택 항목은 입력되었을 때만 파싱 및 계산에 반영한다.

### FR-2. Parsing and Structuring
시스템은 입력된 데이터를 구조화된 내부 항목으로 변환해야 한다.

오류 처리 원칙:
- API 필수 입력값(title, type, dueDate/eventDate) 누락 → validation error (400)
- 반구조화 텍스트에서 parser가 의미 필드를 명확히 추출하지 못함 → clarityFlag=True, riskFlags에 needs_clarification 추가 (에러가 아닌 정상 저장)

최소 추출 대상:
- item type
- title
- due date / event date
- course or context
- status
- ambiguity flag
- study progress related fields (if applicable)

### FR-3. Priority Scoring
시스템은 각 항목에 대해 우선순위 점수를 계산해야 한다.

우선순위 계산에는 최소한 다음 요소가 반영되어야 한다.
- urgency
- importance
- conflict
- effort
- clarity
- studyPenalty
- alertPriority

MVP에서는 정밀 예측 모델보다 **설명 가능한 규칙 기반 상대 평가**를 우선한다.
즉, 복잡한 최적화 모델보다는 "왜 이 항목이 더 먼저 처리되어야 하는가"를
사용자와 심사위원에게 설명 가능한 수준의 계산 구조를 채택한다.

### FR-4. Risk Classification
시스템은 각 항목을 위험 유형 기준으로 분류해야 한다.

최소 위험 유형:
- deadline_soon
- schedule_conflict
- incomplete_study
- needs_clarification
- stale_task

### FR-5. Dashboard Rendering
시스템은 구조화된 항목과 계산 결과를 대시보드로 보여줘야 한다.

최소 섹션:
- Today Top Tasks
- This Week Deadlines
- Risk Alerts
- Need Clarification
- Study Alerts

각 섹션의 정렬 기준, 포함 임계값(상위 N개, 고위험 기준, 미시청 임박 조건 등)은 Design 단계에서 구체화한다.

### FR-6. Recalculation on Update
새 입력이 들어오거나 기존 항목이 수정되면, 시스템은 전체 항목을 재평가해야 한다.

재평가 범위:
- 우선순위 재계산
- 위험 유형 재분류
- 대시보드 재배치
- 알림 대상 재판단

### FR-7. Telegram Notification
시스템은 위험도가 높은 항목이 있을 경우 텔레그램으로 알림을 발송할 수 있어야 한다.

MVP 요건:
- 단일 사용자 알림
- Telegram Bot API 사용
- 단방향 메시지 발송
- 고위험 항목 요약 메시지 형태 지원

### FR-8. Clarification Handling
입력 정보가 불명확하면 시스템은 이를 명시적으로 표시해야 한다.

예:
- 날짜 없음
- 제목 불명확
- 일정은 있으나 우선순위 계산에 필요한 정보 부족
- 팀플 준비 범위가 모호함

### FR-9. Optional Canvas Import
시스템은 선택적으로 Canvas API 구조를 반영한 import 흐름을 가질 수 있다.

MVP 기준:
- 단일 사용자 token 테스트 또는 mock data 수준
- 정식 OAuth 없이 동작
- optional source로 취급
- 핵심 데모를 Canvas 연동 성공 여부에 의존하지 않음

## 8. Non-functional Requirements

### NFR-1. Hackathon Feasibility
전체 기능은 14시간 내 구현 및 데모 가능한 수준이어야 한다.

### NFR-2. Build Stability
최종 결과물은 build 가능한 상태여야 하며, 데모 직전 안정적으로 실행 가능해야 한다.

### NFR-3. Explainability
파싱과 판단 로직은 발표에서 설명 가능한 수준이어야 한다.

### NFR-4. Minimal External Dependency
핵심 기능은 외부 AI API 없이도 동작해야 한다.

### NFR-5. Demo Reproducibility
실제 입력 실패 상황이 있더라도, demo dataset으로 기능을 재현할 수 있어야 한다.

### NFR-6. Single-user Simplicity
MVP는 1인 데모 흐름을 우선하며, 멀티유저 지원을 요구하지 않는다.

## 9. Data and Item Model Requirements

시스템은 내부적으로 공통 Item 모델을 가정한다.

### Required Internal Fields
- id
- type
- title
- rawInput
- dueDate or eventDate
- status
- clarity flag

### Derived or Optional Fields
- category
- course or source
- importance
- urgency
- conflict
- effort
- studyPenalty
- riskFlags
- alertPriority

### Type-specific Notes
- assignment: 제출 마감 중심
- exam: 시험 일시 중심
- team_schedule: 회의/발표/역할/준비 일정 중심
- study_progress: 시청 여부, 진도율, 학습 마감 중심

Spec 단계에서는 공통 Item 모델을 기준으로 정의하고,
세부 구현 시 필요한 추가 필드는 Design 단계에서 최소 범위로 확정한다.

## 10. Risk and Alert Rules

### Risk Rules
시스템은 아래 상황을 위험으로 간주해야 한다.

| 위험 유형 | 내부 명칭 | 설명 |
|-----------|-----------|------|
| 마감 임박 | `deadline_soon` | 마감이 매우 가까움 |
| 일정 충돌 | `schedule_conflict` | 동일 시점 또는 매우 인접한 일정 충돌 |
| 미이행 학습 | `incomplete_study` | 학습 진도가 낮고 마감이 가까움 |
| 정보 불명확 | `needs_clarification` | 일정 판단에 필요한 정보가 누락됨 |
| 장시간 방치 | `stale_task` | 오래 방치되었고 아직 중요한 작업임 |

### Alert Rules
시스템은 아래 조건을 충족하는 경우 알림 후보로 판단한다.
- alertPriority가 임계값 이상임
- deadline_soon이면서 importance가 높음
- incomplete_study가 누적됨
- schedule_conflict로 인해 실질적 놓침 가능성이 큼

MVP에서는 복잡한 알림 히스토리 대신,
"지금 알릴 가치가 있는가"를 기준으로 단순하게 판단한다.

세부 임계값과 가중치는 **demo 안정성과 설명 가능성**을 기준으로
구현 단계에서 조정 가능하다.

## 11. Out of Scope

이번 해커톤 MVP에서 제외하는 항목:
- 로그인 / 회원가입
- 다중 사용자 지원
- 운영용 DB
- OAuth 기반 Canvas 통합
- 장기 토큰 저장
- 프로덕션급 스케줄러
- 모바일 앱
- 커뮤니티 기능
- 고급 통계 분석
- 자연어 대화형 학습비서
- 화려한 UI 효과

## 12. Acceptance Criteria

각 acceptance criteria는 **데모 중 화면 또는 알림 결과로 직접 확인 가능해야 한다.**

### AC-1. Input to Dashboard
사용자가 과제/시험/팀플/학습 정보를 입력하면,
시스템은 이를 구조화하고 대시보드 섹션에 반영해야 한다.

### AC-2. Priority and Risk Visibility
대시보드 또는 item card에서 각 항목의 우선순위 상태 또는 위험 상태를
사용자가 직접 확인할 수 있어야 한다.

### AC-3. Clarification Separation
불명확한 항목은 Need Clarification 섹션으로 구분되어 보여야 한다.

### AC-4. Study Alert Handling
미이행 학습 정보가 입력되면 Study Alerts에서 확인 가능해야 한다.

### AC-5. Telegram Demo
고위험 항목이 존재할 경우 텔레그램 알림 발송 데모가 가능해야 한다.

### AC-6. Recalculation
새 항목 입력 또는 기존 항목 수정 시,
Today Top Tasks / Risk Alerts / Need Clarification / Study Alerts 중
적어도 하나 이상의 섹션 변화가 확인 가능해야 한다.

### AC-7. Demo Safety
Canvas import가 실패하거나 비활성화되어도 핵심 데모는
수동 입력 + demo data로 재현 가능해야 한다.

### AC-8. Build and Deployment
최종 결과물은 최소 1개의 배포 가능한 URL 또는
로컬 실행 가능한 안정 버전을 가져야 한다.

## 13. Human Review Requirements

이 Spec은 AI가 제안한 초안을 그대로 확정하지 않는다.

팀은 최소한 다음을 리뷰해야 한다.
- 범위가 과도하게 넓어지지 않았는가?
- Agentic Thinking이 충분히 드러나는가?
- 대학생활 문제 해결과 직접 연결되는가?
- 14시간 내 구현 가능한가?
- 발표에서 설명 가능한가?

리뷰 결과는 다음 세 가지 중 하나로 기록한다.
- accept
- modify
- reject

## 14. Hooks and Subagent Requirements

### Hooks
최소 다음 자동 검증 흐름을 권장한다.
- parser 테스트 실행
- scoring 테스트 실행
- build 검증

### Subagent
최소 다음 보조 과업 위임을 허용한다.
- 테스트 코드 초안 작성
- Telegram integration 보조
- UI scaffold 보조

단, Subagent 결과는 사람이 검토 후 반영해야 한다.

## 15. Demo Definition

MVP 데모는 다음 흐름을 재현할 수 있어야 한다.

1. 대학생활 입력 데이터 제공
2. 시스템 구조화 결과 확인
3. Today Top Tasks / Risk Alerts / Study Alerts 확인
4. 정보 불명확 항목 확인
5. 새 입력 후 재계산 확인
6. 텔레그램 알림 발송 확인

데모는 실제 사용자 데이터가 없어도 sample dataset으로 재현 가능해야 한다.

### Minimum Demo Dataset
- assignment 2건
- exam 1건
- team_schedule 1건
- study_progress 1건
- clarification 대상 1건

이 최소 데모 세트는 대시보드 변화, 위험 감지, 재계산, 알림 발송을
안정적으로 시연할 수 있어야 한다.

기능 데모 가능 상태와 제출 가능한 안정 상태의 구분은 Tasks 단계에서 Freeze line으로 관리한다.
