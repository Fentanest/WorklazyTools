"""Copy a published calendar only after every manifest file passes SHA-256."""
import hashlib
from http.client import HTTPException
import json
from pathlib import Path
import shutil
import sys
import tempfile
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

PUBLISHED_URL = 'https://worklazy.net/data/market-calendar/v1/'


def file_names(manifest: dict) -> list[str]:
    if manifest['schema_version'] != 1 or not manifest['files']:
        raise ValueError('Unsupported manifest')
    names = []
    for entry in manifest['files']:
        year = entry['year']
        name = f'calendar-{year}.json'
        if type(year) is not int or not 2000 <= year <= 9999 or entry['path'] != name or name in names:
            raise ValueError('Invalid calendar path')
        names.append(name)
    return names


def copy_calendar(source: Path, target: Path) -> None:
    manifest_bytes = (source / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    payloads = {}
    for name, entry in zip(file_names(manifest), manifest['files']):
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


def download(name: str, limit: int) -> bytes:
    request = Request(PUBLISHED_URL + name, headers={'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=30) as response:
        resolved = urlsplit(response.geturl())
        if resolved.scheme != 'https' or resolved.hostname != 'worklazy.net':
            raise ValueError('Published calendar redirected away from worklazy.net')
        payload = response.read(limit + 1)
    if len(payload) > limit:
        raise ValueError('Published calendar exceeds the size limit')
    return payload


def prepare_calendar(source: Path, target: Path) -> str:
    """A failed checkout/copy must retain the deployed publication, not the data branch."""
    try:
        copy_calendar(source, target)
        return 'copied'
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'::warning::Market calendar copy failed: {error}; restoring deployed copy.', file=sys.stderr)
    try:
        # Stage the entire deployed publication before touching the new dist.
        with tempfile.TemporaryDirectory() as temporary:
            stage = Path(temporary)
            manifest = download('manifest.json', 262_144)
            (stage / 'manifest.json').write_bytes(manifest)
            for name in file_names(json.loads(manifest)):
                (stage / name).write_bytes(download(name, 20_000_000))
            copy_calendar(stage, target)
        return 'restored-published'
    except (OSError, ValueError, KeyError, TypeError, HTTPException) as error:
        print(f'::warning::Published market calendar unavailable: {error}; calendar has no new data.', file=sys.stderr)
        return 'unavailable'


if __name__ == '__main__':
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    if '--fallback-published' in sys.argv[3:]:
        print(json.dumps({'market_calendar': prepare_calendar(source, target)}))
    else:
        copy_calendar(source, target)
