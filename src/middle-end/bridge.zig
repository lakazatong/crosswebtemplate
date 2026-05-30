const std = @import("std");

pub var parse_buffer: [4096]u8 = undefined;
pub var output_buffer: [512:0]u8 = undefined;

pub fn parse(ptr: [*:0]const u8) !std.json.Parsed(std.json.Value) {
    var fba = std.heap.FixedBufferAllocator.init(&parse_buffer);
    return std.json.parseFromSlice(std.json.Value, fba.allocator(), std.mem.span(ptr), .{});
}

pub fn stringify(value: anytype) ![*:0]const u8 {
    var fba = std.heap.FixedBufferAllocator.init(&output_buffer);
    const result = try std.json.Stringify.valueAlloc(fba.allocator(), value, .{});
    output_buffer[result.len] = 0;
    return &output_buffer;
}
