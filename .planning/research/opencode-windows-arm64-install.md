# Installing opencode CLI on Windows ARM64

**Problem:** opencode does not ship a `windows-arm64` binary ([issue #4340](https://github.com/anomalyco/opencode/issues/4340)). The npm wrapper detects ARM64 and fails with:

```
It seems that your package manager failed to install the right version of the opencode CLI for your platform.
You can try manually installing "opencode-windows-arm64" package
```

**Solution:** Force-install the x64 binary and set `OPENCODE_BIN_PATH` so the Node.js wrapper uses it directly. Windows 11 ARM64 runs x86_64 binaries natively via its built-in emulation layer.

## Prerequisites

- Windows 11 on ARM64 (e.g., Snapdragon X Elite)
- Node.js installed (any architecture — ARM64 or x64)
- npm available

## Step 1: Install the main package

```powershell
npm install -g opencode-ai@latest
```

This installs the Node.js wrapper but **no platform binary** (since `opencode-windows-arm64` doesn't exist). The `opencode` command will fail at this point — that's expected.

## Step 2: Force-install the x64 platform package

```powershell
npm install -g opencode-windows-x64@1.2.24 --force
```

npm will warn about `EBADPLATFORM` (CPU mismatch) without `--force`. The `--force` flag overrides the platform check and installs the x64 binary.

> **Note:** Replace `1.2.24` with the version from Step 1 if different. The platform package version must match the main package version. Check with `npm list -g opencode-ai`.

## Step 3: Find the global npm prefix

The binary path depends on your npm global prefix. Find it with:

```powershell
npm prefix -g
```

**Default (standard Node.js install):**

```
C:\Users\<username>\AppData\Roaming\npm
```

**FNM users:** FNM overrides the global prefix to a custom location (e.g., `%USERPROFILE%\.local\bin`). Use whatever `npm prefix -g` returns.

## Step 4: Set OPENCODE_BIN_PATH

The Node.js wrapper reads `OPENCODE_BIN_PATH` (line 20-23 of `bin/opencode`) and uses it to locate the binary, bypassing platform detection entirely.

Substitute `<npm-prefix>` with the output from Step 3:

```powershell
setx OPENCODE_BIN_PATH "<npm-prefix>\node_modules\opencode-windows-x64\bin\opencode.exe"
```

**Example (default npm prefix):**

```powershell
setx OPENCODE_BIN_PATH "%APPDATA%\npm\node_modules\opencode-windows-x64\bin\opencode.exe"
```

**Example (FNM):**

```powershell
setx OPENCODE_BIN_PATH "%USERPROFILE%\.local\bin\node_modules\opencode-windows-x64\bin\opencode.exe"
```

> **Note:** `setx` sets a **persistent user-level environment variable**. It does NOT affect the current terminal session. You must open a new terminal (or restart your IDE/editor) for the change to take effect.

## Step 5: Verify

Open a **new terminal** and run:

```powershell
opencode --version
```

Expected output:

```
1.2.24
```

## Upgrading

When upgrading opencode, repeat Steps 1-2 with the new version:

```powershell
npm install -g opencode-ai@latest
npm install -g opencode-windows-x64@<new-version> --force
```

`OPENCODE_BIN_PATH` does not need to change — it points to the same path, which npm overwrites in place.

## Troubleshooting

### Segfault (exit code 139)

If `opencode` segfaults, the issue is ARM64 Node.js calling `spawnSync` on the x64 binary. This happens whenever the Node.js wrapper is invoked instead of the `.exe` directly — regardless of shell. This is a Node.js bug, not an opencode bug.

**Workaround:** Invoke the binary directly, bypassing the Node.js wrapper:

```powershell
& "$(npm prefix -g)\node_modules\opencode-windows-x64\bin\opencode.exe" --version
```

### OPENCODE_BIN_PATH not taking effect

`setx` requires a new process tree. Close **all** terminals and IDE sessions, then reopen. The variable is set at the user level and inherited by all new processes.

Verify the variable is set:

**PowerShell:**

```powershell
$env:OPENCODE_BIN_PATH
```

**CMD:**

```cmd
echo %OPENCODE_BIN_PATH%
```

**Git Bash:**

```bash
echo "$OPENCODE_BIN_PATH"
```

### Version mismatch after upgrade

If `opencode --version` shows the old version after upgrading, verify the x64 package was updated:

```powershell
npm list -g opencode-ai opencode-windows-x64
```

Both should show the same version.

## Why this works

1. **Windows 11 ARM64 emulation:** Windows 11 transparently runs x86_64 binaries on ARM64 via its built-in emulation layer. The opencode x64 binary (built with Bun) runs correctly under this emulation.

2. **OPENCODE_BIN_PATH:** The npm wrapper script (`node_modules/opencode-ai/bin/opencode`) checks this env var first (before platform detection) and calls `spawnSync(target)` with the specified path. This skips the `opencode-windows-arm64` package lookup entirely.

3. **Bun upstream:** Bun added `bun-windows-arm64` support in v1.3.10 (2026-02-26), so a native opencode ARM64 binary is technically possible. Once opencode adds `opencode-windows-arm64` to their build matrix, this workaround becomes unnecessary.

---

*Tested: 2026-03-10 on Windows 11 ARM64 (Snapdragon X Elite) with opencode v1.2.24, Node.js ARM64*
