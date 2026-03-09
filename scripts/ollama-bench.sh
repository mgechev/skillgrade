#!/usr/bin/env bash
# scripts/ollama-bench.sh -- Cross-platform Ollama benchmark orchestrator
#
# Manages Ollama server lifecycle with different tuning profiles and invokes
# the TypeScript benchmark script for each profile.
#
# Usage:
#   bash scripts/ollama-bench.sh [--models model1,model2]
#
# Profiles:
#   1. default         -- No Ollama env vars, default API params
#   2. optimized-env   -- Optimized env vars, default API params
#   3. optimized-all   -- Optimized env vars + optimized API params

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_DIR/benchmark-results"
MODELS_ARG=""
OLLAMA_PID=""

# Parse optional --models argument
while [[ $# -gt 0 ]]; do
    case "$1" in
        --models)
            MODELS_ARG="--models $2"
            shift 2
            ;;
        *)
            echo "[WARN] Unknown argument: $1"
            shift
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------

detect_platform() {
    if [[ "$OSTYPE" == msys* ]] || [[ "$OSTYPE" == mingw* ]]; then
        echo "windows"
    elif [[ "$OSTYPE" == linux* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == darwin* ]]; then
        echo "darwin"
    else
        echo "unknown"
    fi
}

PLATFORM="$(detect_platform)"
echo "[INFO] Platform detected: $PLATFORM ($OSTYPE)"

# Determine thread count based on platform
if [[ "$PLATFORM" == "windows" ]]; then
    # Snapdragon X Elite has 12 cores
    NUM_THREADS=12
elif command -v nproc &>/dev/null; then
    NUM_THREADS="$(nproc)"
else
    NUM_THREADS=4
fi
echo "[INFO] Thread count: $NUM_THREADS"

# ---------------------------------------------------------------------------
# Ollama lifecycle functions
# ---------------------------------------------------------------------------

stop_ollama() {
    echo "[INFO] Stopping Ollama..."

    if [[ "$PLATFORM" == "windows" ]]; then
        # Double-slash for Git Bash flag escaping
        taskkill.exe //IM ollama.exe //F 2>/dev/null || true
    else
        pkill -f "ollama serve" 2>/dev/null || true
    fi

    # Reset PID tracking
    OLLAMA_PID=""

    # Allow port to release
    sleep 2
    echo "[OK] Ollama stopped"
}

wait_for_ollama() {
    local retries=30
    echo "[INFO] Waiting for Ollama..."

    while ! curl -sf http://localhost:11434/ > /dev/null 2>&1; do
        retries=$((retries - 1))

        if [[ $retries -le 0 ]]; then
            echo "[ERROR] Ollama failed to start within 30s"
            exit 1
        fi

        sleep 1
    done

    echo "[OK] Ollama ready"
}

start_ollama() {
    # Stop any running instance first
    stop_ollama

    echo "[INFO] Starting Ollama with env: $*"

    # Start with provided env vars
    env "$@" ollama serve &
    OLLAMA_PID=$!

    wait_for_ollama
}

# ---------------------------------------------------------------------------
# Cleanup trap
# ---------------------------------------------------------------------------

cleanup() {
    echo ""
    echo "[INFO] Cleaning up..."
    stop_ollama
    exit 1
}

trap cleanup INT TERM

# ---------------------------------------------------------------------------
# Ensure results directory exists
# ---------------------------------------------------------------------------

mkdir -p "$RESULTS_DIR"

# ---------------------------------------------------------------------------
# Profile 1: Default
# ---------------------------------------------------------------------------

echo ""
echo "================================================================"
echo "[INFO] Profile 1/3: default"
echo "[INFO]   No Ollama env vars, default API params"
echo "================================================================"

start_ollama
npx ts-node "$PROJECT_DIR/tests/benchmark-grader.ts" \
    --profile default \
    --output "$RESULTS_DIR/default.json" \
    $MODELS_ARG || true
stop_ollama

# ---------------------------------------------------------------------------
# Profile 2: Optimized env, default API params
# ---------------------------------------------------------------------------

echo ""
echo "================================================================"
echo "[INFO] Profile 2/3: optimized-env"
echo "[INFO]   OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0"
echo "[INFO]   OLLAMA_NUM_PARALLEL=1 OLLAMA_NUM_THREAD=$NUM_THREADS"
echo "================================================================"

start_ollama \
    OLLAMA_FLASH_ATTENTION=1 \
    OLLAMA_KV_CACHE_TYPE=q8_0 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_NUM_THREAD="$NUM_THREADS"

npx ts-node "$PROJECT_DIR/tests/benchmark-grader.ts" \
    --profile optimized-env \
    --output "$RESULTS_DIR/optimized-env.json" \
    $MODELS_ARG || true
stop_ollama

# ---------------------------------------------------------------------------
# Profile 3: Optimized env + optimized API params
# ---------------------------------------------------------------------------

echo ""
echo "================================================================"
echo "[INFO] Profile 3/3: optimized-all"
echo "[INFO]   Same env vars + optimized API params (num_thread, num_batch)"
echo "================================================================"

start_ollama \
    OLLAMA_FLASH_ATTENTION=1 \
    OLLAMA_KV_CACHE_TYPE=q8_0 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_NUM_THREAD="$NUM_THREADS"

npx ts-node "$PROJECT_DIR/tests/benchmark-grader.ts" \
    --profile optimized-all \
    --output "$RESULTS_DIR/optimized-all.json" \
    $MODELS_ARG || true
stop_ollama

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "================================================================"
echo "[OK] All profiles complete. Results in $RESULTS_DIR/"
echo "================================================================"
ls -la "$RESULTS_DIR/"

exit 0
