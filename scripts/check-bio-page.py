"""Check that the static introduction's local assets and fragment links resolve."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.references = []
        self.errors = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        identifier = attrs.get('id')
        if identifier:
            if identifier in self.ids:
                self.errors.append(f'Duplicate element id: {identifier}')
            self.ids.add(identifier)
        attribute = 'src' if tag in ('script', 'img', 'source') else 'href' if tag in ('a', 'link') else None
        if attribute and attrs.get(attribute):
            self.references.append(attrs[attribute])


source = ROOT / 'medical-responsibility.html'
page = Page(source.read_text(encoding='utf-8'))
errors = page.errors.copy()
for reference in page.references:
    url = urlsplit(reference)
    if url.scheme or url.netloc:
        continue
    target = (source.parent / unquote(url.path)).resolve() if url.path else source
    if not target.is_relative_to(ROOT):
        errors.append(f'Local link escapes repository: {reference}')
    elif not target.is_file():
        errors.append(f'Missing local file: {reference}')
    elif url.fragment and target.suffix == '.html':
        destination = page if target == source else Page(target.read_text(encoding='utf-8'))
        if unquote(url.fragment) not in destination.ids:
            errors.append(f'Missing local anchor: {reference}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Validated {len(page.references)} asset/link references and {len(page.ids)} unique ids.')
