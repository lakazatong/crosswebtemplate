$files = @(
    "desktop/src/main.cpp",
    "desktop/CMakeLists.txt",
    "middle-end/core.zig",
    # "mobile/...",
    "scripts/_utils.js",
    # "scripts/build-web.js",
    "scripts/build-windows-debug.js",
    "scripts/build-windows-release.js",
    # "scripts/clean.js",
    # "scripts/export-web.js",
    "scripts/export-windows.js",
    "src/App.jsx",
    "src/bridge.js",
    "src/main.jsx",
    "index.html",
    "package.json",
    "vite.config.ts"
)

$output = "out.txt"
"" | Out-File $output

foreach ($file in $files) {
    "`n===== $file =====`n" | Out-File $output -Append
    Get-Content $file | Out-File $output -Append
}
