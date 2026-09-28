bits 32
%ifndef BASE
%define BASE 0x400000
%endif
org BASE+0x1BE000

GetModuleHandleA equ BASE+0x1A04C8
GetProcAddress   equ BASE+0x1A0448
GetDC            equ BASE+0x1A04EC
ReleaseDC        equ BASE+0x1A04F4
DeleteObject     equ BASE+0x1A038C
SelectPalette    equ BASE+0x1A0390
RealizePalette   equ BASE+0x1A03AC
CreatePalette    equ BASE+0x1A03BC
SURFACES         equ BASE+0x15ABD8
DDPALETTE        equ BASE+0x676C4
BACKBUF_INDEX    equ BASE+0x676D0
PALETTE          equ BASE+0x676E8
MODE             equ BASE+0x676EC
HWND             equ BASE+0x676F0
WINDOW_HWND      equ BASE+0x15A1AC
WINMAIN_ARG      equ BASE+0x40460
WINMAIN_NEXT     equ BASE+0x1860
PALATTACH_NEXT   equ BASE+0x1655D
PAL1_NEXT        equ BASE+0x16672
PAL2_NEXT        equ BASE+0x16731
FILL_NEXT        equ BASE+0x17BE5
COPY_NEXT        equ BASE+0x17CF1

%ifdef DIAG
%macro LOG 3
    pushfd
    pushad
    push dword %3
    push dword %2
    push %1
    call DIAG_LOG
    add esp, 12
    popad
    popfd
%endmacro
%macro LOGP 3
    cmp dword [n_pr], 40
    ja %%skip
    LOG %1, %2, %3
%%skip:
%endmacro
%else
%macro LOG 3
%endmacro
%macro LOGP 3
%endmacro
%endif

    jmp strict near init
    jmp strict near create_surface
    jmp strict near pal_attach
    jmp strict near present_c
    jmp strict near pal_hook1
    jmp strict near pal_hook2
    jmp strict near fill_b

init:
    push s_user32
    call [GetModuleHandleA]
    mov esi, eax
    push s_fillrect
    push esi
    call [GetProcAddress]
    mov [p_fillrect], eax
    push s_gdi32
    call [GetModuleHandleA]
    mov esi, eax
    push s_setdib
    push esi
    call [GetProcAddress]
    mov [p_setdib], eax
    push s_brush
    push esi
    call [GetProcAddress]
    mov [p_brush], eax
    push s_devcaps
    push esi
    call [GetProcAddress]
    mov [p_devcaps], eax
    LOG f_init, [p_setdib], [p_devcaps]
    LOG f_init2, [p_brush], [p_fillrect]
%ifdef DIAG
    push s_k32
    call [GetModuleHandleA]
    push s_seuf
    push eax
    call [GetProcAddress]
    test eax, eax
    jz .nofilter
    push exc_filter
    call eax
.nofilter:
%endif
    push 0
    push WINMAIN_ARG
    jmp WINMAIN_NEXT

create_surface:
%ifdef DIAG
    movzx ecx, word [MODE]
    mov edx, [esp+8]
    mov edx, [edx+0x68]
    LOG f_cse, ecx, edx
    mov dword [n_pr], 0
%endif
    cmp word [MODE], 1
    jne .pass
    mov eax, [esp+8]
    test dword [eax+0x68], 0x200
    jz .offscreen
    mov dword [eax+0x68], 0x40
    mov dword [eax+8], 480
    mov dword [eax+0xC], 640
    or dword [eax+4], 6
.offscreen:
    or dword [eax+4], 0x1000
    mov dword [eax+0x48], 32
    mov dword [eax+0x4C], 0x60
    mov dword [eax+0x50], 0
    mov dword [eax+0x54], 8
    mov dword [eax+0x58], 0
    mov dword [eax+0x5C], 0
    mov dword [eax+0x60], 0
    mov dword [eax+0x64], 0
    and dword [eax+0x68], ~0x4000
    or dword [eax+0x68], 0x800
    push dword [esp+16]
    push dword [esp+16]
    push dword [esp+16]
    push dword [esp+16]
    mov eax, [esp]
    mov eax, [eax]
    call [eax+0x18]
%ifdef DIAG
    mov ecx, [esp+8]
    mov ecx, [ecx+0x68]
    LOG f_cs, eax, ecx
%endif
    test eax, eax
    jnz .ret
    mov ecx, [DDPALETTE]
    test ecx, ecx
    jz .ret
    mov edx, [esp+12]
    mov edx, [edx]
    push ecx
    push edx
    mov eax, [edx]
    call [eax+0x7C]
    xor eax, eax
.ret:
    ret 16
.pass:
    mov eax, [esp+4]
    mov eax, [eax]
    jmp [eax+0x18]

pal_attach:
%ifdef DIAG
    movzx ecx, word [MODE]
    LOG f_pa, ecx, [DDPALETTE]
%endif
    cmp word [MODE], 1
    jne .out
    mov edi, [DDPALETTE]
    test edi, edi
    jz .out
    mov esi, 1
.next:
    mov eax, [esi*4+SURFACES]
    test eax, eax
    jz .skip
    mov eax, [eax]
    test eax, eax
    jz .skip
    push edi
    push eax
    mov edx, [eax]
    call [edx+0x7C]
.skip:
    inc esi
    cmp esi, 0xC0
    jb .next
.out:
    jmp PALATTACH_NEXT

present_c:
    push dword [ebp+0xC]
    push dword [ebp+8]
    call present
    add esp, 8
    mov dword [ebp-4], 0
    jmp COPY_NEXT

pal_hook1:
    call pal_redraw
    xor eax, eax
    jmp PAL1_NEXT

pal_hook2:
    call pal_redraw
    xor eax, eax
    jmp PAL2_NEXT

pal_redraw:
    cmp word [MODE], 1
    jne .out
    push full
    push full
    call present
    add esp, 8
.out:
    ret

fill_b:
    cmp dword [p_brush], 0
    je .out
    cmp dword [p_fillrect], 0
    je .out
    push dword [HWND]
    call [GetDC]
    mov edi, eax
    call prep_dc
    movzx ecx, byte [ebp-0x24]
    LOGP f_fill, ecx, eax
    test eax, eax
    jz .rgb
    lea eax, [ecx+0x01000000]
    jmp .brush
.rgb:
    mov edx, [PALETTE]
    mov eax, [edx+ecx*4]
    and eax, 0xFFFFFF
.brush:
    push eax
    call [p_brush]
    mov esi, eax
    push esi
    lea eax, [ebp-0x90]
    push eax
    push edi
    call [p_fillrect]
    mov eax, edi
    call release_dc
    push esi
    call [DeleteObject]
.out:
    mov dword [ebp-0x80], 0
    jmp FILL_NEXT

BMI     equ 0
DDSD    equ 0x428
SURF    equ 0x494
HDC     equ 0x498
USAGE   equ 0x49C
FRAME   equ 0x4A0

present:
    push ebp
    mov ebp, esp
    push ebx
    push esi
    push edi
%ifdef DIAG
    inc dword [n_pr]
    LOGP f_pr, [HWND], [WINDOW_HWND]
%endif
    cmp dword [p_setdib], 0
    je .ret
    mov eax, [PALETTE]
    test eax, eax
    jz .ret
    sub esp, FRAME
    mov edi, esp
    movsx eax, word [BACKBUF_INDEX]
    mov eax, [eax*4+SURFACES]
    test eax, eax
    jz .free
    mov esi, [eax]
    mov [edi+SURF], esi
    push edi
    lea edi, [edi+DDSD]
    xor eax, eax
    mov ecx, 0x6C/4
    rep stosd
    pop edi
    mov dword [edi+DDSD], 0x6C
    push 0
    push 1
    lea eax, [edi+DDSD]
    push eax
    push 0
    push esi
    mov eax, [esi]
    call [eax+0x64]
    LOGP f_lock, eax, [edi+DDSD+0x54]
    test eax, eax
    jnz .free
    cmp dword [edi+DDSD+0x54], 8
    jne .unlock
%ifdef DIAG
    cmp dword [n_pr], 40
    ja .nocount
    pushad
    mov esi, [edi+DDSD+0x24]
    mov ecx, [edi+DDSD+0x10]
    imul ecx, [edi+DDSD+8]
    xor edx, edx
.cnt:
    cmp byte [esi], 0
    je .zero
    inc edx
.zero:
    inc esi
    dec ecx
    jnz .cnt
    mov ebx, [PALETTE]
    LOG f_px, edx, [ebx+4]
    LOG f_pal, [ebx+7*4], [ebx+255*4]
    popad
.nocount:
%endif
    mov ebx, [ebp+8]
    mov eax, [ebx+0xC]
    sub eax, [ebx+4]
    jle .unlock
    neg eax
    mov [edi+BMI+8], eax
    mov dword [edi+BMI], 40
    mov eax, [edi+DDSD+0x10]
    mov [edi+BMI+4], eax
    mov dword [edi+BMI+0xC], 0x00080001
    xor eax, eax
    mov [edi+BMI+0x10], eax
    mov [edi+BMI+0x14], eax
    mov [edi+BMI+0x18], eax
    mov [edi+BMI+0x1C], eax
    mov [edi+BMI+0x20], eax
    mov [edi+BMI+0x24], eax
    push dword [HWND]
    call [GetDC]
    mov [edi+HDC], eax
    call prep_dc
    mov [edi+USAGE], eax
    LOGP f_dc, [edi+HDC], eax
    xor ecx, ecx
    test eax, eax
    jz .rgbtab
.idxtab:
    mov [edi+BMI+0x28+ecx*2], cx
    inc cl
    jnz .idxtab
    jmp .draw
.rgbtab:
    mov edx, [PALETTE]
.pal:
    mov eax, [edx+ecx*4]
    bswap eax
    shr eax, 8
    mov [edi+BMI+0x28+ecx*4], eax
    inc cl
    jnz .pal
.draw:
    mov ebx, [ebp+8]
    mov edx, [ebp+0xC]
    mov eax, [ebx+4]
    imul eax, [edi+DDSD+0x10]
    add eax, [edi+DDSD+0x24]
    mov ecx, [ebx+0xC]
    sub ecx, [ebx+4]
    push dword [edi+USAGE]
    push edi
    push eax
    push ecx
    push 0
    push 0
    push dword [ebx]
    push ecx
    mov eax, [ebx+8]
    sub eax, [ebx]
    push eax
    push dword [edx+4]
    push dword [edx]
    push dword [edi+HDC]
    call [p_setdib]
    LOGP f_dib, eax, [edi+DDSD+0x10]
    mov eax, [edi+HDC]
    call release_dc
.unlock:
    mov esi, [edi+SURF]
    push dword [edi+DDSD+0x24]
    push esi
    mov eax, [esi]
    call [eax+0x80]
.free:
    add esp, FRAME
.ret:
    pop edi
    pop esi
    pop ebx
    pop ebp
    ret

prep_dc:
    push ebx
    push esi
    push edi
    mov ebx, eax
    cmp dword [p_devcaps], 0
    je .rgb
    push 38
    push ebx
    call [p_devcaps]
    test eax, 0x100
    jz .rgb
    mov dword [xpal], 0x01000300
    mov edx, [PALETTE]
    xor ecx, ecx
    xor esi, esi
.fill:
    mov eax, [edx+ecx*4]
    and eax, 0x00FFFFFF
    cmp eax, [xpal+4+ecx*4]
    je .same
    mov [xpal+4+ecx*4], eax
    inc esi
.same:
    inc ecx
    cmp ecx, 256
    jb .fill
    mov eax, [h_xpal]
    test eax, eax
    jz .create
    test esi, esi
    jz .sel
    push eax
    call [DeleteObject]
.create:
    push xpal
    call [CreatePalette]
    mov [h_xpal], eax
    test eax, eax
    jz .rgb
.sel:
    push 0
    push eax
    push ebx
    call [SelectPalette]
    push ebx
    call [RealizePalette]
    mov eax, 1
    jmp .out
.rgb:
    xor eax, eax
.out:
    pop edi
    pop esi
    pop ebx
    ret

release_dc:
    push eax
    push dword [HWND]
    call [ReleaseDC]
    ret

align 4
full:       dd 0, 0, 640, 480
p_setdib:   dd 0
p_brush:    dd 0
p_fillrect: dd 0
p_devcaps:  dd 0
h_xpal:     dd 0
s_user32:   db 'USER32', 0
s_gdi32:    db 'GDI32', 0
s_fillrect: db 'FillRect', 0
s_setdib:   db 'SetDIBitsToDevice', 0
s_brush:    db 'CreateSolidBrush', 0
s_devcaps:  db 'GetDeviceCaps', 0

%ifdef DIAG
exc_filter:
    mov edx, [esp+4]
    mov edx, [edx]
    mov eax, [edx]
    mov ecx, [edx+0xC]
    LOG f_exc, eax, ecx
    xor eax, eax
    ret 4
align 4
n_pr:       dd 0
s_k32:      db 'KERNEL32', 0
s_seuf:     db 'SetUnhandledExceptionFilter', 0
f_init:     db '%lu init setdib=%08lx devcaps=%08lx', 13, 10, 0
f_init2:    db '%lu init brush=%08lx fillrect=%08lx', 13, 10, 0
f_cse:      db '%lu createsurface enter mode=%lu caps=%08lx', 13, 10, 0
f_cs:       db '%lu createsurface hr=%08lx caps=%08lx', 13, 10, 0
f_pa:       db '%lu palette attach mode=%lu palette=%08lx', 13, 10, 0
f_pr:       db '%lu present drawhwnd=%08lx windowhwnd=%08lx', 13, 10, 0
f_lock:     db '%lu lock hr=%08lx bpp=%lu', 13, 10, 0
f_px:       db '%lu backbuffer nonzero=%lu palette[1]=%08lx', 13, 10, 0
f_pal:      db '%lu palette[7]=%08lx palette[255]=%08lx', 13, 10, 0
f_dc:       db '%lu getdc hdc=%08lx palettized=%lu', 13, 10, 0
f_dib:      db '%lu setdibits lines=%ld pitch=%ld', 13, 10, 0
f_fill:     db '%lu fill index=%lu palettized=%lu', 13, 10, 0
f_exc:      db '%lu EXCEPTION code=%08lx address=%08lx', 13, 10, 0
%endif

absolute BASE+0x1BEB00
xpal:       resb 4 + 256*4
