---
title: Doom on xv6 (RISC-V)
summary: Doom ported to xv6, a teaching Unix, running on a RISC-V processor under QEMU. Undergraduate operating systems research.
status: shipped
year: 2023
stack: [C, xv6, RISC-V, QEMU]
featured: true
order: 3
---

Undergraduate research at East Tennessee State University, January to May 2023.

xv6 is a small Unix-like teaching OS written in ANSI C. Before a game could run on it, the kernel needed more than it shipped with:

- New utilities and system calls, memory mapping and multithreading.
- System calls, memory management and I/O remapped to fit xv6's model, so Doom's expectations of an OS line up with what xv6 provides.

The result: Doom running on xv6, on an emulated RISC-V processor in QEMU.
