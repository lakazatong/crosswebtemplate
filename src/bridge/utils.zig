const std = @import("std");
const jobs = @import("jobs.zig");
const heap = @import("heap.zig");

// Error Codes
pub const SUCCESS = 0;
pub const ERR_INVALID_ARGS = 1;
pub const ERR_OUT_OF_MEMORY = 2;
pub const ERR_INTERNAL = 3;
pub const ERR_USER_BASE = 4;

pub fn freeInput(job_id: usize) void {
    const job = &jobs.slots[job_id];
    const input = job.input;

    if (input.ptr != 0) {
        const ptr: [*]u8 = @ptrFromInt(input.ptr);
        heap.allocator.free(ptr[0..input.len]);
    }

    job.input = .{
        .ptr = 0,
        .len = 0,
    };
}

pub fn getInput(job_id: usize) !std.json.Parsed(std.json.Value) {
    const job = &jobs.slots[job_id];

    const ptr: [*]const u8 = @ptrFromInt(job.input.ptr);
    const slice = ptr[0..job.input.len];

    return std.json.parseFromSlice(
        std.json.Value,
        heap.allocator,
        slice,
        .{},
    );
}

// Host function that the bridge must provide
extern fn notify_host(job_id: usize) void;

pub fn done(job_id: usize, data: anytype) void {
    jobs.lock();
    defer jobs.unlock();

    const job = &jobs.slots[job_id];
    if (job.state != jobs.JobState.RUNNING)
        @panic("done: job is not RUNNING");

    var out = std.Io.Writer.Allocating.init(heap.allocator);

    std.json.Stringify.value(data, .{}, &out.writer) catch {
        out.deinit();
        job.state = .IDLE;
        return;
    };

    const serialized = out.toOwnedSlice() catch {
        out.deinit();
        job.state = .IDLE;
        return;
    };

    job.state = .DONE;
    job.output = .{ .ptr = @intFromPtr(serialized.ptr), .len = serialized.len };

    notify_host(job_id);
}
