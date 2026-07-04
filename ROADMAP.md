# 진행 상황 & 남은 작업

배포 중: **https://suiko.atah.io** (커스텀 도메인, `docs/CNAME`) / KR만 (`docs/kr.html`), GitHub Pages(`docs/` 폴더 기준)

## 완료

- **엔진**: doswasmx(nbarkhina/DosWasmX, MIT)를 커스텀 재빌드. `src/gui/sdlmain.cpp`의 `MIDI_RawOutByte`/`MIDI_Available` 스텁을 패치해 MIDI 바이트를 `window.SuikoMidi.raw()`로 브리지. 재빌드 방법은 메모리(`suiko-web-v2-wasm-rebuild`)에 기록됨 — emsdk 3.1.49 + caiiiycuk/binaryen-fwasm-exceptions의 macOS wasm-opt 필요.
- **색감/PCM**: doswasmx 그대로 정상 동작 확인.
- **MIDI 사운드폰트**: Win95 MIDI 매퍼를 "External MIDI Port"로 설정하면 게임 MIDI가 브리지를 타고 JS의 spessasynth로 흘러 SC-55.sf3(9MB, 원본 sf2 53MB에서 변환)로 렌더링. MIDI 매퍼 기본값은 **베이스 이미지에 베이킹됨**(수동 설정 후 doswasmx "Export Hard Drive"로 내보낸 이미지의 SYSTEM.DAT를 그대로 채택) — 부팅하면 자동 적용, 사용자 조작 불필요.
- **세이브**: `src/fat16.js`(FAT16 파일 단위 추출/주입) + `docs/suiko-save.js`(부팅 전 IndexedDB → 디스크 이미지 주입, 부팅 후 폴링으로 변경 감지 시 SAVEDATA만 추출 저장). doswasmx의 디스크 전체 저장 방식을 완전히 대체함. 디렉토리 엔트리의 날짜/시각 필드도 같이 보존해 복원된 세이브가 원래 저장 시각을 유지. 저장/복원 시 토스트 알림. `test/fat16.test.js`로 검증.
- **사이즈**: 원본 94MB → gzip 전송 기준 최종 KR 이미지 약 27.9MB. `tools/strip-image.js`(불필요 Win95 컴포넌트·서양 폰트 삭제, 빈 공간 제로화) + SC-55 SF3 변환(53MB→9MB)이 핵심 레버.
- **부팅 자동화**: `MSDOS.SYS`에 `AutoScan=0` 추가해 스캔디스크 프롬프트 제거. WIN.INI `load=`로 게임 자동 실행.
- **배포 로딩**: 디스크 이미지를 gzip으로 저장, `script.js`의 `load_url_request`에 매직바이트(`1f 8b`) 감지 후 `DecompressionStream` 인플레이트 패치.
- **UI 전면 재구성**: doswasmx 데모 페이지에 스타일만 얹는 방식에서, **gensei-pc98의 `style.css`를 그대로 가져와 기반으로 삼고** `suiko-overrides.css`로 최소 델타(4:3 화면비, `#canvasDiv` 특이사항)만 얹는 방식으로 전환. 로고 이미지, `footer.js`(atah.io 공용, `data-emulator="dos"` 분기), 게인 기반 뮤트(AudioContext suspend/resume 대신 — 브라우저가 조작 시 자동 재개시키는 문제 회피), 단일 `#toast` 알림 채널(로딩 상태·ESC 힌트·세이브 알림 통합), 전체화면 ESC 롱프레스(Keyboard Lock API) 이식.
- **미사용 코드 대거 제거**: doswasmx 데모 UI(헤더, Browse/Save Drive/Settings/Login 버튼, 모달 4개, CPU·Advanced 드롭다운, doswasmx 자체 모바일 터치 UI)를 실제로 삭제(`kr.html` 412→135줄대). Bootstrap/Popper/font-awesome/FileSaver/nipplejs 제거(전부 도달 불가 경로에서만 참조됨을 확인 후 제거). rivets.bind() 호출도 삭제된 요소에 맞춰 정리.
- **모바일 버그 수정**: doswasmx 자체 `mobileMode` 분기가 삭제된 요소(`#divTouchSurface` 등)를 참조해 부팅 시 예외로 죽던 문제 → `mobileMode` 항상 false로 우회(모바일 UX는 gensei-pc98 가상 게임패드+반응형 CSS로 전담). 부팅 후 레이아웃이 흔들리던 문제(`resizeCanvas()`의 인라인 스타일 조작) 수정. 가로 모드에서 캔버스 위아래가 잘리던 문제 → `@media (orientation: landscape) and (pointer: coarse)`로 세로(뷰포트 높이) 기준 4:3 계산 추가.
- **iOS Chrome·모바일 가로/세로 실기 테스트 완료** (LAN 서버로 검증).

## 남은 작업

### 1. JP 빌드
- `original/jp/`(GENSE.OLD 계열, 1997 원본 정본)를 KR과 동일한 방식으로 Win95 이미지에 설치해 JP 베이스 이미지 제작 (`tools/build-image.js`, `tools/strip-image.js` 재사용, MIDI 매퍼 베이킹도 동일 절차 반복)
- `docs/jp.html` 신설 — `kr.html`과 구조는 동일, 이미지 경로(`final-jp.img`)와 로고/타이틀만 교체. 페이지 자체는 URL로만 분리(`kr.html`/`jp.html`), 별도 허브 페이지 없음
- **세이브 호환 검증**: KR/JP 세이브 포맷이 같다고 확인됨(사용자 보장, `suiko-save.js`도 이미 언어 독립적 IndexedDB 키 사용) — 실제로 KR에서 저장 → JP 페이지에서 로드, 반대 방향도 확인 필요

### 2. KR 정식 번역 오타·오역 수정
- 웹 관련 작업이 아니라 **게임 데이터 자체**(`original/kr/HWANSE.EXE` 및/또는 `GENSE.FLD`)에 내장된 기존 정식 한글 번역의 오타·오역을 찾아 고치는 작업. 새 번역이 아니라 기존 번역의 부분 수정
- 텍스트가 `HWANSE.EXE` 리소스에 있는지 `GENSE.FLD`(필드/텍스트 데이터, ~2.8MB)에 있는지부터 확인 필요 — 아직 역공학 안 됨
- `create-kr-patch` 스킬(레트로 게임 한글 패치 제작 파이프라인: 초기 조사 → 인코딩/포인터 구조 파악 → 추출 → 수정 → 재삽입 → 검증)로 진행 예정. 착수 시 `Skill create-kr-patch` 호출부터 시작
- 아직 착수 전(토큰/시간 문제로 보류) — 다음 세션에서 초기 조사부터 시작

### 3. 자잘한 후속 확인
- **`#githubDiv`("View source on GitHub" 링크, `github_logo.png`)**: `finishInitialization()`에서 `$('#githubDiv').show()`로 실제 노출될 수 있는 코드가 남아있음 — 완전히 죽은 코드가 아니라 부팅 후 화면에 나타날 가능성 있음. 필요/불필요 확인 후 제거 또는 유지 결정
- **MIDI 재생 초기 딜레이**: 사운드폰트 로딩 중 도착한 메시지를 큐잉→flush 처리했지만 약간의 지연 보고됨. 우선순위 낮음, 보류
- `.vendor-tmp/`(doswasmx 소스 클론, gitignored)는 재빌드 필요시 대비 로컬 보존. 절차는 메모리 `suiko-web-v2-wasm-rebuild.md` 참고

## 참고 자료
- 계획 원본: `~/.claude/plans/harmonic-dancing-gem.md`
- 프로젝트 결정사항 메모리: `suiko-web-v2-project`, `suiko-web-v2-original-files`, `suiko-web-v2-save-structure`, `suiko-web-v2-wasm-rebuild` (Claude 메모리 디렉토리)
- 커밋/푸시는 사용자가 명시적으로 요청할 때만 (메모리 `feedback-commit-push-explicit-only`)
