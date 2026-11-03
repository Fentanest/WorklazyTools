"""Deterministic D02 differential cases ported from the pre-implementation prototype."""
import ast
import copy
import hashlib
import itertools
import random
import time

REFERENCE_BALANCE_SOURCE = ast.get_source_segment(reference_source, next(n for n in ast.parse(reference_source).body if isinstance(n, ast.FunctionDef) and n.name == 'reference_balance'))
PRODUCTION_BALANCE_SOURCE = ast.get_source_segment(tracked_source, next(n for n in ast.parse(tracked_source).body if isinstance(n, ast.FunctionDef) and n.name == '_balance_blank_paragraphs'))

def check_index_and_groups():
    rng = random.Random(20261104)
    digest = hashlib.sha256()
    counts = {'exhaustive_pairs': 0, 'random_pairs': 0, 'boundaries': 0, 'full_balance': 0}
    def check(a, b, category):
        expected = reference_pairs(a, b)
        for name, candidate in [('linear', _blank_lcs_pairs)]:
            actual = candidate(a, b)
            assert actual == expected, (name, a, b, expected, actual)
        digest.update(repr((a, b, expected)).encode())
        counts[category] += 1
    sequences = [list(values) for size in range(7) for values in itertools.product(range(2), repeat=size)]
    for a in sequences:
        for b in sequences:
            check(a, b, 'exhaustive_pairs')
    for _ in range(12000):
        n, m, alphabet = rng.randrange(81), rng.randrange(81), rng.randrange(1, 10)
        a, b = [rng.randrange(alphabet) for _ in range(n)], [rng.randrange(alphabet) for _ in range(m)]
        check(a, b, 'random_pairs')
    for a, b in [([], []), ([0] * 2000, []), ([], [0] * 2000), ([0] * 513, [0] * 257), ([0, 1] * 200, [1, 0] * 200), (list(range(500)), list(range(499, -1, -1))), ([0] * 500, [1] * 500), ([0] * 1000 + [1], [1] + [0] * 1000)]:
        check(a, b, 'boundaries')
    namespace = {'bisect': bisect, '_blank_signature': lambda value: value}
    exec(REFERENCE_BALANCE_SOURCE, namespace)
    production = namespace['reference_balance']
    candidate_namespace = {'bisect': bisect, '_blank_signature': lambda value: value, '_blank_lcs_pairs': _blank_lcs_pairs}
    exec(PRODUCTION_BALANCE_SOURCE, candidate_namespace)
    candidates = [candidate_namespace['_balance_blank_paragraphs']]
    # The old wrapper is frozen; only the candidate reads production source. Synthetic signatures isolate grouping,
    # covered indexes, anchors, shuffled new entries and entire result mutation.
    for _ in range(3000):
        before = [rng.choice([None, (), (('tab',),), (('t', ' '),), (('section', 'S1'),)]) for _ in range(rng.randrange(45))]
        after = [rng.choice([None, (), (('tab',),), (('t', ' '),), (('section', 'S1'),)]) for _ in range(rng.randrange(45))]
        aidx = sorted(rng.sample(range(len(before)), min(len(before), len(after), rng.randrange(7))))
        bidx = sorted(rng.sample(range(len(after)), len(aidx)))
        if rng.random() < .2:
            rng.shuffle(bidx)  # moved/reordered visible anchors, same original wrapper
        result = [([i], [j], {'id': f'anchor-{i}'}) for i, j in zip(aidx, bidx)]
        result += [([], [j], {'untracked': True}) for j in range(len(after)) if j not in bidx]
        rng.shuffle(result)
        expected = copy.deepcopy(result)
        production(before, after, expected)
        for candidate in candidates:
            actual = copy.deepcopy(result)
            candidate(before, after, actual)
            assert actual == expected, (before, after, result, expected, actual)
        digest.update(repr((before, after, expected)).encode())
        counts['full_balance'] += 1
    return {'seed': 20261104, 'counts': counts, 'mismatches': 0, 'results_sha256': digest.hexdigest()}

def check_xml():
    ns = globals()
    W=ns['W']
    rng=random.Random(11042026)
    hashes=hashlib.sha256()
    templates=['<w:p/>','<w:p><w:r><w:rPr/></w:r></w:p>',
     '<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>',
     '<w:p><w:r><w:t xml:space="preserve">  </w:t></w:r></w:p>',
     '<w:p><w:r><w:tab/></w:r></w:p>',
     '<w:p><w:r><w:br/></w:r></w:p>',
     '<w:p><w:r><w:br w:type="page"/></w:r></w:p>',
     '<w:p><w:r><w:br w:clear="all"/></w:r></w:p>',
     '<w:p><w:r><w:cr/></w:r></w:p>',
     '<w:p><w:pPr><w:rPr><w:del/></w:rPr></w:pPr></w:p>',
     '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r></w:p>',
     '<w:tbl/>', '<w:p><w:r><w:t>Visible</w:t></w:r></w:p>',
     '<w:p><w:bookmarkStart w:id="1" w:name="a"/><w:bookmarkEnd w:id="1"/></w:p>',
     '<w:p><w:pPr><w:sectPr/></w:pPr></w:p>']
    hist={}
    for case in range(3000):
        ns['_MANIFEST_NODE_KEYS']={}
        ns['_MANIFEST']={'storyProjection':{'sections':[]}}
        def make(side):
            nodes=[]
            for i in range(rng.randrange(40)):
                kind=rng.randrange(len(templates))
                hist[kind]=hist.get(kind,0)+1
                node=ET.fromstring(templates[kind].replace('<w:',f'<w:',1).replace('>',f' xmlns:w="{ns["WORD_NS"]}">',1) if not templates[kind].startswith('<w:p/>') and not templates[kind].startswith('<w:tbl/>') else templates[kind].replace('/>',f' xmlns:w="{ns["WORD_NS"]}"/>',1))
                if kind==14 and rng.random()<.7:
                    ref={'part':'word/document.xml','path':[0,i]}
                    ns['_MANIFEST_NODE_KEYS'][node.find(W+'pPr/'+W+'sectPr')]=(side,ns['_manifest_key'](ref))
                    ns['_MANIFEST']['storyProjection']['sections'].append({'blankOwner':True,'id':'section:blank:'+str(i%3),side:{'source':ref}})
                nodes.append(node)
            return nodes
        before,after=make('before'),make('after')
        count=min(len(before),len(after),rng.randrange(6))
        ai=sorted(rng.sample(range(len(before)),count));bi=sorted(rng.sample(range(len(after)),count))
        if rng.random()<.2:rng.shuffle(bi)
        result=[([a],[b],{'id':str(a)}) for a,b in zip(ai,bi)]
        result += [([],[j],{'untracked':True}) for j in range(len(after)) if j not in bi]
        rng.shuffle(result)
        expected=copy.deepcopy(result);reference_balance(before,after,expected)
        for candidate in [_balance_blank_paragraphs]:
            actual=copy.deepcopy(result);candidate(before,after,actual)
            assert actual==expected,(case,expected,actual)
        hashes.update(repr(expected).encode())
    return {'cases':3000,'mismatches':0,'seed':11042026,'xml_kind_counts':hist,'results_sha256':hashes.hexdigest()}


def check_docx():
    global _balance_blank_paragraphs
    production_balance = _balance_blank_paragraphs
    rng=random.Random(42022026)
    blank_xml=['<w:p/>','<w:p><w:r><w:tab/></w:r></w:p>','<w:p><w:r><w:br w:type="page"/></w:r></w:p>','<w:p><w:r><w:cr/></w:r></w:p>','<w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>','<w:p><w:r><w:t xml:space="preserve">  </w:t></w:r></w:p>','<w:p><w:pPr><w:jc w:val="left"/></w:pPr></w:p>','<w:p><w:pPr><w:jc w:val="right"/></w:pPr></w:p>']
    def para(text):return '<w:p><w:r><w:t>'+text+'</w:t></w:r></w:p>'
    def package(path,body):
        with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
            z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
            z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+body+'<w:sectPr/></w:body></w:document>')
    def contents(path):
        with zipfile.ZipFile(path) as z:
            return {name:re.sub(rb'w:date="[^"]*"',b'w:date="FIXED"',z.read(name)) if name.endswith('.xml') else z.read(name) for name in z.namelist()}
    from js import worklazyWireManifestJson
    digest=hashlib.sha256();start=time.perf_counter();exports=0
    for case in range(240):
        def body(side):
            blocks=[]
            for group in range(3):
                blocks.extend(rng.choice(blank_xml) for _ in range(rng.randrange(15)))
                blocks.append(para('Anchor '+str(group)+(' changed' if side and group==1 and case%3==0 else '')))
            blocks.extend(rng.choice(blank_xml) for _ in range(rng.randrange(8)))
            return ''.join(blocks)
        package('/before.docx',body(False));package('/after.docx',body(True))
        a=extract_document_model(open('/before.docx','rb').read(),True,True,'en')
        b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
        formatting=bool(case%2)
        wire=worklazyWireManifestJson(a,b,formatting)
        expected=None
        for balance in [reference_balance, production_balance]:
            _balance_blank_paragraphs=balance
            generate_tracked_document('/before.docx','/after.docx','/out.docx','D02',formatting,True,True,wire)
            current=contents('/out.docx')
            if expected is None:expected=current
            else:assert current==expected,(case,sorted(current))
            # Production Accept All path must also produce identical parts.
            accept_tracked_document('/out.docx','/accepted.docx')
            accepted=contents('/accepted.docx')
            if balance is reference_balance:expected_accepted=accepted
            else:assert accepted==expected_accepted,case
            with zipfile.ZipFile('/out.docx') as source, zipfile.ZipFile('/rejected.docx', 'w') as output:
                for entry in source.infolist():
                    data = source.read(entry.filename)
                    if entry.filename.startswith('word/') and entry.filename.endswith('.xml'):
                        data = _serialize_xml(reject(ET.fromstring(data))[0])
                    output.writestr(entry, data)
            rejected = contents('/rejected.docx')
            if balance is reference_balance:expected_rejected=rejected
            else:assert rejected==expected_rejected,case
            exports+=1
        for name,data in sorted(expected.items()):digest.update(name.encode());digest.update(data)
    _balance_blank_paragraphs=production_balance
    return {'cases':240,'exports':exports,'formatting_on':120,'formatting_off':120,'mismatches':0,'checked':'all ZIP member bytes except w:date value; Accept All and Reject All parts also identical','results_sha256':digest.hexdigest(),'seconds':time.perf_counter()-start}
