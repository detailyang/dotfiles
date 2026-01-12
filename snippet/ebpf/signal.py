#!/usr/bin/env python3
# -*- coding: utf-8 -*-
#
# Monitor signals received by specified processes
# Usage: sudo python3 signal_monitor.py -p 1234,5678,9012

from __future__ import print_function
from bcc import BPF
from bcc.utils import printb
import argparse
from time import strftime
import sys

# Argument parsing
examples = """Examples:
    ./signal_monitor. py -p 1234              # Monitor a single process
    ./signal_monitor.py -p 1234,5678,9012    # Monitor multiple processes
    ./signal_monitor.py -p 1234 -s 9         # Only monitor signal 9 (SIGKILL)
    ./signal_monitor.py -p 1234 -x           # Only show failed signals
"""

parser = argparse. ArgumentParser(
    description="Monitor signals received by specified processes",
    formatter_class=argparse.RawDescriptionHelpFormatter,
    epilog=examples)
parser.add_argument("-p", "--pid", required=True,
    help="PIDs to monitor, comma-separated, e.g.: 1234,5678")
parser.add_argument("-s", "--signal",
    help="Only monitor specified signal number")
parser.add_argument("-x", "--failed", action="store_true",
    help="Only show failed signal sends")
parser.add_argument("--ebpf", action="store_true",
    help=argparse.SUPPRESS)
args = parser.parse_args()

# Parse PID list
try:
    target_pids = [int(p.strip()) for p in args.pid.split(',')]
except ValueError:
    print("Error: PIDs must be numbers, format: 1234,5678")
    sys.exit(1)

# BPF program
bpf_text = """
#include <uapi/linux/ptrace.h>
#include <linux/sched.h>

struct val_t {
    u64 pid;
    int sig;
    int tpid;
    char comm[TASK_COMM_LEN];
};

struct data_t {
    u64 pid;
    int tpid;
    int sig;
    int ret;
    char comm[TASK_COMM_LEN];
};

BPF_HASH(infotmp, u32, struct val_t);
BPF_PERF_OUTPUT(events);

int syscall__kill(struct pt_regs *ctx, int tpid, int sig)
{
    u32 pid = bpf_get_current_pid_tgid();

    // Filter target PIDs
    TPID_FILTER

    // Filter signals
    SIGNAL_FILTER

    struct val_t val = {.pid = pid};
    if (bpf_get_current_comm(&val.comm, sizeof(val.comm)) == 0) {
        val.tpid = tpid;
        val.sig = sig;
        infotmp.update(&pid, &val);
    }

    return 0;
}

int do_ret_sys_kill(struct pt_regs *ctx)
{
    struct data_t data = {};
    struct val_t *valp;
    u32 pid = bpf_get_current_pid_tgid();

    valp = infotmp.lookup(&pid);
    if (valp == 0) {
        return 0;
    }

    bpf_probe_read_kernel(&data.comm, sizeof(data.comm), valp->comm);
    data.pid = pid;
    data.tpid = valp->tpid;
    data.ret = PT_REGS_RC(ctx);
    data.sig = valp->sig;

    events.perf_submit(ctx, &data, sizeof(data));
    infotmp.delete(&pid);

    return 0;
}

// tkill system call
int syscall__tkill(struct pt_regs *ctx, int tpid, int sig)
{
    u32 pid = bpf_get_current_pid_tgid();

    TPID_FILTER
    SIGNAL_FILTER

    struct val_t val = {.pid = pid};
    if (bpf_get_current_comm(&val.comm, sizeof(val.comm)) == 0) {
        val.tpid = tpid;
        val.sig = sig;
        infotmp.update(&pid, &val);
    }

    return 0;
}

int do_ret_sys_tkill(struct pt_regs *ctx)
{
    struct data_t data = {};
    struct val_t *valp;
    u32 pid = bpf_get_current_pid_tgid();

    valp = infotmp.lookup(&pid);
    if (valp == 0) {
        return 0;
    }

    bpf_probe_read_kernel(&data.comm, sizeof(data.comm), valp->comm);
    data.pid = pid;
    data.tpid = valp->tpid;
    data.ret = PT_REGS_RC(ctx);
    data.sig = valp->sig;

    events.perf_submit(ctx, &data, sizeof(data));
    infotmp.delete(&pid);

    return 0;
}

// tgkill system call
int syscall__tgkill(struct pt_regs *ctx, int tgid, int tpid, int sig)
{
    u32 pid = bpf_get_current_pid_tgid();

    TPID_FILTER
    SIGNAL_FILTER

    struct val_t val = {.pid = pid};
    if (bpf_get_current_comm(&val.comm, sizeof(val.comm)) == 0) {
        val.tpid = tpid;
        val. sig = sig;
        infotmp.update(&pid, &val);
    }

    return 0;
}

int do_ret_sys_tgkill(struct pt_regs *ctx)
{
    struct data_t data = {};
    struct val_t *valp;
    u32 pid = bpf_get_current_pid_tgid();

    valp = infotmp.lookup(&pid);
    if (valp == 0) {
        return 0;
    }

    bpf_probe_read_kernel(&data.comm, sizeof(data. comm), valp->comm);
    data.pid = pid;
    data.tpid = valp->tpid;
    data.ret = PT_REGS_RC(ctx);
    data.sig = valp->sig;

    events.perf_submit(ctx, &data, sizeof(data));
    infotmp.delete(&pid);

    return 0;
}
"""

# Generate PID filter condition
pid_filter = " && ". join([f"tpid != {pid}" for pid in target_pids])
bpf_text = bpf_text. replace('TPID_FILTER',
    f'if ({pid_filter}) {{ return 0; }}')

# Signal filter
if args.signal:
    bpf_text = bpf_text.replace('SIGNAL_FILTER',
        f'if (sig != {args.signal}) {{ return 0; }}')
else:
    bpf_text = bpf_text.replace('SIGNAL_FILTER', '')

if args.ebpf:
    print(bpf_text)
    exit()

# Signal name mapping
signal_names = {
    1: "SIGHUP", 2: "SIGINT", 3: "SIGQUIT", 4: "SIGILL",
    5: "SIGTRAP", 6: "SIGABRT", 7: "SIGBUS", 8: "SIGFPE",
    9: "SIGKILL", 10: "SIGUSR1", 11: "SIGSEGV", 12: "SIGUSR2",
    13: "SIGPIPE", 14: "SIGALRM", 15: "SIGTERM", 17: "SIGCHLD",
    18: "SIGCONT", 19: "SIGSTOP", 20: "SIGTSTP", 28: "SIGWINCH"
}

# Initialize BPF
print("Loading BPF program...")
b = BPF(text=bpf_text)

# Attach to system calls
kill_fnname = b.get_syscall_fnname("kill")
tkill_fnname = b. get_syscall_fnname("tkill")
tgkill_fnname = b.get_syscall_fnname("tgkill")

b.attach_kprobe(event=kill_fnname, fn_name="syscall__kill")
b.attach_kretprobe(event=kill_fnname, fn_name="do_ret_sys_kill")
b.attach_kprobe(event=tkill_fnname, fn_name="syscall__tkill")
b.attach_kretprobe(event=tkill_fnname, fn_name="do_ret_sys_tkill")
b.attach_kprobe(event=tgkill_fnname, fn_name="syscall__tgkill")
b.attach_kretprobe(event=tgkill_fnname, fn_name="do_ret_sys_tgkill")

# Print header
print("\nMonitoring target PIDs: %s" % ", ".join(map(str, target_pids)))
print("Press Ctrl+C to exit\n")
print("%-9s %-8s %-20s %-6s %-10s %-15s %-8s" % (
    "TIME", "SEND_PID", "SEND_PROCESS", "SIGNAL", "TARGET_PID", "SIGNAL_NAME", "RESULT"))
print("-" * 90)

# Statistics
signal_stats = {}

# Process events
def print_event(cpu, data, size):
    event = b["events"].event(data)

    # Filter failed signals
    if args.failed and event.ret >= 0:
        return

    sig_name = signal_names.get(event. sig, f"SIG{event.sig}")
    result = "SUCCESS" if event.ret == 0 else f"FAILED({event.ret})"

    # Statistics
    key = (event. tpid, event.sig)
    signal_stats[key] = signal_stats.get(key, 0) + 1

    printb(b"%-9s %-8d %-20s %-6d %-10d %-15s %-8s" % (
        strftime("%H:%M:%S").encode('ascii'),
        event.pid,
        event.comm,
        event.sig,
        event.tpid,
        sig_name.encode('utf-8'),
        result.encode('utf-8')))

# Event loop
b["events"].open_perf_buffer(print_event)

try:
    while True:
        b.perf_buffer_poll()
except KeyboardInterrupt: 
    print("\n\n" + "=" * 50)
    print("Signal Statistics:")
    print("=" * 50)
    if signal_stats:
        print("%-10s %-15s %-10s" % ("TARGET_PID", "SIGNAL", "COUNT"))
        print("-" * 40)
        for (tpid, sig), count in sorted(signal_stats.items()):
            sig_name = signal_names.get(sig, f"SIG{sig}")
            print("%-10d %-15s %-10d" % (tpid, sig_name, count))
    else:
        print("No signals captured")
    print()
    exit(0)
