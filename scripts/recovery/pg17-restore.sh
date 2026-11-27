#!/usr/bin/env bash
set +ax
set -Eeuo pipefail
umask 077
ulimit -c 0

readonly stock_image='docker.io/library/postgres:17.11-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994'
image=$stock_image
supabase_id=
profile=
socket="/run/user/$(id -u)/docker.sock"
[[ -S $socket ]] || socket=/var/run/docker.sock
readonly daemon="unix://$socket"
readonly mount_dir='/var/lib/postgresql/data'
readonly ram="$mount_dir/recovery"
readonly root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
stage=arguments
scratch=
label=
container=
containers_possible=0
started=$SECONDS
unset key

fail() {
    printf 'FAIL %s\n' "$stage" >&2
    # These logs contain only checked-in fixture data. Offline runs emit stage names.
    if [[ ${mode:-} == synthetic && -n $container ]]; then
        case "$stage" in
            restore-*) in_container tail -n 12 "$ram/restore.log" >&2 || true ;;
            synthetic-source|profile-*|restored-checks)
                in_container tail -n 12 "$ram/sql.log" >&2 || true ;;
            synthetic-catalog) tail -n 12 "$scratch/catalog.log" >&2 || true ;;
            postgres-start) in_container tail -n 12 "$ram/postgres.log" >&2 || true ;;
        esac
    fi
    exit 1
}

dkr() {
    env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
        docker --config "$scratch/docker" --host "$daemon" "$@"
}

remove_containers() {
    local ids id
    ids=$(dkr ps -aq --filter "label=io.sharkania.recovery=$label") || return 1
    for id in $ids; do
        dkr rm -fv "$id" >/dev/null 2>&1 || true
    done
    ids=$(dkr ps -aq --filter "label=io.sharkania.recovery=$label") || return 1
    [[ -z $ids ]] || return 1
    container=
}

cleanup() {
    local status=$? clean=0
    trap - EXIT ERR
    trap '' HUP INT TERM
    if [[ -n $scratch ]]; then
        if (( containers_possible )); then
            remove_containers || clean=1
        fi
        if [[ -d $scratch/gpg ]]; then
            gpgconf --homedir "$scratch/gpg" --kill gpg-agent >/dev/null 2>&1 || clean=1
        fi
        rm -rf -- "$scratch" || clean=1
        [[ ! -e $scratch ]] || clean=1
        if (( clean == 0 )); then
            printf 'PASS cleanup temporary containers and RAM work directory absent\n'
        else
            printf 'FAIL cleanup\n' >&2
            status=1
        fi
    fi
    printf 'RESULT mode=%s exit=%d elapsed_seconds=%d\n' "${mode:-unknown}" "$status" "$((SECONDS - started))"
    exit "$status"
}

check_offline_host() {
    local upper docker_root archive_device
    stage=offline-terminal
    [[ -z ${CI:-} && -t 0 && -t 2 ]] || fail
    stage=offline-live-boot
    grep -Eq '(^| )boot=(casper|live)( |$)' /proc/cmdline || fail
    grep -Eq '(^| )nohibernate( |$)' /proc/cmdline || fail
    [[ $(findmnt -n -o FSTYPE --target /) == overlay ]] || fail
    upper=$(findmnt -n -o FS-OPTIONS --target / | tr ',' '\n' | sed -n 's/^upperdir=//p')
    [[ -n $upper && $(findmnt -n -o FSTYPE --target "$upper") == tmpfs ]] || fail
    [[ $(cat /proc/sys/kernel/core_pattern) != \|* ]] || fail
    stage=offline-network
    [[ $(ip -o link show up | awk -F': ' '{print $2}') == lo ]] || fail
    stage=offline-block-storage
    findmnt -rn -o SOURCE,OPTIONS | awk '
        /^\/dev\// && $2 ~ /(^|,)rw(,|$)/ { writable=1 }
        END { exit writable }
    '
    if [[ $mode == offline ]]; then
        findmnt -n -o OPTIONS --target "$archive" | grep -Eq '(^|,)ro(,|$)' || fail
        archive_device=$(findmnt -n -o SOURCE --target "$archive")
        archive_device=${archive_device%%\[*}
        [[ -b $archive_device && $(lsblk -dnro RO "$archive_device") == 1 ]] || fail
    fi
    stage=offline-docker-storage
    docker_root=$(dkr info --format '{{.DockerRootDir}}')
    [[ -n $docker_root && $(findmnt -n -o FSTYPE --target "$docker_root") == tmpfs ]] || fail
    [[ $(dkr info --format '{{json .SecurityOptions}}') == *name=rootless* ]] || fail
    printf 'PASS offline-host preflight\n'
}

in_container() {
    dkr exec -i "$container" env -i \
        PATH=/nix/var/nix/profiles/default/bin:/usr/lib/postgresql/bin:/usr/lib/postgresql/17/bin:/usr/local/bin:/usr/bin:/bin LC_ALL=C \
        PGHOST="$ram/socket" PGUSER=postgres PGDATABASE=postgres "$@"
}

start_container() {
    stage=container-create
    containers_possible=1
    container=$(dkr run --detach --rm --pull=never --label "io.sharkania.recovery=$label" \
        --network=none --read-only --cap-drop=ALL --security-opt=no-new-privileges \
        --log-driver=none --ulimit core=0:0 --pids-limit=100 --user=postgres \
        --mount "type=tmpfs,dst=$mount_dir,tmpfs-size=1073741824,tmpfs-mode=1777" \
        --entrypoint=/bin/sleep "$image" 1800)
    stage=container-isolation
    [[ $(dkr inspect --format '{{.HostConfig.NetworkMode}}|{{.HostConfig.ReadonlyRootfs}}|{{.HostConfig.Privileged}}|{{len .HostConfig.PortBindings}}|{{.HostConfig.LogConfig.Type}}' "$container") == 'none|true|false|0|none' ]] || fail
    [[ $(dkr inspect --format '{{range .Mounts}}{{.Type}}:{{.Destination}}{{end}}' "$container") == "tmpfs:$mount_dir" ]] || fail
    in_container sh -eu -s -- "$mount_dir" "$ram" <<'SH'
mount_dir=$1
ram=$2
test "$(ls -1 /sys/class/net)" = lo
test -z "$(tail -n +2 /proc/net/route)"
test -z "$(tail -n +2 /proc/swaps)"
test "$(stat -f -c %T "$mount_dir")" = tmpfs
test "$(id -u)" -ne 0
test ! -e /var/run/docker.sock
mkdir -m 700 "$ram" "$ram/socket"
SH
    printf 'PASS isolation loopback only, no IPv4 routes, read-only root, tmpfs only, no swap\n'

    stage=postgres-start
    in_container sh -eu -s -- "$ram" <<'SH'
ram=$1
cd "$ram"
initdb --no-sync --encoding=UTF8 --locale=C --auth-local=trust --auth-host=reject -D db > postgres.log 2>&1
pg_ctl -D db -l postgres.log -w -t 30 start \
    -o "-c listen_addresses='' -c unix_socket_directories=$ram/socket -c shared_preload_libraries='' -c max_worker_processes=0 -c max_parallel_workers=0 -c max_logical_replication_workers=0 -c log_statement=none" \
    >> postgres-start.log 2>&1
SH
    assert_local_postgres
}

assert_local_postgres() {
    stage=postgres-local-socket
    local actual
    actual=$(in_container psql -XAtw -v ON_ERROR_STOP=1 -c "
        SELECT current_setting('server_version_num')::int = 170011
           AND inet_server_addr() IS NULL AND inet_client_addr() IS NULL
           AND current_setting('listen_addresses') = ''
           AND current_setting('shared_preload_libraries') = ''
           AND current_setting('max_worker_processes') = '0'
           AND NOT EXISTS (SELECT FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net'));
    " 2>"$scratch/client.log")
    [[ $actual == t ]] || fail
    printf 'PASS postgres-local-socket PostgreSQL 17.11, TCP, workers and cron/net inactive\n'
}

verify_extension_versions() {
    local required=$profile/extensions.tsv line extension
    stage=extension-versions
    in_container psql -XAtw -v ON_ERROR_STOP=1 -F $'\t' \
        -c 'SELECT name, version FROM pg_available_extension_versions' \
        >"$scratch/extensions.tsv" 2>"$scratch/client.log"
    if [[ -n $supabase_id ]]; then
        for extension in pg_cron pg_net supabase_vault vector; do
            grep -q "^$extension"$'\t' "$scratch/extensions.tsv" || fail
        done
        printf 'PASS Supabase packages pg_cron, pg_net, supabase_vault and vector available\n'
    fi
    [[ -n $profile ]] || return 0
    [[ -s $required ]] || fail
    while IFS= read -r line || [[ -n $line ]]; do
        [[ $line =~ ^[a-zA-Z0-9_-]+$'\t'[a-zA-Z0-9_.+-]+$ ]] || fail
        grep -Fxq -- "$line" "$scratch/extensions.tsv" || fail
    done <"$required"
    printf 'PASS extension-versions requested versions available\n'
}

apply_sql() {
    in_container sh -eu -c '
        exec psql -Xqw -v ON_ERROR_STOP=1 --single-transaction --file=- >"$1/sql.log" 2>&1
    ' sh "$ram" <"$1"
}

gpg_ram() {
    env -i PATH=/usr/bin:/bin LC_ALL=C gpg --homedir "$scratch/gpg" \
        --no-options --batch --pinentry-mode loopback --no-symkey-cache \
        --passphrase-fd 3 "$@" 2>"$scratch/gpg.log"
}

restore_section() {
    stage="restore-$1"
    in_container sh -eu -c '
        exec pg_restore --exit-on-error --single-transaction --no-password \
            --dbname=postgres --use-list="$1/objects.toc" --section="$2" \
            "$1/archive.dump" >"$1/restore.log" 2>&1
    ' sh "$ram" "$1"
    printf 'PASS %s\n' "$stage"
}

if [[ ${1:-} == --supabase-image-id ]]; then
    [[ ${2:-} =~ ^sha256:[0-9a-f]{64}$ ]] || fail
    supabase_id=$2
    shift 2
fi
mode=${1:-}
case "$mode" in
    image)
        [[ $# -eq 1 && -z $supabase_id ]] || fail
        printf '%s\n' "$stock_image"
        exit 0
        ;;
    load-supabase)
        [[ $# -eq 4 && -z $supabase_id && $3 =~ ^[0-9A-Fa-f]{64}$ && $4 =~ ^sha256:[0-9a-f]{64}$ && -f $2 && -r $2 ]] || fail
        archive=$2
        expected=${3,,}
        supabase_id=$4
        ;;
    preflight)
        [[ $# -le 2 ]] || fail
        profile=${2:-}
        ;;
    synthetic)
        [[ $# -eq 1 || ( $# -eq 2 && $2 == --wrong-key ) ]] || fail
        profile="$root/tests/fixtures/pg17-isolated-restore"
        ;;
    offline)
        [[ $# -eq 4 && $3 =~ ^[0-9A-Fa-f]{64}$ && -f $2 && -r $2 ]] || fail
        archive=$2
        expected=${3,,}
        profile=$4
        ;;
    *)
        printf 'Usage: %s [--supabase-image-id ID] {image|load-supabase TAR TAR_SHA256 ID|preflight [PROFILE]|synthetic [--wrong-key]|offline ARCHIVE SHA256 PROFILE}\n' "${0##*/}" >&2
        fail
        ;;
esac

stage=host-preflight
[[ $(stat -f -c %T /dev/shm) == tmpfs && -z $(tail -n +2 /proc/swaps) ]] || fail
if [[ $mode == synthetic || $mode == offline ]]; then
    stage=profile
    for sql in pre-data after-data verify; do
        [[ -f $profile/$sql.sql && -r $profile/$sql.sql ]] || fail
    done
fi
trap cleanup EXIT
trap fail ERR
trap 'exit 130' INT
trap 'exit 143' HUP TERM
stage=ram-workspace
scratch=$(mktemp -d /dev/shm/sharkania-recovery.XXXXXXXX)
label=${scratch##*/}
mkdir -m 700 "$scratch/gpg" "$scratch/docker"

if [[ $mode == preflight || $mode == offline ]]; then
    check_offline_host
    stage=supabase-image-required
    [[ -n $supabase_id ]] || fail
fi
if [[ $mode == load-supabase ]]; then
    stage=image-archive-integrity
    actual=$(sha256sum <"$archive")
    [[ ${actual%% *} == "$expected" ]] || fail
    stage=image-load
    dkr image load --input "$archive" >"$scratch/docker-load.log" 2>&1
    stage=image-load-identity
    matched=0
    while IFS= read -r loaded; do
        if [[ $(dkr image inspect --format '{{.Id}}' "$loaded" 2>/dev/null) == "$supabase_id" ]]; then
            matched=1
        fi
    done < <(sed -n -e 's/^Loaded image: //p' -e 's/^Loaded image ID: //p' "$scratch/docker-load.log")
    (( matched )) || fail
fi
stage=local-image-identity
if [[ -n $supabase_id ]]; then
    [[ $(dkr image inspect --format '{{.Id}}|{{.Os}}' "$supabase_id" 2>"$scratch/client.log") == "$supabase_id|linux" ]] || fail
    image=$supabase_id
else
    dkr image inspect "$image" >/dev/null 2>&1
fi
if [[ $mode == load-supabase ]]; then
    printf 'PASS image-load archive SHA-256 and local Linux image ID verified\n'
    exit 0
fi
if [[ $mode == preflight ]]; then
    start_container
    verify_extension_versions
    printf 'PASS preflight offline runner ready for a reviewed profile\n'
    exit 0
fi

if [[ $mode == synthetic ]]; then
    start_container
    stage=synthetic-source
    apply_sql "$profile/pre-data.sql"
    apply_sql "$profile/source.sql"
    archive="$scratch/source.dump.gpg"
    key=$(cat /proc/sys/kernel/random/uuid)
    in_container pg_dump --no-password --format=custom --schema=public 2>"$scratch/client.log" |
        gpg_ram --symmetric --cipher-algo AES256 --output "$archive" 3< <(printf '%s\n' "$key")
    expected=$(sha256sum <"$archive")
    expected=${expected%% *}
    stage=synthetic-source-cleanup
    remove_containers
    printf 'PASS synthetic-source encrypted stream and source removed\n'
fi

stage=archive-integrity
actual=$(sha256sum <"$archive")
[[ ${actual%% *} == "$expected" ]] || fail
printf 'PASS archive-integrity SHA-256\n'
start_container
verify_extension_versions
if [[ $mode == offline ]]; then
    stage=offline-passphrase
    read -rs -p 'GPG passphrase: ' key
    printf '\n' >&2
elif [[ ${2:-} == --wrong-key ]]; then
    key="wrong-$key"
fi
stage=authenticated-decryption
# pipefail prevents any archive inspection or SQL if GPG rejects even a partial stream.
if ! gpg_ram --decrypt -- "$archive" 3< <(printf '%s\n' "$key") |
    in_container sh -eu -c 'cat >"$1/archive.dump"' sh "$ram"; then
    unset key
    fail
fi
unset key
printf 'PASS authenticated-decryption archive held in container RAM\n'

stage=archive-catalog
in_container sh -eu -s -- "$ram" <<'SH'
cd "$1"
pg_restore --list archive.dump > archive.toc 2> restore.log
awk '
    $4 == "SCHEMA" && $5 == "-" && $6 == "public" { print > "public.toc"; count++; next }
    { print > "objects.toc" }
    END { if (count != 1) exit 1 }
' archive.toc
SH
stage=profile-pre-data
apply_sql "$profile/pre-data.sql"
assert_local_postgres
stage=restore-public-schema
in_container sh -eu -s -- "$ram" <<'SH'
cd "$1"
exec > restore.log 2>&1
psql -Xqw -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public'
pg_restore --exit-on-error --single-transaction --no-password --dbname=postgres \
    --use-list=public.toc archive.dump
# pg_dump records ACL differences from the initial public schema privileges.
psql -Xqw -v ON_ERROR_STOP=1 -c 'GRANT USAGE ON SCHEMA public TO PUBLIC'
SH
restore_section pre-data
restore_section data
stage=profile-after-data
apply_sql "$profile/after-data.sql"
restore_section post-data
assert_local_postgres
stage=restored-checks
apply_sql "$profile/verify.sql"
printf 'PASS restored-checks mode=%s\n' "$mode"
if [[ $mode == synthetic ]]; then
    stage=synthetic-catalog
    in_container psql -XqAtw -v ON_ERROR_STOP=1 --file=- <"$root/scripts/recovery/catalog.sql" \
        >"$scratch/catalog.json" 2>"$scratch/catalog.log"
    python3 - "$scratch/catalog.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as report:
    catalog = json.load(report)

assert catalog["totals"] == {
    "tables": 1, "views": 1, "indexes": 3, "routines": 1, "constraints": 4,
    "foreign_keys_to_auth": 1, "extensions": 2,
}
fk, = catalog["foreign_keys_to_auth"]
assert fk["source_table"] == "restore_records" and fk["auth_table"] == "users"
assert fk["columns"] == [{"source": "user_id", "target": "id", "type": "uuid"}]
assert any(item["extension"] == "pgcrypto" for item in catalog["dependencies_outside_public"])
assert any(item["grantee"] == "authenticated" for item in catalog["default_acl"])
PY
    printf 'PASS synthetic-catalog inventory and Auth FK mapping\n'
fi
