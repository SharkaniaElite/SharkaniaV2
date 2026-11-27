#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
runner="$root/scripts/recovery/pg17-restore.sh"
bash -n "$runner"

if output=$(bash "$runner" "$@" synthetic 2>&1); then
    printf '%s\n' "$output"
else
    printf '%s\n' "$output" >&2
    exit 1
fi
grep -Fxq 'PASS restore-post-data' <<<"$output"
grep -Fxq 'PASS restored-checks mode=synthetic' <<<"$output"
grep -Fxq 'PASS synthetic-catalog inventory and Auth FK mapping' <<<"$output"
grep -Fxq 'PASS extension-versions requested versions available' <<<"$output"
if [[ ${1:-} == --supabase-image-id ]]; then
    grep -Fxq 'PASS Supabase packages pg_cron, pg_net, supabase_vault and vector available' <<<"$output"
fi
grep -Fxq 'PASS cleanup temporary containers and RAM work directory absent' <<<"$output"
grep -Eq '^RESULT mode=synthetic exit=0 ' <<<"$output"

if output=$(bash "$runner" "$@" synthetic --wrong-key 2>&1); then
    printf 'FAIL invalid key was accepted\n' >&2
    exit 1
else
    result=$?
fi
printf '%s\n' "$output"
[[ $result -eq 1 ]]
grep -Fxq 'FAIL authenticated-decryption' <<<"$output"
grep -Fxq 'PASS cleanup temporary containers and RAM work directory absent' <<<"$output"
grep -Eq '^RESULT mode=synthetic exit=1 ' <<<"$output"
if grep -Eq '^PASS (authenticated-decryption|restore-|restored-checks)' <<<"$output"; then
    printf 'FAIL restore proceeded after decryption failure\n' >&2
    exit 1
fi

if output=$(CI=true bash "$runner" "$@" preflight 2>&1); then
    printf 'FAIL CI was accepted as an offline host\n' >&2
    exit 1
else
    result=$?
fi
printf '%s\n' "$output"
[[ $result -eq 1 ]]
grep -Fxq 'FAIL offline-terminal' <<<"$output"
grep -Fxq 'PASS cleanup temporary containers and RAM work directory absent' <<<"$output"
printf 'PASS recovery acceptance tests\n'
