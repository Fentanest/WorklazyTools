"""Copy a published calendar only after every manifest file passes SHA-256."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile


def copy_calendar(source: Path, target: Path) -> None:
    manifest_bytes = (source / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest['schema_version'] != 1 or not manifest['files']:
        raise ValueError('Unsupported manifest')
    payloads = {}
    for entry in manifest['files']:
        name = f"calendar-{entry['year']}.json"
        if entry['path'] != name or name in payloads:
            raise ValueError('Invalid calendar path')
        payload = (source / name).read_bytes()
        if hashlib.sha256(payload).hexdigest() != entry['sha256']:
            raise ValueError('Calendar hash mismatch')
        payloads[name] = payload
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as temporary:
        stage = Path(temporary) / 'v1'
        stage.mkdir()
        for name, payload in payloads.items():
            (stage / name).write_bytes(payload)
        (stage / 'manifest.json').write_bytes(manifest_bytes)
        if target.exists():
            shutil.rmtree(target)
        stage.rename(target)


if __name__ == '__main__':
    copy_calendar(Path(sys.argv[1]), Path(sys.argv[2]))
