const std = @import("std");

var buffer: [512:0]u8 = undefined;

export fn increment(ptr: [*:0]const u8) [*:0]const u8 {
    const input = std.mem.span(ptr);

    var parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, input, .{}) catch {
        return "{\"error\":\"invalid json\"}";
    };
    defer parsed.deinit();

    const value = parsed.value.object.get("value").?.integer;

    const result = std.json.Stringify.valueAlloc(
        std.heap.page_allocator,
        .{ .origin = "From Zig: ", .value = value + 1 },
        .{},
    ) catch return "{\"error\":\"overflow\"}";
    defer std.heap.page_allocator.free(result);

    if (result.len >= buffer.len) return "{\"error\":\"overflow\"}";
    @memcpy(buffer[0..result.len], result);
    buffer[result.len] = 0;
    return &buffer;
}
