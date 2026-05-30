const std = @import("std");

var input_buffer: [512]u8 = undefined;
var parse_buffer: [4096]u8 = undefined;
var output_buffer: [512:0]u8 = undefined;

export fn getInputBuffer() [*]u8 {
    return &input_buffer;
}

fn parse(ptr: [*:0]const u8) !std.json.Parsed(std.json.Value) {
    var fba = std.heap.FixedBufferAllocator.init(&parse_buffer);
    return std.json.parseFromSlice(std.json.Value, fba.allocator(), std.mem.span(ptr), .{});
}

fn stringify(value: anytype) ![*:0]const u8 {
    var fba = std.heap.FixedBufferAllocator.init(&output_buffer);
    const result = try std.json.Stringify.valueAlloc(fba.allocator(), value, .{});
    output_buffer[result.len] = 0;
    return &output_buffer;
}

export fn increment(ptr: [*:0]const u8) [*:0]const u8 {
    const parsed = parse(ptr) catch return "{\"error\":\"invalid json\"}";

    const value = parsed.value.object.get("value").?.integer;

    return stringify(.{ .origin = "From Zig: ", .value = value + 1 }) catch "{\"error\":\"overflow\"}";
}
