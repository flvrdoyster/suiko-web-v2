# KR 패치 도구 — 사용법

환세취호전(幻世酔虎伝) Windows 95 KR판에 이미 들어있는 정식 한글 번역의 오타·오역을
찾아 고치는 파이프라인. **새 번역 작업이 아니라 기존 번역의 부분 수정**이 목적이다.
구조 조사 내용(텍스트 위치, 인코딩, 왜 이런 설계가 됐는지)은 [`../NOTES.md`](../NOTES.md)를
본다 — 이 문서는 순수하게 "명령을 어떻게 치는지"만 다룬다.

## 준비

저장소 루트에서 의존성 설치(최초 1회):

```
npm install
```

원본 게임 파일이 `original/kr/HWANSE.EXE`, `original/jp/GENSE.EXE`에 있어야 한다
(`original/`은 gitignore됨 — 저작권 있는 원본 자산이라 각자 로컬에 준비).

## 전체 흐름

```
extract.js              추출: EXE → translation.json (수정 대상) / jp-reference.json (참고)
      │
   editor.js             검수: 브라우저에서 오타 찾아 fixed 필드 채우기
      │
   build.js               빌드: fixed가 채워진 항목만 골라 패치된 HWANSE.EXE 생성
      │
   inject.js              주입: 패치된 EXE를 공유 디스크 이미지(final-shared.img) 사본에 삽입
      │
   (로컬 서버로 실제 게임 부팅해서 확인)
      │
   docs/final-shared.img로 교체 → git commit/push (배포)
```

모든 명령은 **저장소 루트에서** 실행한다(`kr-patch/tools/...` 상대경로 스크립트라서).

---

### 1. 추출 — `extract.js`

```
node kr-patch/tools/extract.js
```

`original/kr/HWANSE.EXE`·`original/jp/GENSE.EXE`에서 텍스트를 뽑아
`kr-patch/translation/translation.json`(KR, 수정 대상)과
`kr-patch/translation/jp-reference.json`(JP, 참고 전용)을 (재)생성한다.

- 라운드트립 검증(추출한 그대로 재조립하면 원본과 바이트 완전 동일해야 함)을 통과 못하면
  **아무것도 쓰지 않고 종료 코드 1로 실패**한다.
- **재실행해도 이미 검수한 `fixed` 값은 안 지워진다** — 오프셋+길이로 매칭해서 보존한다.
  추출기 코드 자체를 고쳐서 오프셋이 바뀌는 경우엔, 매칭 안 되는 예전 수정을 콘솔에
  경고로 띄운다(그런 경우만 수동으로 다시 입력).
- 평소엔 다시 돌릴 일이 거의 없다(원본 EXE나 추출기 코드가 안 바뀌면 결과가 그대로이므로).
  주로 추출 로직을 고쳤을 때만 재실행한다.

옵션(원본 경로가 다를 때만 필요):
```
node kr-patch/tools/extract.js --kr-exe <path> --jp-exe <path> --out-kr <path> --out-jp <path>
```

---

### 2. 검수 — 에디터 (`editor.js`)

```
node kr-patch/tools/editor.js        # 기본 포트 8182
node kr-patch/tools/editor.js 8282   # 다른 포트로
```

브라우저에서 `http://localhost:8182` 접속. UX는 자매 프로젝트 gensei-pc98의 번역
에디터를 따랐다.

- **대사 / 이름·라벨 / 폰트** 탭. 검색창으로 원문·수정문 텍스트 검색, `수정된 것만` /
  `문제 있는 것만`(길이 안 맞는 항목) 필터. 페이징 없이 전체 목록이 한 번에 로드됨(오프셋은
  `Ctrl+F`로 페이지 내 찾기).
- 각 행의 "수정" 칸(자동 높이 textarea)에 교정문을 입력하면 **수정중(주황 테두리)** 표시가
  뜬다. 여러 행을 자유롭게 고친 뒤 상단 **저장** 버튼 또는 **Ctrl+S**로 한 번에 저장한다
  (저장되면 초록 플래시). 저장 안 한 채 창을 닫으려 하면 경고가 뜬다.
- **Byte 열**: `현재/필요` 바이트를 실시간 표시. 규칙이 저장 가능 여부를 결정한다 —
  `대사`는 원문과 정확히 같은 바이트여야 하고(포인터는 없지만 구조상 다른 데이터가 밀릴
  위험이 있어 길이 변경 금지 — `../NOTES.md` 참조), `이름·라벨`은 짧아진 교정문을
  전각공백(`　`)으로 자동 패딩해준다(길어지는 건 초과라 불가). `폰트`는 Win32 `LOGFONT`의
  `lfFaceName`(고정 32바이트 NUL 패딩 버퍼)이라 **32바이트 이하면 무엇이든** 들어간다.
  길이가 안 맞는 항목은 빨간 테두리로 표시되고 저장 시 그 건만 거부(나머지는 정상 저장),
  상단 `문제 있는 것만` 필터·`이전/다음` 네비게이션으로 찾아갈 수 있다.
- 원문 셀 클릭 시 클립보드 복사. 진행률(수정된 항목 비율)은 상단 도넛에 표시.
- **JP 검색** 버튼: 우측 패널에서 이름·키워드로 일본어 원문을 검색해 대조용으로 참고
  (KR·JP는 텍스트 순서가 서로 달라 자동 1:1 대응은 불가능 — 검증된 사실, `../NOTES.md`
  참조).
- 이 에디터는 **`translation.json`만** 건드린다. 실제 게임 파일이나 배포된 이미지는
  전혀 손대지 않는다 — 반영은 아래 3~5단계에서 명시적으로 해야 한다.

---

### 3. 빌드 — `build.js`

```
node kr-patch/tools/build.js
```

`translation.json`에서 `fixed`가 채워진 항목만 골라 `original/kr/HWANSE.EXE`에 적용한
패치된 파일을 `kr-patch/build/HWANSE.EXE`(gitignore됨)에 만든다. 어떤 오프셋이 뭐가 뭐로
바뀌었는지 전부 콘솔에 로그로 남는다. 바이트 길이가 안 맞는 항목이 있으면 그 자리에서
에러로 멈춘다(파일이 안전하지 않은 상태로 반쯤 쓰이지 않음).

옵션:
```
node kr-patch/tools/build.js --kr-exe <path> --translation <path> --out <path>
```

---

### 4. 주입 — `inject.js`

```
node kr-patch/tools/inject.js
```

`kr-patch/build/HWANSE.EXE`를 `docs/final-shared.img`(공유 디스크 이미지) **사본**에
주입해서 `kr-patch/build/final-shared.img`를 만든다. **`docs/final-shared.img`는 직접
건드리지 않는다** — 그건 실제 배포 중인 파일이라서, 로컬 검증 전에 덮어쓰지 않기 위해
일부러 별도 경로에 쓴다. 주입 후 자체적으로 다음을 검증한다:
- 넣은 파일을 다시 읽어봐서 정확히 일치하는지
- `GENSE/SAVEDATA`·`GENSEJP/SAVEDATA`(세이브 데이터)가 그대로 살아있는지

옵션:
```
node kr-patch/tools/inject.js --exe <path> --image <path> --out <path>
```

---

### 5. 로컬 검증

```
cp -r docs/* /어딘가/테스트폴더/
cp kr-patch/build/final-shared.img /어딘가/테스트폴더/final-shared.img
cd /어딘가/테스트폴더 && python3 -m http.server 8123
```

브라우저에서 `http://localhost:8123/kr.html` 접속(**캐시 때문에 강제 새로고침
Cmd+Shift+R 필수** — 같은 파일명이라 브라우저가 이전 이미지를 캐싱하는 경우가 잦았음).
수정한 대사·이름이 실제로 잘 나오는지, 진행에 문제없는지 확인.

---

### 6. 배포

로컬 검증이 끝나면:

```
cp kr-patch/build/final-shared.img docs/final-shared.img
git add docs/final-shared.img kr-patch/translation/translation.json
git commit -m "..."
git push   # 명시적으로 요청받았을 때만
```

`suiko.atah.io`가 GitHub Pages로 `docs/`를 서빙하므로 push하면 바로 반영된다.

---

## 데이터 모델

`kr-patch/translation/translation.json`:

```jsonc
{
  "source_file": "HWANSE.EXE",
  "source_md5": "...",           // extract.js 실행 시점 원본 해시
  "dialogue": [
    { "offset": 253956, "length": 28, "text": "원문", "fixed": "" }
  ],
  "labels": [
    { "offset": 255032, "length": 16, "text": "원문", "fixed": "" }
  ],
  "fonts": [
    { "offset": 338036, "maxLength": 32, "text": "굴림체", "fixed": "" }
  ]
}
```

- `text`: 원본 그대로 추출된 텍스트 — **수정 금지**(참고용).
- `fixed`: 교정문. 빈 문자열이면 미검수/수정 없음.
- `dialogue`는 `'@'` 종결 대사, `labels`는 기술명·아이템명·시스템 메시지 등을 전부
  포함하는 통합 포맷(포맷 구분·역공학 근거는 `../NOTES.md` 참조).
- `fonts`는 완전히 다른 포맷 — Win32 `LOGFONT`의 `lfFaceName` 필드(고정 32바이트 NUL
  패딩 C 문자열, `maxLength`가 그 버퍼 크기). 현재 딱 1개 항목뿐이고, 게임이 폰트를
  charset이 아니라 **이름으로 직접 지정하는 유일한 지점**으로 보임(`../NOTES.md` 참조
  — KR 전용 폰트를 강제로 바꾸고 싶을 때 건드릴 곳).

`kr-patch/translation/jp-reference.json`은 같은 모양이지만 `fixed` 필드가 없다(읽기
전용, 대조용).
