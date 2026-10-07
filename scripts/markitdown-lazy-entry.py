# Worklazy browser adapter: retain the official converter implementations.
# Importing MarkItDown itself still uses the original dispatcher and dependencies.
def __getattr__(name):
    if name in {"MarkItDown", "PRIORITY_SPECIFIC_FILE_FORMAT", "PRIORITY_GENERIC_FILE_FORMAT"}:
        from . import _markitdown
        return getattr(_markitdown, name)
    raise AttributeError(name)
