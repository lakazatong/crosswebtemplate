const std = @import("std");
const builtin = @import("builtin");
const BrkAllocator = @import("BrkAllocator.zig");
const PageAllocator = @import("PageAllocator.zig");

const Allocator = std.mem.Allocator;

const is_wasm = builtin.cpu.arch.isWasm();

// pub const allocator = if (is_wasm) blk: {
//     break :blk Allocator{
//         .ptr = undefined,
//         .vtable = &BrkAllocator.vtable,
//     };
// } else std.heap.c_allocator;

pub const allocator = if (is_wasm) Allocator{
    .ptr = undefined,
    .vtable = &BrkAllocator.vtable,
} else Allocator{
    .ptr = undefined,
    .vtable = &PageAllocator.vtable,
};

// for JS

export fn heapAlloc(size: usize) ?[*]u8 {
    const slice = allocator.alloc(u8, size) catch return null;
    return slice.ptr;
}

export fn heapFree(ptr: [*]u8, size: usize) void {
    allocator.free(ptr[0..size]);
}
