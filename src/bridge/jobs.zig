const dispatch = @import("dispatch.zig");

pub const JobState = enum(usize) { IDLE, PENDING, RUNNING, DONE };

// from the compiler itself:
// extern structs cannot contain fields of type '[]u8'
// slices have no guaranteed in-memory representation
const Buffer = extern struct { ptr: usize, len: usize };

const Job = extern struct {
    state: JobState,
    fn_id: usize,
    input: Buffer,
    output: Buffer,
};

const empty_job: Job = .{
    .state = JobState.IDLE,
    .fn_id = 0,
    .input = .{ .ptr = 0, .len = 0 },
    .output = .{ .ptr = 0, .len = 0 },
};

const SLOTS_SIZE = 64;
pub var slots = [_]Job{empty_job} ** SLOTS_SIZE;

// for JS

export fn submitJob(fn_id: usize, input_ptr: usize, input_len: usize) usize {
    for (0..SLOTS_SIZE) |i| {
        const job = &slots[i];

        if (@atomicLoad(JobState, &job.state, .acquire) == JobState.IDLE) {
            job.fn_id = fn_id;
            job.input = .{ .ptr = input_ptr, .len = input_len };
            job.output = .{ .ptr = 0, .len = 0 };

            @atomicStore(JobState, &job.state, JobState.PENDING, .release);

            return @intCast(i);
        }
    }

    return 0xFFFFFFFF;
}

export fn releaseJob(job_id: usize) void {
    const job = &slots[job_id];
    _ = @cmpxchgStrong(
        JobState,
        &job.state,
        JobState.DONE,
        JobState.IDLE,
        .acquire,
        .monotonic,
    );
}

export fn wake(job_id: usize) void {
    const job = &slots[job_id];

    const old = @cmpxchgStrong(
        JobState,
        &job.state,
        JobState.PENDING,
        JobState.RUNNING,
        .acquire,
        .monotonic,
    );

    if (old == null) { // job.state was PENDING indeed, and is now RUNNING
        dispatch.dispatch(job_id, job.fn_id) catch {
            @atomicStore(JobState, &job.state, JobState.IDLE, .release);
            return;
        };
    }
}

export fn getJobOutputPtr(job_id: usize) usize {
    return slots[job_id].output.ptr;
}

export fn getJobOutputLen(job_id: usize) usize {
    return slots[job_id].output.len;
}
