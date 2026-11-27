Jarvon cartoon GLB handoff — TRANSPORT ONLY (branch jarvon-assets-handoff-20261127).

The GitHub push path available here accepts UTF-8 text only, so the two GLB
binaries are carried as base64 text files. Decode them, then verify SHA-256
against the recorded November 14 values before any other step:

  base64 -d jarvon-cartoon.glb.b64 > jarvon-cartoon.glb
  base64 -d jarvon-spawn-ring.glb.b64 > jarvon-spawn-ring.glb
  sha256sum jarvon-cartoon.glb jarvon-spawn-ring.glb

Expected:
  jarvon-cartoon.glb      224,260 B  8e31902ca91bbc3ccecdcb70ad5710dba97788f0b91e414bb8877b15ed526e9e
  jarvon-spawn-ring.glb    15,620 B  709c752fba69b3b6fd112d1e25890c85cab88be2c530fcd8d09a06675b9b9711

If either hash differs, STOP — do not place, register, or wire anything.

The decoded .glb files (not the .b64 files) go in public/models/ per the
handover issue. This branch holds transport only; Codex's implementation lands
on a separate branch as a draft PR.
