# PDF finish inventory repair independent audit — Codx Astra

PASS within the requested test-harness scope. No product or tracked file was edited. Own accessibility changes are excluded from this approval.

The new PDF_FINISH_DIST_DIR selects both asset inspection and the deployment execution inventory. With the variable absent it resolves to the original repository root/dist. startPreview passes this identical directory to Vite --outDir. TEST_BASE_URL callers still must select the corresponding archive; the checker continues to reject an actual mismatch.

Independent read-only reproduction: `node /tmp/worklazy-u4-user-bugs/dist-inventory-fix/independent-audit/check.mjs` exited 0. After substituting only the two directory expressions and removing the added provenance field, the complete assertLazyChunks function is byte-identical to HEAD. Every existing shared-runtime, lazy-chunk, JS/MJS and missing-request assertion is retained. The unrelated checkbox selector change predates this repair and is outside this audit approval.

The recorded full workflow runtime-final.json has 24 requests and 107 inventory paths, zero missing. Replaying all 24 actual requests through the current source function passed; its physical archive inventory exactly matched all 107 recorded paths. Replaying those same requests against root/dist rejected the actual QA editor filename mismatch. An added missing MJS request also rejected. result.json records the exact mismatch message.

Prior author evidence was reviewed, not rerun or presented as an independent browser run: probe.json records the local server4277 editor matching the QA archive SHA8339b8de82a1303cc8acce05d51e875024eb151a64bede8c9df68871a03ce6bd and differing from production; server-probe.log records a separately spawned archive preview byte match. smoke-final.log ends in the complete workflow success summary; the existing standardFontDataUrl warnings remain preserved. Initial integration/06-finish-smoke.log is preserved as the failed wrong-build inventory attempt.

No new missing validation or assertion relaxation found in this bounded change. This is path-membership inventory validation, not a new assertion of byte equality for every runtime request. No full suite, browser, server or build was started for this independent audit.

Start/end HEAD: 82fa9c9b9567f0bc2e80e9c65189a2b5be4945e0. Tracked git status is identical (existing dirty changes preserved). SHA-256 remained identical for all 2539 tracked src/scripts/tests files; snapshots start.json and end.json. No claim of repository cleanliness or deployment completion.
