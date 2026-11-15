# CrossWebTemplate (CWT)

> WIP no docs yet, use at your own risk

A minimal template for shipping the same frontend across Windows, Linux, Web, and Android with a Zig core callable from JS on every platform.

## Bundle sizes

These are obtained by running `npm run export:all`, and checking the size of every folder under `dist/`.

| Platform | Size    |
| -------- | ------- |
| Windows  | 1.19 MB |
| Linux    | 5.03 MB |
| Web      | 1.12 MB |
| Android  | 4.91 MB |

## Requirements

If you are on Windows:

- [Node + npm](https://nodejs.org/en/download/): build system
- [Zig 0.17.1](https://ziglang.org/download/#release-0.17.1): native core
- [Build Tools for Visual Studio 2026](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2026): CMake + MSVC, needed to build the Windows and Linux targets
- [Ninja 1.13](https://github.com/ninja-build/ninja/wiki/Pre-built-Ninja-packages): needed by CMake
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/): used to cross-compile the Linux target from Windows
- [Android Studio](https://developer.android.com/studio): provides Gradle, Kotlin, the Android NDK and platform-tools like `adb` for the Android target. Make sure `adb` is on PATH, typically at `C:/Users/<you>/AppData/Local/Android/Sdk/platform-tools/adb.exe`.

If you are on Linux (Arch is the only tested distro for now):

- `sudo pacman -S --needed nodejs npm zig cmake ninja base-devel pkgconf gtk3 openssl webkit2gtk-4.1`

## Basic Usage

```bash
npm run windows        # build debug and run on Windows
npm run linux          # build debug and run on Linux (via Docker)
npm run web            # build debug and serve in browser
npm run android        # build debug and install on connected device

npm run export:windows # build release and output to dist/windows
npm run export:linux   # build release and output to dist/linux
npm run export:web     # build release and output to dist/web
npm run export:android # build release and output to dist/android
```

See `package.json` for more.

In order to build for Android, make sure of the following:

- Have `C:/Program Files/Android/Android Studio/jbr/bin` on PATH.
- Provide a `sdk.dir` entry in `mobile/android/local.properties`, usually `C:/Users/Bo_wo/AppData/Local/Android/Sdk`.
- Use the following command

```bash
keytool -genkeypair -v -keystore crosswebtemplate.keystore -alias crosswebtemplate -keyalg RSA -keysize 2048 -validity 10000
```

or similar under `mobile/android/app` in order to generate the signature for android release APK.
Otherwise, `npm run android:release` will fail. It also requires a `mobile\android\keystore.properties` file, here is a template:

```
storeFile=crosswebtemplate.keystore
storePassword=YOUR_PASSWORD
keyAlias=crosswebtemplate
keyPassword=YOUR_PASSWORD
```

`YOUR_PASSWORD` is the same one you used when creating the certificate with the `keytool` command (yes, it can be used both for `storePassword` and `keyPassword`).

## Alternatives

[zero-native](https://github.com/vercel-labs/zero-native) from Vercel Labs: same premise, more mature, documented, also uses Zig.
