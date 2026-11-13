const std = @import("std");
const builtin = @import("builtin");

const utils = @import("bridge/utils.zig");
const dispatch = @import("bridge/dispatch.zig");

// increment

const ERR_INCREMENT_TOO_MUCH = utils.ERR_USER_BASE + 1;

const IncrementResponse = struct {
    code: usize,
    origin: []const u8,
    value: isize,
};

const IncrementErrorResponse = struct {
    code: usize,
    message: []const u8,
};

fn increment(job_id: usize) void {
    defer utils.freeInput(job_id);

    const input = utils.getInput(job_id) catch |err| {
        return utils.done(job_id, IncrementErrorResponse{
            .code = utils.ERR_INVALID_ARGS,
            .message = @errorName(err),
        });
    };

    defer input.deinit();

    const value = input.value.object.get("value") orelse {
        return utils.done(job_id, IncrementErrorResponse{
            .code = utils.ERR_INVALID_ARGS,
            .message = "Missing 'value' field",
        });
    };

    const number = std.math.cast(isize, value.integer) orelse {
        return utils.done(job_id, IncrementErrorResponse{
            .code = utils.ERR_INVALID_ARGS,
            .message = "Value is out of range",
        });
    };

    // For the sake of the example of defining user-specific error codes
    if (number > 10) {
        return utils.done(job_id, IncrementErrorResponse{
            .code = ERR_INCREMENT_TOO_MUCH,
            .message = "Cannot increment when above 10 for some mystic reasons...",
        });
    }

    utils.done(job_id, IncrementResponse{
        .code = utils.SUCCESS,
        .origin = "Zig",
        .value = number + 1,
    });
}

const StressResponse = struct {
    code: i32,
    origin: []const u8 = "Zig",
    value: u64,
};

const StressErrorResponse = struct {
    code: usize,
    message: []const u8,
};

extern fn sleep_ms(milliseconds: u32) void;

fn sleep(job_id: usize) void {
    // const iterations: u64 = 100_000_000;

    // var value: u64 = 0x123456789ABCDEF0;

    // for (0..iterations) |_| {
    //     value ^= value << 13;
    //     value ^= value >> 7;
    //     value ^= value << 17;
    // }

    sleep_ms(1000);

    utils.done(job_id, StressResponse{
        .code = utils.SUCCESS,
        .value = 1,
    });
}

// registry, register your functions here

const RegistryEntry = struct {
    id: usize,
    name: [*]const u8,
    name_len: usize,
    fn_ptr: *const fn (usize) void,
};

const REGISTRY = [_]RegistryEntry{
    .{
        .id = 0,
        .name = "increment",
        .name_len = 9,
        .fn_ptr = increment,
    },
    .{
        .id = 1,
        .name = "sleep",
        .name_len = 5,
        .fn_ptr = sleep,
    },
};

// internals

export fn getRegistryCount() usize {
    return REGISTRY.len;
}

export fn getRegistryNamePtr(fn_id: usize) usize {
    if (fn_id >= REGISTRY.len) return 0;

    return @intFromPtr(REGISTRY[fn_id].name);
}

export fn getRegistryNameLen(fn_id: usize) usize {
    if (fn_id >= REGISTRY.len) return 0;

    return REGISTRY[fn_id].name_len;
}

fn dispatchImpl(job_id: usize, fn_id: usize) !void {
    if (fn_id >= REGISTRY.len) {
        return error.InvalidFunctionId;
    }

    REGISTRY[fn_id].fn_ptr(job_id);
}

export fn dispatchInit() void {
    dispatch.dispatchFn = dispatchImpl;
}

comptime {
    _ = utils; // just making sure symbols are exported

    // @compileLog("os", builtin.target.os.tag);
    // @compileLog("arch", builtin.target.cpu.arch);
    // @compileLog("abi", builtin.target.abi);
    // @compileLog("cpu model", builtin.target.cpu.model.name);
    // @compileLog("endian", builtin.target.cpu.arch.endian());
    // @compileLog("pointer width", builtin.target.ptrBitWidth());
    // @compileLog("object format", builtin.target.ofmt);
    // @compileLog("mode", builtin.mode);
}
