pub var dispatchFn: ?*const fn (usize, usize) anyerror!void = null;

pub fn dispatch(job_id: usize, fn_id: usize) !void {
    const func = dispatchFn orelse return error.DispatchUnavailable;
    try func(job_id, fn_id);
}
