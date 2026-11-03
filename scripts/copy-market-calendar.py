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
SOURCES = 'sources-v1.json'
SOURCES_SHA = 'sources-v1.sha256'
SOURCES_LIMIT = 512 * 1024


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



def optional_sources(source: Path, generation: str) -> dict[str, bytes]:
    if not (source / SOURCES).exists() and not (source / SOURCES_SHA).exists():
        return {}
    try:
        raw = (source / SOURCES).read_bytes()
        checksum = (source / SOURCES_SHA).read_text().strip()
        if len(raw) > SOURCES_LIMIT or len(checksum) != 64 or hashlib.sha256(raw).hexdigest() != checksum:
            raise ValueError('Source excerpts hash mismatch')
        value = json.loads(raw)
        if value.get('schema_version') != 1 or value.get('generation_id') != generation or not isinstance(value.get('sources'), list):
            raise ValueError('Source excerpts generation mismatch')
        return {SOURCES: raw, SOURCES_SHA: (checksum + '\n').encode()}
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        print(f'::warning::Optional KRX excerpts hidden: {type(error).__name__}', file=sys.stderr)
        return {}


def copy_calendar(source: Path, target: Path) -> None:
    manifest_bytes = (source / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    payloads = {}
    for name, entry in zip(file_names(manifest), manifest['files']):
        payload = (source / name).read_bytes()
        if hashlib.sha256(payload).hexdigest() != entry['sha256']:
            raise ValueError('Calendar hash mismatch')
        payloads[name] = payload
    payloads.update(optional_sources(source, manifest.get('generation_id')))
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
            # Old deployments may have no optional pair; retain their verified calendar.
            try:
                checksum = download(SOURCES_SHA, 128)
                excerpts = download(SOURCES, SOURCES_LIMIT)
                (stage / SOURCES_SHA).write_bytes(checksum)
                (stage / SOURCES).write_bytes(excerpts)
            except (OSError, ValueError, HTTPException):
                pass
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
