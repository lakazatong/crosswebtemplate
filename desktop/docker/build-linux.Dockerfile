FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
