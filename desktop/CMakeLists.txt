cmake_minimum_required(VERSION 3.16)
project(cwt LANGUAGES CXX)

if(NOT CMAKE_GENERATOR STREQUAL "Ninja")
    message(FATAL_ERROR "Only Ninja is supported")
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(BUILD_ROOT "${CMAKE_SOURCE_DIR}/../.build")

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Debug CACHE STRING "" FORCE)
endif()

set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_DEBUG OFF)

if(WIN32)
    enable_language(RC)

	add_compile_options(/arch:AVX2) # make sure SIMD optimizations take place
	add_compile_options(/utf-8)

    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(CMAKE_MSVC_RUNTIME_LIBRARY MultiThreadedDebug)
    else()
        set(CMAKE_MSVC_RUNTIME_LIBRARY MultiThreaded)
    endif()
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
set(WEBVIEW_MSWEBVIEW2_VERSION "1.0.3967.48" CACHE STRING "" FORCE)
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

add_subdirectory(external/webview)

if(WIN32)
    add_executable("${CMAKE_PROJECT_NAME}" WIN32)
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC _CRT_SECURE_NO_WARNINGS)
else()
    add_executable("${CMAKE_PROJECT_NAME}")
endif()

set_property(TARGET "${CMAKE_PROJECT_NAME}" PROPERTY CXX_STANDARD 17)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(MODE "release")
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PRIVATE PRODUCTION_BUILD=1)
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PRIVATE DEVELOPMENT_BUILD=0)
    # WWW_PATH is deduced from the executable path at runtime
else()
    set(MODE "debug")
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PRIVATE PRODUCTION_BUILD=0)
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PRIVATE DEVELOPMENT_BUILD=1)
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PRIVATE WWW_PATH="${BUILD_ROOT}/frontend")
endif()

target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/external/json/include/")
target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/external/webview/core/include/")

if(WIN32)
	set_target_properties("${CMAKE_PROJECT_NAME}" PROPERTIES WIN32_EXECUTABLE TRUE)
	target_link_options("${CMAKE_PROJECT_NAME}" PRIVATE "/SUBSYSTEM:WINDOWS")
	target_sources("${CMAKE_PROJECT_NAME}" PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/resources/windows/resources.rc")
elseif(APPLE)
    # set(MACOSX_BUNDLE TRUE)
    # set_target_properties("${CMAKE_PROJECT_NAME}" PROPERTIES
    #     MACOSX_BUNDLE_INFO_PLIST ${CMAKE_SOURCE_DIR}/mac/Info.plist
    # )
elseif(UNIX)
    target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/external/httplib/include/") # one header library
    # install(FILES packaging/app.desktop DESTINATION share/applications)
    # install(FILES assets/icon.png DESTINATION share/pixmaps)
    target_link_options("${CMAKE_PROJECT_NAME}" PRIVATE "-Wl,-z,noexecstack")
endif()

# MY_SOURCES is defined to be a list of all the source files
file(GLOB_RECURSE MY_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")
target_sources("${CMAKE_PROJECT_NAME}" PRIVATE ${MY_SOURCES} )

target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE webview::core_static)

string(TOLOWER "${CMAKE_SYSTEM_NAME}" SYSTEM_NAME_LOWER)

if(WIN32)
    target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE
        ntdll.lib
        synchronization.lib
        "${BUILD_ROOT}/zig/${SYSTEM_NAME_LOWER}/${MODE}/core.lib"
    )
else(UNIX)
    target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE
        "${BUILD_ROOT}/zig/${SYSTEM_NAME_LOWER}/${MODE}/core.a"
    )
endif()
