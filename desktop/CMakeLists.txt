cmake_minimum_required(VERSION 3.16)

set(CMAKE_CXX_STANDARD 17)

set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_RELEASE ON)
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION_DEBUG OFF)

if(MSVC)
	add_compile_options(/arch:AVX2) #make sure SIMD optimizations take place
	add_compile_options(/utf-8 /source-charset:utf-8 /execution-charset:utf-8)

    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded")  # static release
    else()
        set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreadedDebug")  # static debug
    endif()
endif()

project(cwt LANGUAGES CXX RC)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
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
set(WEBVIEW_GTK OFF CACHE BOOL "" FORCE) # Linux
set(WEBVIEW_COCOA OFF CACHE BOOL "" FORCE) # MacOS
set(WEBVIEW_EDGE ON CACHE BOOL "" FORCE) # Windows
## Windows-specific Options
set(WEBVIEW_MSWEBVIEW2_BUILTIN_IMPL ON CACHE BOOL "" FORCE)
set(WEBVIEW_MSWEBVIEW2_EXPLICIT_LINK OFF CACHE BOOL "" FORCE)

add_subdirectory(external/json)
add_subdirectory(external/webview)

add_executable("${CMAKE_PROJECT_NAME}" WIN32)

set_property(TARGET "${CMAKE_PROJECT_NAME}" PROPERTY CXX_STANDARD 17)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
	target_compile_definitions("${CMAKE_PROJECT_NAME}"
        PUBLIC WWW_PATH="./www"
    )
	# Macros for CPP
	target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC PRODUCTION_BUILD=1) 
	target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC DEVELOPMENT_BUILD=0) 
else()
	target_compile_definitions("${CMAKE_PROJECT_NAME}"
        PUBLIC WWW_PATH="${CMAKE_SOURCE_DIR}/../.build/web"
    )
	# Macros for CPP
	target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC PRODUCTION_BUILD=0) 
	target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC DEVELOPMENT_BUILD=1) 
endif()

if(MSVC)
    target_compile_definitions("${CMAKE_PROJECT_NAME}" PUBLIC _CRT_SECURE_NO_WARNINGS)
endif()

target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/include/")
target_include_directories("${CMAKE_PROJECT_NAME}" PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/external/json/include")

# MY_SOURCES is defined to be a list of all the source files
file(GLOB_RECURSE MY_SOURCES CONFIGURE_DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/*.cpp")
target_sources("${CMAKE_PROJECT_NAME}" PRIVATE ${MY_SOURCES} )

if(WIN32)
	target_sources("${CMAKE_PROJECT_NAME}" PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/src/app.rc")
	set_target_properties(${CMAKE_PROJECT_NAME} PROPERTIES WIN32_EXECUTABLE TRUE)
	target_link_options(${CMAKE_PROJECT_NAME} PRIVATE "/SUBSYSTEM:WINDOWS")
endif()

target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE nlohmann_json::nlohmann_json)
target_link_libraries("${CMAKE_PROJECT_NAME}" PRIVATE webview::core_static)
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_link_libraries("${CMAKE_PROJECT_NAME}"
        PRIVATE
        ntdll.lib
        synchronization.lib
        ${CMAKE_SOURCE_DIR}/../.build/zig/windows/release/core.lib
    )
else()
    target_link_libraries("${CMAKE_PROJECT_NAME}"
        PRIVATE
        ntdll.lib
        synchronization.lib
        ${CMAKE_SOURCE_DIR}/../.build/zig/windows/debug/core.lib
    )
endif()
