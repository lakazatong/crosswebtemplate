# CrossWebTemplate (CWT)

> WIP no docs yet, use at your own risk

A minimal template for shipping the same frontend across Windows, Linux, Web, and Android with a Zig core callable from JS on every platform.

## Bundle sizes

These are obtained by running `npm run export:all`, and checking the size of every folder under `dist/`.

Windows:

| Platform | Size   |
| -------- | ------ |
| Windows  | 1.2 MB |
| Linux    | 5.0 MB |
| Web      | 1.1 MB |
| Android  | 4.9 MB |

Linux (Arch):

| Platform | Size   |
| -------- | ------ |
| Windows  | 2.2 MB |
| Linux    | 5.2 MB |
| Web      | 1.2 MB |
| Android  | 5.0 MB |

## Requirements

If you are on Windows:

- [Node + npm](https://nodejs.org/en/download/): build system
- [Zig 0.17.1](https://ziglang.org/download/#release-0.17.1): native core
- [Build Tools for Visual Studio 2026](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2026): CMake + MSVC, needed to build the Windows and Linux targets
- [Ninja 1.13](https://github.com/ninja-build/ninja/wiki/Pre-built-Ninja-packages): needed by CMake
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/): used to cross-compile the Linux target from Windows
- [Android Studio](https://developer.android.com/studio): provides Gradle, Kotlin, the Android NDK and platform-tools like `adb` for the Android target. Make sure `adb` is on PATH, typically at `C:/Users/<you>/AppData/Local/Android/Sdk/platform-tools/adb.exe`.

If you are on Linux (Arch is the only tested distro for now):

- `sudo pacman -S --needed base-devel pkgconf`: stuff
- `sudo pacman -S --needed nodejs npm`: build system
- `sudo pacman -S --needed zig`: native core
- `sudo pacman -S --needed cmake ninja mingw-w64-gcc gtk3 webkit2gtk-4.1`: CMake + Ninja + MinGW + GTK3 (or WebKitGTK), needed to build the Windows and Linux targets
- `yay -S android-sdk-cmdline-tools-latest android-ndk android-sdk-platform-tools android-sdk-build-tools openssl`: provides Gradle, Kotlin, the Android NDK and platform-tools like `adb` for the Android target.

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

- Have `C:/Program Files/Android/Android Studio/jbr/bin` on PATH (Windows).
- Provide a `sdk.dir` entry in `mobile/android/local.properties`, usually `C:/Users/Bo_wo/AppData/Local/Android/Sdk` (Windows) or `/opt/android-ndk` (so called ANDROID_NDK_HOME or ANDROID_NDK_ROOT) (Linux).
- Expect to get errors like `Failed to install the following Android SDK packages as some licences have not been accepted.`, they will explicitly recommend you to run the "sdkmanager command line tool" or transfer licenses from one workstation to another. You can also directly download the requested packages directly using `sudo ANDROID_NDK_HOME/cmdline-tools/latest/bin/sdkmanager <package>...` (Linux)
- Use the following command:

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
