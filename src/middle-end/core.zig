const std = @import("std");
const bridge = @import("bridge.zig");

// All exported functions are expected to follow the following convention:
//
// If *output_ptr_ptr is NULL, bridge.writeOutput allocates a new output buffer.
//
// If *output_ptr_ptr is not NULL, bridge.writeOutput attempts to reuse the
// provided buffer and its capacity *output_capacity_ptr.
// If it is too small, it transparently replaces it with a larger one.
//
// On success:
//
//   *output_ptr_ptr      points to the output buffer.
//   *output_len_ptr      contains the number of bytes written.
//   *output_capacity_ptr contains the capacity of the output buffer.
//
// The caller always owns the returned buffer and must eventually free it using:
//
//   bridge.freeBuffer(
//       output_ptr_ptr.*.?,
//       output_capacity_ptr.*,
//   );
//
// Returning an error code leaves the output parameters unchanged.
//
// This convention is automatically respected by using bridge.readInput together
// with bridge.writeOutput (or bridge.writeErrorOutput).

const ERR_INCREMENT_TOO_MUCH = bridge.ERR_INTERNAL + 1;

const IncrementResponse = struct {
    origin: []const u8,
    value: i64,
};

// If you so wish, you can also return a JSON object on error using
// bridge.writeErrorOutput rather than only an error code.
//
// const IncrementErrorResponse = struct {
//     message: []const u8,
// };

export fn increment(
    input_ptr: [*]const u8,
    input_len: usize,
    output_ptr_ptr: *?[*]u8,
    output_len_ptr: *usize,
    output_capacity_ptr: *usize,
) i32 {
    const parsed = bridge.readInput(
        input_ptr,
        input_len,
    ) catch {
        return bridge.ERR_INVALID_ARGS;
    };

    defer parsed.deinit();

    const value = parsed.value.object.get("value") orelse {
        return bridge.ERR_INVALID_ARGS;
    };

    const number = value.integer;

    // For the sake of the example of defining user-specific error codes.
    if (number > 10) {
        return ERR_INCREMENT_TOO_MUCH;
    }

    return bridge.writeOutput(
        IncrementResponse{
            .origin = "From Zig: ",
            .value = number + 1,
        },
        output_ptr_ptr,
        output_len_ptr,
        output_capacity_ptr,
    );
}
