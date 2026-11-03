"""Balanced, isolated R30 measurements with exact output checks (Linux /proc RSS)."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import statistics
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True, type=Path)
parser.add_argument("--baseline", required=True, type=Path)
parser.add_argument("--runs", type=int, default=3)
parser.add_argument("--ids", default="")
args = parser.parse_args()
assert args.runs >= 1
root = Path(__file__).resolve().parents[1]
if args.output.exists() and any(args.output.iterdir()):
    parser.error("--output must be a fresh empty directory; prior evidence is not a new run")
args.output.mkdir(parents=True, exist_ok=True)
fixtures = args.output / "fixtures"
subprocess.run(["python3", "-B", str(root / 'tests/helpers/word-performance-fixtures.py'), str(fixtures)], check=True)
cases = json.loads((fixtures / "manifest.json").read_text())
if args.ids:
    wanted = set(args.ids.split(','))
    cases = [row for row in cases if row['id'] in wanted]
    assert {row['id'] for row in cases} == wanted
assert cases
results, expected = [], {}
for repeat in range(args.runs):
    for index, case in enumerate(cases):
        order = ['before', 'after'] if (repeat + index) % 2 == 0 else ['after', 'before']
        for variant in order:
            label = f"{repeat + 1}-{case['id']}-{variant}"
            output = args.output / (label + '.json')
            command = ['node', '--experimental-strip-types', 'scripts/benchmark-word-compare.mjs',
                       '--source=' + str(args.baseline if variant == 'before' else root / 'src/features/word-compare'),
                       '--before=' + case['before'], '--after=' + case['after'], '--output=' + str(output), '--trace=true',
                       '--label=' + label]
            if repeat == 0:
                command.append('--docx=' + str(args.output / (label + '.docx')))
            samples = []
            load = os.getloadavg()
            print('START', label, f'load={load[0]:.2f}', flush=True)
            with output.with_suffix('.log').open('w') as log:
                process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT)
                while process.poll() is None:
                    try:
                        values = dict(line.split(':', 1) for line in Path(f'/proc/{process.pid}/status').read_text().splitlines() if ':' in line)
                        samples.append([time.time() * 1000, int(values['VmRSS'].split()[0])])
                    except (FileNotFoundError, KeyError):
                        pass
                    time.sleep(.02)
            assert process.returncode == 0, f'{label}: see {output.with_suffix(".log")}'
            data = json.loads(output.read_text())
            assert data['inputHashes'] == case['sha256']
            assert data['calls']['extractAndEncode'] == 2 and data['extractions'] == 2
            assert data['calls']['generate'] == 1
            # Every run, including repeats of the same variant, must retain the same bytes.
            if case['id'] not in expected:
                expected[case['id']] = data['hashes']
            assert expected[case['id']] == data['hashes'], f"{label}: output/model/manifest mismatch"
            events = []
            for line in output.with_suffix('.log').read_text().splitlines():
                if line.startswith('{"phase":'):
                    events.append(json.loads(line))
            begin = next(e['at'] for e in events if e['phase'] == 'accept' and e['event'] == 'start')
            end = next(e['at'] for e in reversed(events) if e['phase'] == 'generate' and e['event'] == 'end')
            hot = [rss for when, rss in samples if data['timeOriginMs'] + begin <= when <= data['timeOriginMs'] + end]
            memory = {'observedProcessPeakKiB': max(rss for _, rss in samples), 'observedWorkPeakKiB': max(hot) if hot else None,
                      'intervalMs': 20, 'samples': len(samples)}
            output.with_suffix('.rss.json').write_text(json.dumps(samples))
            results.append({'case': case['id'], 'repeat': repeat, 'variant': variant, 'workerMs': data['workerMs'],
                            'coldTotalMs': data['coldTotalMs'], 'phasesMs': data['phasesMs'], 'memory': memory,
                            'wasmHeapBytes': data['memory']['wasmHeapBytes'], 'load1': load[0], 'output': str(output)})
            (args.output / 'results.json').write_text(json.dumps(results, indent=2))
            print('DONE', label, f"worker={data['workerMs']:.1f}ms", f"workRSS={memory['observedWorkPeakKiB']}KiB", flush=True)
summary = []
for case in cases:
    row = {'id': case['id'], 'kind': case['kind']}
    for variant in ['before', 'after']:
        samples = [r for r in results if r['case'] == case['id'] and r['variant'] == variant]
        row[variant] = {'workerMs': statistics.median(r['workerMs'] for r in samples),
                        'coldTotalMs': statistics.median(r['coldTotalMs'] for r in samples),
                        'generateMs': statistics.median(r['phasesMs']['generate'] for r in samples),
                        'extractMs': statistics.median(r['phasesMs']['extractAndEncode'] for r in samples),
                        'observedWorkPeakKiB': statistics.median(r['memory']['observedWorkPeakKiB'] for r in samples),
                        'wasmHeapBytes': statistics.median(r['wasmHeapBytes'] for r in samples)}
    row['ratio'] = row['after']['workerMs'] / row['before']['workerMs']
    summary.append(row)
report = {'schemaVersion': 1, 'originalCorpusUsed': False, 'runsPerCaseAndVariant': args.runs,
          'cases': summary, 'medianCaseRatio': statistics.median(r['ratio'] for r in summary),
          'maxCaseRatio': max(r['ratio'] for r in summary), 'outputIdentity': 'all-models-manifests-screen-and-package-entry-bytes-match',
          'measurements': len(results)}
(args.output / 'summary.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2), flush=True)
