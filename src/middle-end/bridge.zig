const std = @import("std");

pub const SUCCESS = 0;
pub const ERR_INVALID_ARGS = 1;
pub const ERR_OUT_OF_MEMORY = 2;
pub const ERR_INTERNAL = 3;

const allocator = std.heap.wasm_allocator;

// For wasm_bridge.js

export fn allocBuffer(len: usize) usize {
    const buffer = allocator.alloc(u8, len) catch return 0;
    return @intFromPtr(buffer.ptr);
}

export fn freeBuffer(ptr: [*]u8, len: usize) void {
    allocator.free(ptr[0..len]);
}

// For user implementations

pub fn readInput(
    ptr: [*]const u8,
    len: usize,
) !std.json.Parsed(std.json.Value) {
    return std.json.parseFromSlice(
        std.json.Value,
        allocator,
        ptr[0..len],
        .{},
    );
}

// Writes a JSON response into the caller-provided output buffer.
//
// If *output_ptr_ptr is null, a new buffer is allocated.
//
// Otherwise, the existing buffer is reused whenever possible. If it is too
// small, it is transparently replaced with a larger one.
//
// On success, the three output parameters are always updated:
//
//   *output_ptr_ptr      -> pointer to the output buffer
//   *output_len_ptr      -> number of bytes written
//   *output_capacity_ptr -> capacity of the output buffer
//
// The caller always owns the returned buffer and must eventually free it
// using freeBuffer(*output_ptr_ptr, *output_capacity_ptr).
pub fn writeOutput(
    value: anytype,
    output_ptr_ptr: *?[*]u8,
    output_len_ptr: *usize,
    output_capacity_ptr: *usize,
) i32 {
    const json = std.json.Stringify.valueAlloc(
        allocator,
        value,
        .{},
    ) catch {
        return ERR_OUT_OF_MEMORY;
    };

    defer allocator.free(json);

    if (output_ptr_ptr.*) |buffer| {
        if (output_capacity_ptr.* < json.len) {
            allocator.free(buffer[0..output_capacity_ptr.*]);

            const new_buffer = allocator.alloc(
                u8,
                json.len,
            ) catch {
                output_ptr_ptr.* = null;
                output_len_ptr.* = 0;
                output_capacity_ptr.* = 0;
                return ERR_OUT_OF_MEMORY;
            };

            @memcpy(new_buffer, json);

            output_ptr_ptr.* = new_buffer.ptr;
            output_len_ptr.* = json.len;
            output_capacity_ptr.* = new_buffer.len;

            return SUCCESS;
        }

        @memcpy(
            buffer[0..json.len],
            json,
        );

        output_len_ptr.* = json.len;

        return SUCCESS;
    }

    const buffer = allocator.alloc(
        u8,
        json.len,
    ) catch {
        return ERR_OUT_OF_MEMORY;
    };

    @memcpy(
        buffer,
        json,
    );

    output_ptr_ptr.* = buffer.ptr;
    output_len_ptr.* = json.len;
    output_capacity_ptr.* = buffer.len;

    return SUCCESS;
}

pub fn writeErrorOutput(
    value: anytype,
    output_ptr_ptr: *?[*]u8,
    output_len_ptr: *usize,
    output_capacity_ptr: *usize,
) i32 {
    return writeOutput(
        value,
        output_ptr_ptr,
        output_len_ptr,
        output_capacity_ptr,
    );
}
