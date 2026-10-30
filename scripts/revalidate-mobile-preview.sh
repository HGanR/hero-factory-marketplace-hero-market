#!/usr/bin/env bash
# Re-validate the mobile-preview target at one exact committed revision.
#
# Usage:
#   bash scripts/revalidate-mobile-preview.sh <checkout-dir> 2>&1 | tee revalidation.log
#
# <checkout-dir> must be a git checkout of
# HGanR/hero-factory-marketplace-hero-market reachable with the caller's own
# credentials. No secrets are read, printed, or stored by this script.
#
# What it verifies, in order, stopping on the first failure:
#   1. The directory is a git work tree whose origin is this repository.
#   2. Node.js is major version 24 (the target pins Node 24.x).
#   3. An isolated detached worktree is created at the exact expected SHA;
#      the worktree HEAD and a clean status are asserted. The caller's
#      checkout is never checked out, reset, stashed, or force-updated.
#   4. In the isolated worktree: npm ci, the target webpack build, and the
#      target test suite (apps/mobile-preview), then the root mobile/cookie
#      suites with the target's dependencies.
#   5. A runtime dependency audit is recorded (reported, not gating).
#
# The worktree is removed on exit whether the run passes or fails.
# This script performs no deployment, migration, or production action.
set -euo pipefail

CHECKOUT="${1:?Usage: bash scripts/revalidate-mobile-preview.sh <checkout-dir>}"
EXPECTED_SHA="e26b3dd932fec6b627a5a675725047e381343957"
EXPECTED_REPO="HGanR/hero-factory-marketplace-hero-market"

step() { printf '\n=== STEP: %s ===\n' "$1"; }

step "verify checkout and remote"
[ -d "$CHECKOUT" ] || { echo "FAIL: checkout directory does not exist: $CHECKOUT" >&2; exit 1; }
[ "$(git -C "$CHECKOUT" rev-parse --is-inside-work-tree 2>/dev/null)" = "true" ] \
  || { echo "FAIL: not a git work tree: $CHECKOUT" >&2; exit 1; }
REMOTE_URL="$(git -C "$CHECKOUT" remote get-url origin 2>/dev/null || true)"
case "$REMOTE_URL" in
  *"github.com:"$EXPECTED_REPO*|*"github.com/"$EXPECTED_REPO*|*"github.com/"$EXPECTED_REPO".git")
    echo "origin: $REMOTE_URL" ;;
  *)
    echo "FAIL: unexpected origin remote: ${REMOTE_URL:-<none>} (expected $EXPECTED_REPO)" >&2
    exit 1 ;;
esac

step "verify Node version"
command -v node >/dev/null || { echo "FAIL: node is not on PATH" >&2; exit 1; }
NODE_VERSION="$(node --version)"
echo "node: $NODE_VERSION (npm: $(npm --version))"
NODE_MAJOR="$(printf '%s' "$NODE_VERSION" | sed 's/^v//; s/\..*//')"
[ "$NODE_MAJOR" = "24" ] || { echo "FAIL: Node major version is $NODE_MAJOR, expected 24" >&2; exit 1; }

step "fetch and create isolated worktree at exact SHA"
git -C "$CHECKOUT" fetch origin
TMP_DIR="$(mktemp -d)"
WORKTREE="$TMP_DIR/worktree"
cleanup() { git -C "$CHECKOUT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; rm -rf "$TMP_DIR"; }
trap cleanup EXIT
git -C "$CHECKOUT" worktree add --detach "$WORKTREE" "$EXPECTED_SHA"
HEAD_SHA="$(git -C "$WORKTREE" rev-parse HEAD)"
echo "worktree HEAD: $HEAD_SHA"
[ "$HEAD_SHA" = "$EXPECTED_SHA" ] || { echo "FAIL: HEAD $HEAD_SHA != expected $EXPECTED_SHA" >&2; exit 1; }
[ -z "$(git -C "$WORKTREE" status --porcelain)" ] || { echo "FAIL: worktree is not clean" >&2; exit 1; }
echo "SHA verified: $EXPECTED_SHA (clean detached worktree)"

step "target install, build, and tests"
cd "$WORKTREE/apps/mobile-preview"
npm ci --no-fund
npm run build
npm test

step "root mobile and cookie suites with target dependencies"
cd "$WORKTREE"
NODE_PATH="$WORKTREE/apps/mobile-preview/node_modules" node --test tests/mobile/*.test.cjs

step "runtime dependency audit (recorded, not gating)"
npm audit --prefix "$WORKTREE/apps/mobile-preview" --omit=dev --json > "$TMP_DIR/audit.json" || echo "AUDIT-EXIT:$?"
python3 -c "import json;d=json.load(open('$TMP_DIR/audit.json'));m=d.get('metadata',{});print('audit vulnerabilities:',m.get('vulnerabilities',{}))" 2>/dev/null || echo "audit summary unavailable; see command output above"

printf '\n=== REVALIDATION RESULT: PASS ===\n'
printf 'revision: %s\nnode: %s\n' "$EXPECTED_SHA" "$NODE_VERSION"
