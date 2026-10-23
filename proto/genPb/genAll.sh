#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

FRAMEWORK_ROOT="../pb"
GAME_ROOT="../game"
PB_OUT="../../assets/pb"
TS_PROTO_PLUGIN="../../node_modules/.bin/protoc-gen-ts_proto"
POSTPROCESS="../tools/postprocess-ts-proto.js"

echo "Generating client pb files..."
mkdir -p "${PB_OUT}"

compile_layer() {
  local proto_root="$1"
  local layer="$2"
  local layer_dir="${proto_root}/${layer}"
  if [ ! -d "${layer_dir}" ] || ! compgen -G "${layer_dir}/*.proto" > /dev/null; then
    return 0
  fi
  echo "Compiling ${layer} proto files from ${proto_root}"
  protoc \
    --plugin=protoc-gen-ts_proto="${TS_PROTO_PLUGIN}" \
    --ts_proto_out="${PB_OUT}" \
    --proto_path="${FRAMEWORK_ROOT}" \
    --proto_path="${proto_root}" \
    "${layer_dir}"/*.proto
}

# 客户端生成 common、public，保留目录。internal 留给服务端，不输出到 assets/pb
compile_layer "${FRAMEWORK_ROOT}" common
compile_layer "${FRAMEWORK_ROOT}" public
compile_layer "${GAME_ROOT}" common
compile_layer "${GAME_ROOT}" public

node "${POSTPROCESS}"

echo "Done."
