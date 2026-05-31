const std = @import("std");
const bridge = @import("bridge.zig");

export fn increment(ptr: [*:0]const u8) [*:0]const u8 {
    const parsed = bridge.parse(ptr) catch return "{\"error\":\"invalid json\"}";

    const value = parsed.value.object.get("value").?.integer;

    return bridge.stringify(.{
        .origin = "From Zig: ",
        .value = value + 1,
    }) catch "{\"error\":\"overflow\"}";
}
