# Fixture sources

`photo.png` and `screen.png` are deterministic synthetic fixtures created for this
prototype. Their names do not mean that a real photograph or screen was captured.
The original six definitions and hashes were committed in `9ca2f30` before evaluation.

The additional manifest `scenes-supplement.json` was committed in `9cd2470` before
its evaluation, with actual-photo and captured-screen inputs. It does not replace
or change the original manifest or acceptance criteria.

`real-photo.png`: resized NASA astronaut Eileen Collins image with a white test
label, from scikit-image v0.19.3:
https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/astronaut.png

The project's source describes this image as released into the public domain with
no known copyright restrictions:
https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/_fetchers.py#L405

`captured-screen.png`: Chromium capture of this fork's local test host at 640×480,
with the same synthetic test label. No user data or external service is pictured.
