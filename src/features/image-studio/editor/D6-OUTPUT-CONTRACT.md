# IE1 D6 output contract

D6 A/B selects **limits**, not an instruction to export every scene at 4096 or
8192 pixels. A uses input edge 4096 and crop/flatten area 4096²; B uses input edge
8192 and crop/flatten area 8192². The approved IE0b matrix distinguished working
scene, crop, artboard and flatten: an uncropped 1000×700 working scene remained
1000×700 under both policies. A source-photo-sized flatten target was an explicit
measurement input, not the library default (SOL-IE0B-REPORT §7; fixed fork 263b8cf).

IE1 intentionally keeps that full-working-scene output contract. The host reads
Fabric's **logical** canvas width/height (inline CSS dimensions, excluding retina
backing scaling), bounds the area with `flattenMaxPixels`, and explicitly passes
that `flattenTarget`. A smaller scene is not silently enlarged to the area cap.
An over-limit scene is reduced proportionally, with integer rounding bounded by
the same cap. This is exercised by policy unit tests and actual JSON/SVG/template
base dimensions in the library smoke.

Flattening includes the whole working scene, including margins and all layers.
It does not switch to a committed crop/artboard rectangle. The editing scene is
preserved and only a detached export copy is flattened. This matches PLAN §8.2
and the fixed fork's `flattenScene(target)` contract. Native raster/crop/artboard
exports retain their separate library sizing rules. A high-resolution imported
photo therefore does **not** imply that an uncropped working-scene export has the
photo's original dimensions or detail. The PNG result size fields resample the
raster commit; enlargement cannot restore lost detail.

Choosing source-photo pixel density for the entire scene (including margins), or
changing crop/artboard flatten scope, would be a different output contract. IE1
does not claim that policy merely by setting a maximum area.
