---
created: 2026-03-09T00:57:38.883Z
title: Content-hash Docker image naming to skip redundant builds
area: providers
files:
  - src/providers/docker.ts
---

## Problem

`DockerProvider.prepare()` names images with a timestamp (`skill-eval-{taskname}-{Date.now()}`), forcing a full `docker.buildImage()` on every run even when nothing changed. The expensive `npm install -g` layer rebuilds unnecessarily each time.

## Solution

Replace `Date.now()` with a content hash of the build context (Dockerfile + task directory files). Before building, check if an image with that name already exists via `docker.getImage(name).inspect()` and skip the build if it does.

## Resolved during brainstorm

- **ARM64 native containers**: Confirmed `node:24-slim` already resolves to `arm64/v8` on Snapdragon X Elite. Docker Desktop picks the native variant automatically. No code change needed.
- **Pre-pull base image**: Already done manually. One-time developer setup, not a code concern.
- **Dockerfile layer ordering**: The expensive `npm install` layer is already above the `COPY` instructions, so it caches correctly. No change needed.
