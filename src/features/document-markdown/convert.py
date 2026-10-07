# Official Microsoft MarkItDown 0.1.8 converters; browser entry-point adapter.
# No Magika dispatcher, OCR, remote services, or LLM converter is used here.
import re
from markitdown import StreamInfo
from markitdown.converters import DocxConverter, XlsxConverter, XlsConverter, PptxConverter, PdfConverter

_CONVERTERS = {
    "docx": DocxConverter,
    "xlsx": XlsxConverter,
    "xls": XlsConverter,
    "pptx": PptxConverter,
    "pdf": PdfConverter,
}

def convert_document(extension):
    if extension not in _CONVERTERS:
        raise ValueError("UNSUPPORTED_FORMAT")
    with open("/tmp/input", "rb") as source:
        result = _CONVERTERS[extension]().convert(
            source, StreamInfo(extension="." + extension, filename="input." + extension)
        )
    # Same normalization as the official MarkItDown._convert dispatcher.
    content = "\n".join(line.rstrip() for line in re.split(r"\r?\n", result.text_content))
    content = re.sub(r"\n{3,}", "\n\n", content)
    if not content.strip():
        raise ValueError("NO_TEXT")
    return content

