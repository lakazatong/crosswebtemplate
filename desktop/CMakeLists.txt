cmake_minimum_required(VERSION 3.16)
set(CMAKE_CXX_STANDARD 17)

if(WIN32)
    set(BUILD_ROOT "${CMAKE_SOURCE_DIR}/../.build")
elseif(APPLE)
    message(FATAL_ERROR "macOS not supported (yet)")
elseif(UNIX)
    set(BUILD_ROOT "/app/.build")
else()
    message(FATAL_ERROR "Unknown platform")
endif()

set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_DEBUG OFF)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

project(cwt LANGUAGES CXX)

set(CMAKE_MSVC_RUNTIME_LIBRARY
    "$<$<CONFIG:Release>:MultiThreaded>$<$<CONFIG:Debug>:MultiThreadedDebug>"
)

if(MSVC)
	add_compile_options(/arch:AVX2) # make sure SIMD optimizations take place
	add_compile_options(/utf-8)
endif()

if(WIN32)
    enable_language(RC)
endif()

set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

# CMake Options
set(WEBVIEW_BUILD ON CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_AMALGAMATION OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_SHARED_LIBRARY OFF CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_STATIC_LIBRARY ON CACHE BOOL "" FORCE)
set(WEBVIEW_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_ENABLE_CHECKS ON CACHE BOOL "" FORCE)
set(WEBVIEW_ENABLE_CLANG_FORMAT OFF CACHE BOOL "" FORCE)
set(WEBVIEW_ENABLE_CLANG_TIDY OFF CACHE BOOL "" FORCE)
set(WEBVIEW_ENABLE_PACKAGING OFF CACHE BOOL "" FORCE)
set(WEBVIEW_INSTALL_DOCS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_INSTALL_TARGETS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_IS_CI OFF CACHE BOOL "" FORCE)
set(WEBVIEW_PACKAGE_AMALGAMATION OFF CACHE BOOL "" FORCE)
set(WEBVIEW_PACKAGE_DOCS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_PACKAGE_HEADERS OFF CACHE BOOL "" FORCE)
set(WEBVIEW_PACKAGE_LIB OFF CACHE BOOL "" FORCE)
set(WEBVIEW_STRICT_CHECKS ON CACHE BOOL "" FORCE)
set(WEBVIEW_STRICT_CLANG_FORMAT OFF CACHE BOOL "" FORCE)
set(WEBVIEW_STRICT_CLANG_TIDY OFF CACHE BOOL "" FORCE)
set(WEBVIEW_USE_COMPAT_MINGW OFF CACHE BOOL "" FORCE)
set(WEBVIEW_USE_STATIC_MSVC_RUNTIME ON CACHE BOOL "" FORCE)
# Package Consumer Options
## Linux-specific Options
set(WEBVIEW_WEBKITGTK_API "4.1" CACHE STRING "" FORCE)
## Windows-specific Options
set(WEBVIEW_MSWEBVIEW2_VERSION "1.0.3650.58" CACHE STRING "" FORCE)
set(WEBVIEW_USE_BUILTIN_MSWEBVIEW2 ON CACHE BOOL "" FORCE)
# Compile-time Options
## C API Linkage
set(WEBVIEW_STATIC ON CACHE BOOL "" FORCE)
## Backend Selection
if(WIN32)
    set(WEBVIEW_EDGE ON CACHE BOOL "" FORCE)
    set(WEBVIEW_GTK OFF CACHE BOOL "" FORCE)
    set(WEBVIEW_COCOA OFF CACHE BOOL "" FORCE)
elseif(APPLE)
    set(WEBVIEW_EDGE OFF CACHE BOOL "" FORCE)
    set(WEBVIEW_GTK OFF CACHE BOOL "" FORCE)
    set(WEBVIEW_COCOA ON CACHE BOOL "" FORCE)
elseif(UNIX)
    set(WEBVIEW_EDGE OFF CACHE BOOL "" FORCE)
    set(WEBVIEW_GTK ON CACHE BOOL "" FORCE)
    set(WEBVIEW_COCOA OFF CACHE BOOL "" FORCE)
endif()
## Windows-specific Options
set(WEBVIEW_MSWEBVIEW2_BUILTIN_IMPL ON CACHE BOOL "" FORCE)
set(WEBVIEW_MSWEBVIEW2_EXPLICIT_LINK OFF CACHE BOOL "" FORCE)

add_subdirectory(external/json)
add_subdirectory(external/webview)

if(WIN32)
    add_executable("${CMAKE_PROJECT_NAME}" WIN32)
else()
    add_executable("${CMAKE_PROJECT_NAME}")
endif()

set_property(TARGET "${CMAKE_PROJECT_NAME}" PROPERTY CXX_STANDARD 17)

target_compile_definitions(${CMAKE_PROJECT_NAME} PUBLIC
    # WWW_PATH is deduced from the executable path at runtime
    $<$<CONFIG:Release>:PRODUCTION_BUILD=1>
    $<$<CONFIG:Release>:DEVELOPMENT_BUILD=0>

    $<$<NOT:$<CONFIG:Release>>:WWW_PATH="${BUILD_ROOT}/frontend">
    $<$<NOT:$<CONFIG:Release>>:PRODUCTION_BUILD=0>
    $<$<NOT:$<CONFIG:Release>>:DEVELOPMENT_BUILD=1>
)

if(MSVC)
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC _CRT_SECURE_NO_WARNINGS)
endif()

target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include/")
target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/external/json/include/")

# MY_SOURCES is defined to be a list of all the source files
file(GLOB_RECURSE MY_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")
target_sources("${CMAKE_PROJECT_NAME}" PRIVATE ${MY_SOURCES} )


if(WIN32)
	target_sources("${CMAKE_PROJECT_NAME}" PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/resources/windows/resources.rc")
	set_target_properties("${CMAKE_PROJECT_NAME}" PROPERTIES WIN32_EXECUTABLE TRUE)
	target_link_options("${CMAKE_PROJECT_NAME}" PRIVATE "/SUBSYSTEM:WINDOWS")
elseif(APPLE)
    # set(MACOSX_BUNDLE TRUE)
    # set_target_properties("${CMAKE_PROJECT_NAME}" PROPERTIES
    #     MACOSX_BUNDLE_INFO_PLIST ${CMAKE_SOURCE_DIR}/mac/Info.plist
    # )
elseif(UNIX)
    install(FILES packaging/app.desktop DESTINATION share/applications)
    install(FILES assets/icon.png DESTINATION share/pixmaps)
    target_link_options("${CMAKE_PROJECT_NAME}" PRIVATE "-Wl,-z,noexecstack")
endif()

target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE nlohmann_json::nlohmann_json)
target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE webview::core_static)

set(BASE_LIBS "")

if(WIN32)
    list(APPEND BASE_LIBS ntdll.lib synchronization.lib)
endif()

string(TOLOWER "${CMAKE_SYSTEM_NAME}" SYSTEM_NAME_LOWER)

set(ZIG_LIB_WIN "${BUILD_ROOT}/zig/${SYSTEM_NAME_LOWER}/$<LOWER_CASE:$<CONFIG>>/core.lib")
set(ZIG_LIB_UNIX "${BUILD_ROOT}/zig/${SYSTEM_NAME_LOWER}/$<LOWER_CASE:$<CONFIG>>/core.a")

target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE
    ${BASE_LIBS}
    $<$<PLATFORM_ID:Windows>:${ZIG_LIB_WIN}>
    $<$<NOT:$<PLATFORM_ID:Windows>>:${ZIG_LIB_UNIX}>
)
