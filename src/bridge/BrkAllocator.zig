const std = @import("std");
const stats = @import("heap_stats.zig");

const Allocator = std.mem.Allocator;
const Alignment = std.mem.Alignment;
const math = std.math;

const assert = std.debug.assert;
// lock for heap
var lock_state: bool = false;

inline fn lock() void {
    while (@cmpxchgWeak(bool, &lock_state, false, true, .acquire, .monotonic) != null) {
        std.atomic.spinLoopHint();
    }
}

inline fn unlock() void {
    @atomicStore(bool, &lock_state, false, .release);
}

const BrkAllocator = struct {
    next_addrs: [size_class_count]usize = @splat(0),
    frees: [size_class_count]usize = @splat(0),
    big_frees: [big_size_class_count]usize = @splat(0),
};

const max_usize = math.maxInt(usize);
const ushift = math.Log2Int(usize);
const bigpage_size: comptime_int = @max(64 * 1024, std.heap.page_size_max);
const bigpage_count = max_usize / bigpage_size;
const min_class = math.log2(math.ceilPowerOfTwoAssert(usize, 1 + @sizeOf(usize)));
const size_class_count = math.log2(bigpage_size) - min_class;
const big_size_class_count = math.log2(bigpage_count);

pub const vtable: Allocator.VTable = .{
    .alloc = alloc,
    .resize = resize,
    .remap = remap,
    .free = free,
};

var global: BrkAllocator = .{};

fn alloc(ctx: *anyopaque, len: usize, alignment: Alignment, return_address: usize) ?[*]u8 {
    _ = ctx;
    _ = return_address;
    lock();
    defer unlock();
    _ = @atomicRmw(u32, &stats.alloc_count, .Add, 1, .monotonic);

    const actual_len = @max(len +| @sizeOf(usize), alignment.toByteUnits());
    const slot_size = math.ceilPowerOfTwo(usize, actual_len) catch return null;
    const class = math.log2(slot_size) - min_class;
    if (class < size_class_count) {
        const addr = a: {
            const top_free_ptr = global.frees[class];
            if (top_free_ptr != 0) {
                const node: *usize = @ptrFromInt(top_free_ptr + (slot_size - @sizeOf(usize)));
                global.frees[class] = node.*;
                break :a top_free_ptr;
            }

            const next_addr = global.next_addrs[class];
            if (next_addr % bigpage_size == 0) {
                const addr = allocBigPages(1);
                if (addr == 0) return null;
                global.next_addrs[class] = addr + slot_size;
                break :a addr;
            } else {
                global.next_addrs[class] = next_addr + slot_size;
                break :a next_addr;
            }
        };
        return @ptrFromInt(addr);
    }
    const bigpages_needed = bigPagesNeeded(actual_len);
    return @ptrFromInt(allocBigPages(bigpages_needed));
}

fn resize(
    ctx: *anyopaque,
    buf: []u8,
    alignment: Alignment,
    new_len: usize,
    return_address: usize,
) bool {
    _ = ctx;
    _ = return_address;
    // No state mutation – no lock needed.
    const buf_align = alignment.toByteUnits();
    const old_actual_len = @max(buf.len + @sizeOf(usize), buf_align);
    const new_actual_len = @max(new_len +| @sizeOf(usize), buf_align);
    const old_small_slot_size = math.ceilPowerOfTwoAssert(usize, old_actual_len);
    const old_small_class = math.log2(old_small_slot_size) - min_class;
    if (old_small_class < size_class_count) {
        const new_small_slot_size = math.ceilPowerOfTwo(usize, new_actual_len) catch return false;
        return old_small_slot_size == new_small_slot_size;
    } else {
        const old_bigpages_needed = bigPagesNeeded(old_actual_len);
        const old_big_slot_pages = math.ceilPowerOfTwoAssert(usize, old_bigpages_needed);
        const new_bigpages_needed = bigPagesNeeded(new_actual_len);
        const new_big_slot_pages = math.ceilPowerOfTwo(usize, new_bigpages_needed) catch return false;
        return old_big_slot_pages == new_big_slot_pages;
    }
}

fn remap(
    context: *anyopaque,
    memory: []u8,
    alignment: Alignment,
    new_len: usize,
    return_address: usize,
) ?[*]u8 {
    return if (resize(context, memory, alignment, new_len, return_address)) memory.ptr else null;
}

fn free(
    ctx: *anyopaque,
    buf: []u8,
    alignment: Alignment,
    return_address: usize,
) void {
    _ = ctx;
    _ = return_address;
    lock();
    defer unlock();
    _ = @atomicRmw(u32, &stats.free_count, .Add, 1, .monotonic);

    const buf_align = alignment.toByteUnits();
    const actual_len = @max(buf.len + @sizeOf(usize), buf_align);
    const slot_size = math.ceilPowerOfTwoAssert(usize, actual_len);
    const class = math.log2(slot_size) - min_class;
    const addr = @intFromPtr(buf.ptr);
    if (class < size_class_count) {
        const node: *usize = @ptrFromInt(addr + (slot_size - @sizeOf(usize)));
        node.* = global.frees[class];
        global.frees[class] = addr;
    } else {
        const bigpages_needed = bigPagesNeeded(actual_len);
        const pow2_pages = math.ceilPowerOfTwoAssert(usize, bigpages_needed);
        const big_slot_size_bytes = pow2_pages * bigpage_size;
        const node: *usize = @ptrFromInt(addr + (big_slot_size_bytes - @sizeOf(usize)));
        const big_class = math.log2(pow2_pages);
        node.* = global.big_frees[big_class];
        global.big_frees[big_class] = addr;
    }
}

inline fn bigPagesNeeded(byte_count: usize) usize {
    return (byte_count + (bigpage_size + (@sizeOf(usize) - 1))) / bigpage_size;
}

fn allocBigPages(n: usize) usize {
    // Called with lock already held.
    const pow2_pages = math.ceilPowerOfTwoAssert(usize, n);
    const slot_size_bytes = pow2_pages * bigpage_size;
    const class = math.log2(pow2_pages);

    const top_free_ptr = global.big_frees[class];
    if (top_free_ptr != 0) {
        const node: *usize = @ptrFromInt(top_free_ptr + (slot_size_bytes - @sizeOf(usize)));
        global.big_frees[class] = node.*;
        return top_free_ptr;
    }

    comptime assert(std.heap.page_size_max == std.heap.page_size_min);
    const page_size = std.heap.page_size_max;
    const pages_per_bigpage = bigpage_size / page_size;
    const total_pages = pow2_pages * pages_per_bigpage;

    const prev_pages = @wasmMemoryGrow(0, total_pages);
    if (prev_pages == -1) return 0;
    const start_byte = @as(usize, @intCast(prev_pages)) * page_size;
    return start_byte;
}
