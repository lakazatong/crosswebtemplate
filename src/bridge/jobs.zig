const std = @import("std");
const dispatch = @import("dispatch.zig");

// lock for jobs
var lock_state: bool = false;

pub inline fn lock() void {
    while (@cmpxchgWeak(bool, &lock_state, false, true, .acquire, .monotonic) != null) {
        std.atomic.spinLoopHint();
    }
}

pub inline fn unlock() void {
    @atomicStore(bool, &lock_state, false, .release);
}

pub const JobState = enum(usize) {
    IDLE,
    PENDING,
    RUNNING,
    DONE,
};

// from the compiler itself:
// extern structs cannot contain fields of type '[]u8'
// slices have no guaranteed in-memory representation
//
// so we ensure it ourselves, this is just a slice named Buffer
const Buffer = extern struct {
    ptr: usize,
    len: usize,
};

const Job = extern struct {
    state: JobState,
    fn_id: usize,
    input: Buffer,
    output: Buffer,
};

const empty_job: Job = .{
    .state = .IDLE,
    .fn_id = 0,
    .input = .{ .ptr = 0, .len = 0 },
    .output = .{ .ptr = 0, .len = 0 },
};

const SLOTS_SIZE = 64;

pub var slots: [SLOTS_SIZE]Job = @splat(empty_job);

// queue of slot indices
var queue: [SLOTS_SIZE]usize = undefined;
var queue_head: usize = 0;
var queue_tail: usize = 0;
var queue_len: usize = 0;

export fn enqueueJob(fn_id: usize, input_ptr: usize, input_len: usize) usize {
    lock();
    defer unlock();

    if (queue_len == SLOTS_SIZE)
        return 0xFFFFFFFF;

    for (0..SLOTS_SIZE) |i| {
        const job = &slots[i];

        if (job.state != .IDLE)
            continue;

        job.state = .PENDING;
        job.fn_id = fn_id;
        job.input = .{ .ptr = input_ptr, .len = input_len };
        job.output = .{ .ptr = 0, .len = 0 };

        queue[queue_tail] = i;
        queue_tail = (queue_tail + 1) % SLOTS_SIZE;
        queue_len += 1;

        return i;
    }

    return 0xFFFFFFFF;
}

export fn releaseJob(job_id: usize) void {
    lock();
    defer unlock();

    const job = &slots[job_id];
    if (job.state != .DONE)
        @panic("releaseJob: called on non-DONE job");
    job.state = .IDLE;
}

export fn processNextJob() bool {
    lock();

    if (queue_len == 0) {
        unlock();
        return false;
    }

    const job_id = queue[queue_head];
    queue_head = (queue_head + 1) % SLOTS_SIZE;
    queue_len -= 1;

    var job = &slots[job_id];
    if (job.state != .PENDING)
        @panic("processNextJob: job in queue is not PENDING");
    job.state = .RUNNING;

    unlock();

    dispatch.dispatch(job_id, job.fn_id) catch {
        lock();
        defer unlock();

        if (job.state != .RUNNING)
            @panic("processNextJob: job after dispatch failure is not RUNNING");
        job.state = .IDLE;
        return false;
    };

    return true;
}

export fn getJobOutputPtr(job_id: usize) usize {
    return slots[job_id].output.ptr;
}

export fn getJobOutputLen(job_id: usize) usize {
    return slots[job_id].output.len;
}
