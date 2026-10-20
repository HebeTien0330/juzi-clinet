#!/usr/bin/env python3
"""
Generate a file-name to Cocos resources path map for image and prefab assets under assets/resources.

Usage examples:
    python tools/genImagePathMap.py
    python tools/genImagePathMap.py --images-dir assets/resources/images --prefabs-dir assets/resources/prefabs --output assets/resources/json/resourcesMap.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".prefab"}


def normalize_path_for_cocos(path: Path) -> str:
    """Convert a relative file path into resources.load path format without extension."""
    without_suffix = path.with_suffix("")
    return str(without_suffix).replace("\\", "/")


def collect_resource_files(resource_dirs: List[Path]) -> List[Path]:
    files: List[Path] = []
    for resource_dir in resource_dirs:
        for file_path in resource_dir.rglob("*"):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            files.append(file_path)
    files.sort()
    return files


def build_maps(
    resource_files: List[Path],
    resource_dirs: List[Path],
    allow_duplicate_stem: bool,
) -> Dict[str, str]:
    by_stem: Dict[str, str] = {}

    duplicate_stem: Dict[str, List[str]] = {}

    for absolute_file in resource_files:
        root_dir = next(
            resource_dir
            for resource_dir in resource_dirs
            if absolute_file.is_relative_to(resource_dir)
        )
        rel = absolute_file.relative_to(root_dir)
        cocos_path = normalize_path_for_cocos(Path(root_dir.name) / rel)

        stem_key = absolute_file.stem

        if stem_key in by_stem and by_stem[stem_key] != cocos_path:
            duplicate_stem.setdefault(stem_key, [by_stem[stem_key]]).append(cocos_path)
        else:
            by_stem[stem_key] = cocos_path

    errors: List[str] = []
    if duplicate_stem and not allow_duplicate_stem:
        errors.append("Detected duplicate stem keys. Use --allow-duplicate-stem to keep the first occurrence.")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        if duplicate_stem:
            print("Duplicate stem details:", file=sys.stderr)
            print(json.dumps(duplicate_stem, ensure_ascii=False, indent=2), file=sys.stderr)
        raise SystemExit(2)

    return by_stem


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parent.parent
    default_images_dir = project_root / "assets" / "resources" / "images"
    default_prefabs_dir = project_root / "assets" / "resources" / "prefabs"
    default_output = project_root / "assets" / "resources" / "json" / "resourcesMap.json"

    parser = argparse.ArgumentParser(description="Generate resource path map for Cocos dynamic loading.")
    parser.add_argument("--images-dir", type=Path, default=default_images_dir, help="Image root directory to scan.")
    parser.add_argument("--prefabs-dir", type=Path, default=default_prefabs_dir, help="Prefab root directory to scan.")
    parser.add_argument("--output", type=Path, default=default_output, help="Output JSON file path.")
    parser.add_argument(
        "--allow-duplicate-stem",
        action="store_true",
        help="Allow duplicate stem keys and keep first occurrence.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    images_dir = args.images_dir.resolve()
    prefabs_dir = args.prefabs_dir.resolve()
    output_file = args.output.resolve()

    missing_dirs: List[Path] = []
    for resource_dir in [images_dir, prefabs_dir]:
        if not resource_dir.exists() or not resource_dir.is_dir():
            missing_dirs.append(resource_dir)

    if missing_dirs:
        for missing_dir in missing_dirs:
            print(f"resource dir not found: {missing_dir}", file=sys.stderr)
        raise SystemExit(1)

    resource_files = collect_resource_files([images_dir, prefabs_dir])
    result = build_maps(
        resource_files=resource_files,
        resource_dirs=[images_dir, prefabs_dir],
        allow_duplicate_stem=args.allow_duplicate_stem,
    )

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Generated: {output_file}")
    print(f"Image count: {len(result)}")


if __name__ == "__main__":
    main()
