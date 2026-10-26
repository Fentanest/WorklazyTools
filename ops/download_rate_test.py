"""Offline whole-collector test for the combined rolling-minute quota."""
import contextlib
import datetime
import io
import json
from pathlib import Path
import tempfile
import types
import zipfile
import download as collector

clock = types.SimpleNamespace(seconds=0.0)
collector.time = types.SimpleNamespace(monotonic=lambda: clock.seconds,
    sleep=lambda amount: setattr(clock, 'seconds', clock.seconds + amount))
collector.stamp = lambda: (datetime.datetime(2026, 10, 4, tzinfo=datetime.timezone.utc)
                          + datetime.timedelta(seconds=clock.seconds)).isoformat()
collector.keys = lambda: {'DART_API_KEY1': 'a' * 40, 'DART_API_KEY2': 'b' * 40}
collector.signal = types.SimpleNamespace(SIGTERM=15, SIGINT=2, signal=lambda *args: None)
body = io.BytesIO()
with zipfile.ZipFile(body, 'w') as archive:
    archive.writestr('fixture.xml', '<DOCUMENT/>')
starts = []
class Session:
    def get(self, endpoint, params, timeout):
        starts.append(clock.seconds)
        return types.SimpleNamespace(status_code=200, content=body.getvalue())
collector.requests = types.SimpleNamespace(Session=Session, RequestException=RuntimeError)
with tempfile.TemporaryDirectory() as directory:
    collector.HERE = Path(directory)
    collector.REPO = Path(directory)
    (collector.HERE / 'manifest.json').write_text('{}')
    queue = [{'rcept_no': str(i), 'key_slot': 'DART_API_KEY1' if i % 2 else 'DART_API_KEY2'}
             for i in range(1700)]
    (collector.HERE / 'api-queue.jsonl').write_text(''.join(json.dumps(r) + '\n' for r in queue))
    import sys
    sys.argv = ['download.py', '--interval', '0.001', '--max-per-minute', '800',
                '--max-per-key', '1000', '--defer-parse']
    with contextlib.redirect_stdout(io.StringIO()):
        collector.main()
    peak = max(sum(0 <= current - previous < 60 for previous in starts[:i + 1])
               for i, current in enumerate(starts))
    assert peak <= 800, peak
    rows = collector.load(collector.HERE / 'api-requests.jsonl')
    assert len(rows) == 1700
    assert all(r['zip_received'] for r in rows)
    assert sum(r['key_slot'] == 'DART_API_KEY1' for r in rows) == 850
    assert sum(r['key_slot'] == 'DART_API_KEY2' for r in rows) == 850
    assert len(collector.load(collector.HERE / 'api-reservations.jsonl')) == 1700
    assert not (collector.HERE / 'corpus.jsonl').exists()
    print(json.dumps({'fake_gets': len(starts), 'max_combined_gets_in_rolling_minute': peak,
                      'network_calls': 0, 'keys_each': 850, 'saved_zips': len(rows)}))
