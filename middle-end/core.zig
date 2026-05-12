const std = @import("std");

var buffer: [256]u8 = undefined;

export fn increment(ptr: [*]const u8, len: usize) [*]const u8 {
    const input = ptr[0..len];

    var parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, input, .{}) catch {
        return "{\"error\":\"invalid json\"}";
    };
    defer parsed.deinit();

    const value = parsed.value.object.get("data").?.integer;

    const result = std.fmt.bufPrint(&buffer, "{{\"data\":{d}}}", .{value + 1}) catch {
        return "{\"error\":\"overflow\"}";
    };

    return result.ptr;
}
