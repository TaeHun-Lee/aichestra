#!/usr/bin/env sh
set -eu

cargo test -p aich-cli command_adapter_cli_e2e_parallel_tmp_md_sessions_are_sequentially_verified
