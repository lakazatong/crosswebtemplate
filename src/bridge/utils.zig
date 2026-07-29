const std = @import("std");
const jobs = @import("jobs.zig");

// Error Codes
pub const SUCCESS = 0;
pub const ERR_INVALID_ARGS = 1;
pub const ERR_OUT_OF_MEMORY = 2;
pub const ERR_INTERNAL = 3;
pub const ERR_USER_BASE = 4;

pub fn getInput(job_id: usize) !std.json.Parsed(std.json.Value) {
    const job = &jobs.slots[job_id];

    const ptr: [*]const u8 = @ptrFromInt(job.input.ptr);
    const slice = ptr[0..job.input.len];

    return std.json.parseFromSlice(
        std.json.Value,
        std.heap.wasm_allocator,
        slice,
        .{},
    );
}

// Host function that JS must provide
extern fn notify_js(job_id: usize) void;

pub fn done(job_id: usize, data: anytype) void {
    const job = &jobs.slots[job_id];
    if (@atomicLoad(jobs.JobState, &job.state, .acquire) != jobs.JobState.RUNNING) return;

    var out = std.Io.Writer.Allocating.init(std.heap.wasm_allocator);

    std.json.Stringify.value(data, .{}, &out.writer) catch {
        out.deinit();
        @atomicStore(jobs.JobState, &job.state, jobs.JobState.IDLE, .release);
        return;
    };

    const serialized = out.toOwnedSlice() catch {
        out.deinit();
        @atomicStore(jobs.JobState, &job.state, jobs.JobState.IDLE, .release);
        return;
    };

    job.output = .{ .ptr = @intFromPtr(serialized.ptr), .len = serialized.len };
    @atomicStore(jobs.JobState, &job.state, jobs.JobState.DONE, .release);

    notify_js(job_id);
}

// for JS

export fn heapAlloc(size: usize) ?[*]u8 {
    const slice = std.heap.wasm_allocator.alloc(u8, size) catch return null;
    return slice.ptr;
}

export fn heapFree(ptr: [*]u8, size: usize) void {
    std.heap.wasm_allocator.free(ptr[0..size]);
}

comptime {
    _ = jobs;
}
