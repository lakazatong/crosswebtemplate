# CWT (CrossWebTemplate)

> WIP no docs yet, use at your own risk

A minimal template for shipping the same React frontend across Windows, Linux, Web, and Android with a Zig core callable from JS on every platform.

The bridge between JS and Zig differs per platform:

- **Web**: Zig compiles to WASM, called directly from JS
- **Windows / Linux**: Zig compiles to a native library, exposed to the WebView via bound functions
- **Android**: Zig compiles to a `.so`, exposed via JNI and a `JavascriptInterface` bridge

## Bundle sizes

| Platform | Size    |
| -------- | ------- |
| Windows  | 593 KB  |
| Web      | 1.06 MB |
| Linux    | 2.35 MB |
| Android  | 4.46 MB |

## Requirements

- Windows (only supported host for now)
- [Node + npm](https://nodejs.org/en/download/): build system
- [Zig 0.16](https://ziglang.org/download/#release-0.16.0): native core
- [Build Tools for Visual Studio 2026](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2026): CMake + MSVC, needed to build the Windows target
- [Ninja 1.13](https://github.com/ninja-build/ninja/wiki/Pre-built-Ninja-packages): needed by CMake for both the Windows and Linux targets
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/): used to cross-compile the Linux target from Windows
- [Android Studio](https://developer.android.com/studio): provides Gradle, Kotlin, and the Android NDK for the Android target
- [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools): provides `adb`, used to install and run on a connected device. Bundled with Android Studio but needs to be on your PATH: typically at `C:\Users\<you>\AppData\Local\Android\Sdk\platform-tools\adb.exe`. Can also be downloaded standalone from the link.

## Known issues

Some paths are currently hardcoded:

- `android-libc.txt`: points to your local Android NDK
- `scripts/_build_system.js` line 181: NDK clang path for JNI compilation

A `.env` or auto-detection for the Android SDK/NDK installation is on the list.

## Usage

```bash
npm run windows        # build in debug mode and run on Windows
npm run linux          # build in debug mode and run on Linux (via Docker)
npm run web            # build in debug mode and serve in browser
npm run android        # build in debug mode and sideload on connected device

npm run export:windows # build release and output to dist/windows
npm run export:linux   # build release and output to dist/linux
npm run export:web     # build release and output to dist/web
npm run export:android # build release APK to dist/android
```

See `package.json` for more.

## Alternatives

[zero-native](https://github.com/vercel-labs/zero-native) from Vercel Labs: same premise, more mature, documented, also uses Zig.
