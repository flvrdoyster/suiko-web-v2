# suiko-web-v2 — 진행 상황 & 노트

배포 중: **https://suiko.atah.io** (`docs/CNAME`), GitHub Pages(`docs/` 폴더) — KR(`kr.html`)·
JP(`jp.html`) 모두 서비스, 공유 디스크 이미지 하나(`docs/final-shared.img`) 사용.

## 완료

- **엔진**: doswasmx(nbarkhina/DosWasmX, MIT) 커스텀 재빌드. `src/gui/sdlmain.cpp`의
  `MIDI_RawOutByte`/`MIDI_Available` 스텁을 패치해 MIDI 바이트를 `window.SuikoMidi.raw()`로
  브리지. 재빌드 절차는 메모리 `suiko-web-v2-wasm-rebuild` 참고(emsdk 3.1.49 +
  caiiiycuk/binaryen-fwasm-exceptions의 macOS wasm-opt 필요).
- **MIDI 사운드폰트**: Win95 MIDI 매퍼를 "External MIDI Port"로 설정하면 브리지를 타고 JS의
  spessasynth로 흘러 SC-55.sf3(9MB, 원본 sf2 53MB에서 변환)로 렌더링. 매퍼 기본값은 베이스
  이미지의 `SYSTEM.DAT`에 베이킹돼있어 부팅만 하면 자동 적용됨.
- **세이브**: `src/fat16.js`(FAT16 파일 단위 추출/주입) + `docs/suiko-save.js`(부팅 전
  IndexedDB → 디스크 이미지 주입, 부팅 후 폴링으로 변경 감지 시 SAVEDATA만 추출 저장).
  doswasmx의 디스크 전체 저장 방식을 대체, 디렉토리 엔트리 날짜/시각도 같이 보존. 저장/복원 시
  토스트 알림. `test/fat16.test.js`로 검증.
- **이미지 크기**: 원본 94MB → `tools/strip-image.js`(불필요 Win95 컴포넌트·서양 폰트 삭제,
  빈 공간 제로화) + SC-55 SF3 변환(53MB→9MB)이 핵심 레버. KR+JP 통합 후 WIN386.SWP·미사용
  KOFONT.TTF 추가 삭제(`kr-patch/tools/slim-image.js`)까지 거쳐 현재 gzip 전송 기준 약 34.9MB.
- **부팅 자동화**: `MSDOS.SYS`에 `AutoScan=0`(스캔디스크 프롬프트 제거), `Logo=0`/`BootDelay=0`
  (로고 애니메이션·부트 메뉴 지연 제거) 추가. WIN.INI `load=`로 게임 자동 실행.
- **저장 아키텍처 정리**: doswasmx 원본의 전체 디스크(~90MB) IndexedDB 스냅샷 경로(재시작/종료
  시 `saveDrive()`)를 제거함 — 살아있으면 배포 이미지를 갱신해도 한 번이라도 저장한 유저는
  스냅샷 시점 실행파일에 계속 갇힘. `suiko-save.js`가 SAVEDATA만 분리 저장/주입하는 방식으로
  이미 대체했으므로 불필요해진 상태였음.
- **배포 로딩**: 디스크 이미지를 gzip으로 저장, `script.js`의 `load_url_request`에 매직바이트
  (`1f 8b`) 감지 후 `DecompressionStream` 인플레이트 패치.
- **UI 전면 재구성**: gensei-pc98의 `style.css`를 기반으로 삼고 `suiko-overrides.css`로 최소
  델타(4:3 화면비, `#canvasDiv` 특이사항)만 얹는 방식. 로고, `footer.js`, 게인 기반 뮤트
  (AudioContext suspend/resume 대신 — 브라우저가 자동 재개시키는 문제 회피), 단일 `#toast`
  알림 채널, 전체화면 ESC 롱프레스(Keyboard Lock API) 이식.
- **미사용 코드 제거**: doswasmx 데모 UI(헤더, Browse/Save Drive/Settings/Login, 모달 4개,
  CPU·Advanced 드롭다운, 자체 모바일 터치 UI) 삭제(`kr.html` 412→135줄대). Bootstrap/Popper/
  font-awesome/FileSaver/nipplejs 제거(도달 불가 경로에서만 참조됨을 확인 후).
- **모바일 버그 수정**: 삭제된 요소를 참조해 부팅 시 죽던 `mobileMode` 분기 → 항상 false로
  우회(모바일 UX는 gensei-pc98 가상 게임패드+반응형 CSS 전담). 부팅 후 레이아웃 흔들림
  (`resizeCanvas()` 인라인 스타일) 수정. 가로 모드 캔버스 잘림 → 뷰포트 높이 기준 4:3 계산
  추가. iOS Chrome·모바일 가로/세로 실기 테스트 완료.
- **JP 빌드**: 이미지 하나에 `C:\GENSE`(KR)와 `C:\GENSEJP`(JP)를 같이 담는 구조(90MB Windows
  설치 중복 회피). `tools/build-jp-image.js`로 `GENSEJP` 생성. `docs/jp.html`은 `kr.html`과
  구조 동일, `window.SUIKO_LANG='jp'`만 다름 — `suiko-lang.js`가 부팅 직전 WIN.INI `load=`를
  언어별 실행 파일로 패치, `suiko-save.js`도 언어별 SAVEDATA 경로를 쓰되 IndexedDB 키는 언어
  독립적이라 KR↔JP 세이브 호환. 일본어 폰트는 `original/font/ja.ttf`("Ume Gothic O5", CP932)를
  실기에서 Control Panel로 설치 후 `tools/bake-fonts.js`로 베이킹, 정상 렌더링 확인.
  한국어 쪽은 같은 절차로 `ko.ttf`("KoddiUD OnGothic", CP949, GULIM.TTC와 동일 코드페이지)를
  설치해봤지만 Win95가 여전히 GULIM.TTC로 렌더링(코드페이지 내 우선순위 문제로 추정) —
  **사용자 판단으로 보류 확정**, KR은 GULIM 유지.

## 진행 중: KR 정식 번역 오타·오역 수정

웹 작업이 아니라 **게임 데이터 자체**(`HWANSE.EXE`의 PE `.data` 섹션)에 내장된 기존 정식
한글 번역의 오타·오역을 찾아 고치는 작업. 새 번역이 아니라 기존 번역의 부분 수정.

역공학·파이프라인(추출→검수→빌드→주입→배포)은 아래 "기술 노트" 참고. 수정 판단 기준(오탈자/
용어/과잉의역 구분, 캐릭터별 말투 등)은 [`kr-patch/translation/GUIDE.md`](kr-patch/translation/GUIDE.md).

로컬 웹 에디터(`kr-patch/tools/editor.js`, `localhost:8182`)로 사람이 직접 검수하며
`translation.json`의 `fixed` 필드를 채우는 방식으로 진행 중. 현재까지 대사 239건, 라벨 60건
반영·배포됨. 종료 시점이 정해진 작업이 아니라 계속 플레이하며 발견되는 대로 누적 수정.

**보류된 탐구 과제**: `fonts` 섹션으로 KR 전용 폰트 교체 시도 실패(아래 "폰트" 절 참고) —
재도전하려면 원인 후보(등록명 불일치/GDI 폴백/이 LOGFONT가 실제 렌더링에 안 쓰임)부터 좁혀야 함.

### 기술 노트: HWANSE.EXE 텍스트 구조

**확정된 사실**
- 텍스트는 `GENSE.FLD`가 아니라 **`HWANSE.EXE`의 PE `.data` 섹션**(raw offset
  `0x03A000`~`0x157E00`)에 CP949 인라인 리터럴로 있다. JP(`GENSE.EXE`)도 동일 구조.
- 라인 종결자는 리터럴 `'@'`(0x40) 바이트, NUL이 아님. 전각 공백·구두점을 문장 안에 그대로 씀.
- **포인터로 참조되지 않는다**: 문자열 시작 주소를 가리키는 오프셋/RVA/VA 검색 전부 0건 —
  스크립트 엔진이 순차 스트림으로 소비하는 것으로 보임(PC-98판과 같은 계열, 압축 없음).
- 추출 결과: KR 14,689줄, JP 14,814줄. 라운드트립(추출→재조립) 바이트 완전 동일 확인.
- **KR·JP 라인 순서는 서로 대응하지 않는다** — 반복 화자 이름의 등장 횟수는 거의 일치하지만
  (예: "스마슈"/"スマッシュ" 각 579회) 등장 인덱스 격차가 불규칙 → 전역 순서가 다름. 자동
  정렬은 포기, 리뷰 중 필요할 때 `search-jp.js`로 이름/키워드 대조.

**길이 변경 불가 (확정 정책)**: 문자열 시작 주소를 가리키는 포인터는 없지만, `.data` 영역을
가리키는 4바이트 절대주소 즉치값이 `.text`에서 5,643건 발견됐고 `.reloc` 섹션도 있어 — 뒤쪽
바이트가 밀리면 이런 참조가 깨질 위험이 크다. PE 섹션 리사이즈는 이 파이프라인 범위 밖의
본격 역공학이 필요해 **원본과 동일한 바이트 길이만 허용**으로 확정. 글자 수를 줄여야 하는
수정은 조사·어미 교체 등으로 음절 수를 맞추고, 안 되면 스킵.

**텍스트 포맷은 두 종류**: 대사(`'@'` 종결)와 이름·라벨(아이템/기술/시스템 메시지/UI 라벨을
전부 포함하는 하나의 포맷). 라벨 포맷은 두 번의 실패를 거쳐 지금 방식(유효 문자 최대 연속
구간 스캔)으로 정착:
- 1차 시도(전각공백 패딩을 앵커로 역방향 스캔)는 실전 텍스트 두 반례로 깨짐 — 공백이 항상
  트레일링 패딩은 아니고("지옥　다리후리기"처럼 진짜 띄어쓰기), 패딩이 아예 없는 이름은
  앵커를 못 찾아 누락됨.
- 채택한 방식: 이름 뒤에는 항상 텍스트가 아닌 제어 바이트(레벨 카운터 또는 `0xFF` 센티널)가
  오므로, 한글/ASCII/전각공백/가운뎃점으로 이뤄진 최대 연속 구간을 순방향 단일 패스로 잡으면
  경계가 저절로 나온다. 대사 포맷과 원리가 같고, NUL 종결 시스템 메시지까지 같은 스캔으로
  잡혀서 별도 포맷이 불필요해짐.
- 노이즈 필터: 라틴 문자 런은 3자 미만/대소문자 섞임/3연속 동일 문자면 인접 스탯 바이트의
  우연한 매치로 판단해 제외. 노이즈가 텍스트 앞/뒤/중간 어디에 있어도 실제 텍스트는 살리도록
  재귀 분리(`findNoiseRun`+`emitCleanEntries`). 이진 룩업테이블 구간 2곳은 통째로 제외.
- 개별 예외 처리한 사례: 바이너리 찌꺼기 7곳, 패딩 직후 숫자 노이즈("호랑이발톱　　　2"의
  '2'), 구분자 없이 붙은 16바이트 설정 메뉴 슬롯 5개(강제 분할), printf 포맷 문자열
  `"%s"`가 특수문자 때문에 둘로 쪼개진 사례 1건(강제 병합, `%s`는 런타임 치환 자리표시자라
  그대로 보존 필수).
- 최종: KR 라벨 389개, JP 435개, 겹침 0, 라운드트립 통과.
- 대사 쪽도 884바이트짜리 이진 점프테이블이 우연히 유효 한글로 디코드돼 가짜 1음절 "대사"
  38개가 샜던 걸 발견 — 이 구간만 하드코딩 제외(진짜 1음절 대사도 있음: 요일 "일/월/화/…").

**폰트**: 오프셋 `0x52858`에 유효한 Win32 `LOGFONT` 구조체 발견 — `lfCharSet=0x81`
(HANGUL_CHARSET)인 유일한 LOGFONT 후보라, 폰트를 이름으로 직접 지정하는 지점으로 추정.
`hwanse-font.js`로 `fonts` 섹션 분리(32바이트 고정 버퍼, 라벨과 다른 검증 로직). **시도했으나
실패**: `fixed`를 "KoddiUD 온고딕"/"KoddiUD OnGothic"으로 바꿔 빌드·주입·실기 확인 — 둘 다
GULIM 그대로 렌더링됨. 원인 미확정(등록명 불일치 / GDI가 조용히 charset 폴백 / 이 LOGFONT가
실제 렌더링과 무관할 가능성) — 반영 안 하고 되돌림.

**산출물**: `kr-patch/tools/hwanse-text.js`·`hwanse-names.js`·`hwanse-font.js`(KR 추출/빌드),
`gense-text.js`·`gense-names.js`(JP 참고 전용), `search-jp.js`(JP 키워드 검색), `editor.js`+
`editor.html`(로컬 웹 에디터), `extract.js`/`build.js`/`inject.js`(파이프라인),
`translation/translation.json`(KR 전량, `dialogue`/`labels`/`fonts` 세 섹션 — 공통 필드
`offset`/`text`/`fixed`, `dialogue`·`labels`는 `length`, `fonts`는 `maxLength`),
`translation/jp-reference.json`(JP 참고 전량), `translation/GUIDE.md`(수정 판단 기준).

## 남은 작업

- KR 번역 오타·오역 수정 계속 (위 참고, 종료 시점 없음)
- `.vendor-tmp/`(doswasmx 소스 클론, gitignored)는 재빌드 필요시 대비 로컬 보존 — 절차는
  메모리 `suiko-web-v2-wasm-rebuild` 참고

## 참고 자료
- 계획 원본: `~/.claude/plans/harmonic-dancing-gem.md`
- 프로젝트 결정사항 메모리: `suiko-web-v2-project`, `suiko-web-v2-original-files`,
  `suiko-web-v2-save-structure`, `suiko-web-v2-wasm-rebuild` (Claude 메모리 디렉토리)
- 커밋/푸시는 사용자가 명시적으로 요청할 때만 (메모리 `feedback-commit-push-explicit-only`)
