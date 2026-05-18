const std = @import("std");

var buffer: [512:0]u8 = undefined;

export fn increment(ptr: [*]const u8, len: usize) [*]const u8 {
    const input = ptr[0..len];

    var parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, input, .{}) catch {
        return "{\"error\":\"invalid json\"}\x00".ptr;
    };
    defer parsed.deinit();

    // Input is now a raw JSON string of the object itself, not wrapped in an array
    const first_arg = parsed.value.object;
    const value = first_arg.get("value").?.integer;

    const result = std.fmt.bufPrintZ(&buffer, "{{\"origin\":\"From Zig: \",\"value\":{d}}}", .{value + 1}) catch {
        return "{\"error\":\"overflow\"}\x00".ptr;
    };

    return result.ptr;
}
