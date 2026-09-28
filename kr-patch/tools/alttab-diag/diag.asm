bits 32
org 0x5bf000

    dd diag_present, diag_present2, diag_act, diag_restore, log
CreateFileA      equ 0x5a03e8
WriteFile        equ 0x5a0404
FlushFileBuffers equ 0x5a0454
GetTickCount     equ 0x5a0464
wsprintfA        equ 0x5a04e0

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
    cmp dword [ebp-0x80], 0
    ret

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

diag_act:
    pushad
    xor eax, eax
    mov ecx, [0x55abd8]
    test ecx, ecx
    jz .noprim
    mov ecx, [ecx]
    test ecx, ecx
    jz .noprim
    push ecx
    mov edx, [ecx]
    call [edx+0x60]
.noprim:
    push eax
    push dword [esp+40]
    push fmt_act
    call log
    add esp, 12
    popad
    jmp 0x42f460

diag_restore:
    call 0x416013
    pushad
    push 0
    push eax
    push fmt_restore
    call log
    add esp, 12
    popad
    test eax, eax
    jnz .done
    call 0x416599
    call 0x411466
    xor eax, eax
.done:
    ret

log:
    push ebp
    mov ebp, esp
    cmp dword [hfile], 0
    jne .have
    push 0
    push 0x80
    push 2
    push 0
    push 1
    push 0x40000000
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
