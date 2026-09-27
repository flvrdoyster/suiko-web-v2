; diag.asm — logging hooks for the Alt+Tab black-screen investigation.
; Linked into a new .diag section at VA 0x5BE000 by build-diag.js; writes HWDIAG.TXT in the
; current directory (the game folder). Starts with an address table the builder reads.
bits 32
org 0x5be000

    dd diag_present, diag_present2, diag_act, diag_restore
CreateFileA      equ 0x5a03e8
WriteFile        equ 0x5a0404
FlushFileBuffers equ 0x5a0454
GetTickCount     equ 0x5a0464
wsprintfA        equ 0x5a04e0

; --- hook at 0x417BE5 (after the present Blt in 0x417A55): log HRESULT changes
diag_present:
    pushad
    mov eax, [ebp-0x80]
    cmp eax, [last_hr]
    je .skip
    mov [last_hr], eax
    push 0
    push eax
    push fmt_present
    call log
    add esp, 12
.skip:
    popad
    cmp dword [ebp-0x80], 0     ; flags for the jz that follows the call
    ret

; --- hook at 0x417728 (after the Blt in the generic wrapper 0x4176AD): log changes
diag_present2:
    pushad
    mov eax, [ebp-4]
    cmp eax, [last_hr2]
    je .skip
    mov [last_hr2], eax
    push 0
    push eax
    push fmt_present2
    call log
    add esp, 12
.skip:
    popad
    cmp dword [ebp-4], 0
    ret

; --- replaces call 0x42F460 at 0x401B2C (WM_ACTIVATEAPP): log wParam + primary IsLost
diag_act:
    pushad
    xor eax, eax
    mov ecx, [0x55abd8]
    test ecx, ecx
    jz .noprim
    mov ecx, [ecx]              ; IDirectDrawSurface*
    test ecx, ecx
    jz .noprim
    push ecx
    mov edx, [ecx]
    call [edx+0x60]             ; IsLost
.noprim:
    push eax
    push dword [esp+40]         ; wParam (pushad 32 + ret 4 + pushed eax 4)
    push fmt_act
    call log
    add esp, 12
    popad
    jmp 0x42f460

; --- replaces call 0x416013 in the present stub: log the restore result
diag_restore:
    call 0x416013
    pushad
    push 0
    push eax
    push fmt_restore
    call log
    add esp, 12
    popad
    ret

; log(fmt, a, b) — "tick a b" through wsprintfA, appended to HWDIAG.TXT
log:
    push ebp
    mov ebp, esp
    cmp dword [hfile], 0
    jne .have
    push 0
    push 0x80
    push 2                      ; CREATE_ALWAYS
    push 0
    push 1                      ; FILE_SHARE_READ
    push 0x40000000             ; GENERIC_WRITE
    push fname
    call [CreateFileA]
    mov [hfile], eax
.have:
    call [GetTickCount]
    push dword [ebp+16]
    push dword [ebp+12]
    push eax
    push dword [ebp+8]
    push buf
    call [wsprintfA]
    add esp, 20
    push 0
    push written
    push eax
    push buf
    push dword [hfile]
    call [WriteFile]
    push dword [hfile]
    call [FlushFileBuffers]
    pop ebp
    ret

fname:       db 'HWDIAG.TXT', 0
fmt_present: db '%lu present hr=%08lx', 13, 10, 0
fmt_act:     db '%lu activate wParam=%lu primary IsLost=%08lx', 13, 10, 0
fmt_present2: db '%lu blt4176AD hr=%08lx', 13, 10, 0
fmt_restore: db '%lu restore -> %08lx', 13, 10, 0
align 4
last_hr:     dd 0xffffffff
last_hr2:    dd 0xffffffff
hfile:       dd 0
written:     dd 0
buf:         times 128 db 0
