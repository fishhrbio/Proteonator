"""Sequence-file adapters and explicitly parameterized local RNA folding."""
import hashlib
import io
import math
import warnings


def import_genbank(req):
    from Bio import SeqIO
    from Bio import BiopythonParserWarning
    text = req['text']
    if len(text.encode('utf-8')) > 4 * 1024 * 1024:
        raise ValueError('Sequence input exceeds 4 MiB.')
    records = []
    proteins = []
    with warnings.catch_warnings(record=True) as notices:
        warnings.simplefilter('always', BiopythonParserWarning)
        for record in SeqIO.parse(io.StringIO(text.removeprefix('\ufeff')), 'genbank'):
            if len(records) >= 100 or len(record.seq) > 300000:
                raise ValueError('GenBank import supports at most 100 records, each up to 300,000 nucleotides.')
            molecule = 'rna' if 'RNA' in record.annotations.get('molecule_type', '').upper() else 'dna'
            sequence = str(record.seq).upper()
            if molecule == 'rna':
                sequence = sequence.replace('T', 'U')
            features = []
            for index, f in enumerate(record.features):
                if f.location is None:
                    continue
                name = next((f.qualifiers[k][0] for k in ['label', 'gene', 'product', 'note'] if f.qualifiers.get(k)), f.type)
                for part_index, part in enumerate(f.location.parts):
                    start, end = int(part.start), int(part.end)
                    if start < 0 or end > len(sequence) or start >= end:
                        raise ValueError('GenBank feature location is outside its sequence.')
                    features.append({'id':f'{record.id}:{index}:{part_index}', 'type':f.type,
                                     'name':str(name)[:256], 'start':start, 'end':end,
                                     'strand': -1 if part.strand == -1 else 1,
                                     'source':f'Imported GenBank {record.id}; location {f.location}',
                                     'evidence':'Source annotation; not independent experimental verification.'})
                if f.type == 'CDS':
                    if f.location.strand not in (1,-1):
                        proteins.append({'name':str(name),'error':'Mixed or unspecified CDS strand requires explicit mapping.'})
                        continue
                    if 'transl_except' in f.qualifiers:
                        proteins.append({'name':str(name), 'error':'CDS uses transl_except; contextual recoding requires explicit handling.'})
                        continue
                    table = int(f.qualifiers.get('transl_table', ['1'])[0])
                    offset = int(f.qualifiers.get('codon_start', ['1'])[0]) - 1
                    if offset not in (0, 1, 2):
                        raise ValueError('Invalid codon_start qualifier.')
                    cds = f.extract(record.seq)[offset:]
                    nucleotide_positions=list(f.location)[offset:]
                    if len(cds) % 3:
                        proteins.append({'name':str(name), 'error':'CDS is partial or not divisible by three; review the source coordinates.'})
                        continue
                    protein = str(cds.translate(table=table, to_stop=False))
                    terminal_stop = protein.endswith('*')
                    if terminal_stop:
                        protein = protein[:-1]
                    if '*' in protein:
                        proteins.append({'name':str(name), 'error':'Internal stop in annotated CDS.'})
                        continue
                    # Biopython cds=True implements bacterial alternate initiation.
                    complete = all(type(p.start).__name__ == 'ExactPosition' and type(p.end).__name__ == 'ExactPosition' for p in f.location.parts) and offset == 0
                    if complete:
                        try:
                            protein = str(cds.translate(table=table, cds=True))
                        except ValueError as error:
                            proteins.append({'name':str(name), 'error':str(error)})
                            continue
                    annotated = f.qualifiers.get('translation', [None])[0]
                    if annotated is not None and ''.join(annotated.split()) != protein:
                        proteins.append({'name':str(name), 'error':'Annotated protein disagrees with the translated CDS.'})
                        continue
                    proteins.append({'name':str(name)[:256], 'sequence':protein, 'codingSequence':str(cds),
                                     'tableId':table, 'completeCDS':complete, 'terminalStop':terminal_stop,
                                     'sourceRecord':record.id, 'sourceRecordIndex':len(records), 'location':str(f.location), 'codonStart':offset + 1, 'strand':f.location.strand,
                                     'codonPositions':[nucleotide_positions[i:i+3] for i in range(0,len(nucleotide_positions),3)]})
            records.append({'name':record.id, 'molecule':molecule, 'sequence':sequence,
                            'source':f'Imported GenBank {record.id}', 'features':features})
    if not records:
        raise ValueError('No GenBank records found.')
    return {'records':records, 'proteins':proteins,
            'warnings':[str(n.message) for n in notices], 'parser':'Biopython 1.86 GenBank',
            'sha256':hashlib.sha256(text.encode('utf-8')).hexdigest()}


def map_sequence(req):
    from Bio.Align import PairwiseAligner
    from molecule import inspect
    protein=req['protein']
    if not protein or len(protein)>2000 or any(a not in 'ACDEFGHIKLMNPQRSTVWY' for a in protein):
        raise ValueError('Reviewed structural mapping supports 1–2,000 standard protein residues.')
    data=inspect({'text':req['text'],'format':'mmcif'})
    residues=[r for r in data['residues'] if r['chain']==req['chain'] and r['kind']=='protein']
    if not residues or len(residues)>2000:
        raise ValueError('Choose a protein chain with at most 2,000 resolved residues.')
    reference=''.join(r['oneLetter'] if r['oneLetter'] in 'ACDEFGHIKLMNPQRSTVWY' else 'X' for r in residues)
    settings=req['settings']
    values=[float(settings[k]) for k in ['match','mismatch','gap']]
    if not all(math.isfinite(v) for v in values) or values[0]<=0 or values[1]>0 or values[2]>=0:
        raise ValueError('Provide a positive match score and nonpositive mismatch/negative gap scores.')
    aligner=PairwiseAligner(mode='global',match_score=values[0],mismatch_score=values[1],open_gap_score=values[2],extend_gap_score=values[2])
    alignments=aligner.align(protein,reference)
    iterator=iter(alignments);alignment=next(iterator);second=next(iterator,None)
    pairs=[]
    for (a,b),(c,d) in zip(*alignment.aligned):
        for i,j in zip(range(int(a),int(b)),range(int(c),int(d))):
            pairs.append({'position':i+1,'structureResidue':residues[j]['id'],'expected':protein[i],
                          'observed':reference[j], 'matches':protein[i]==reference[j]})
    return {'pairs':pairs,'score':alignment.score,'ambiguousBestAlignment':second is not None and second.score==alignment.score,
            'method':'Global sequence alignment; linear gap cost; candidate correspondence requires review',
            'settings':settings,'proteinSha256':hashlib.sha256(protein.encode('ascii')).hexdigest()}


def align_proteins(req):
    from Bio.Align import PairwiseAligner
    a,b=req['reference'],req['comparison']
    if not a or not b or max(len(a),len(b))>2000 or any(x not in 'ACDEFGHIKLMNPQRSTVWY' for x in a+b):
        raise ValueError('Pairwise comparison supports 1–2,000 standard amino acids per sequence.')
    settings=req['settings'];match,mismatch,gap=[float(settings[k]) for k in ['match','mismatch','gap']]
    if not all(math.isfinite(v) for v in [match,mismatch,gap]) or match<=0 or mismatch>0 or gap>=0:
        raise ValueError('Invalid explicit alignment scores.')
    aligner=PairwiseAligner(mode='global',match_score=match,mismatch_score=mismatch,open_gap_score=gap,extend_gap_score=gap)
    iterator=iter(aligner.align(a,b));alignment=next(iterator);second=next(iterator,None)
    x,y=alignment[0],alignment[1];both=sum(p!='-' and q!='-' for p,q in zip(x,y));same=sum(p==q and p!='-' for p,q in zip(x,y))
    return {'referenceAligned':x,'comparisonAligned':y,'identicalPositions':same,'pairedPositions':both,
            'identityFraction':same/both if both else None,'score':alignment.score,
            'ambiguousBestAlignment':second is not None and second.score==alignment.score,'settings':settings,
            'method':'Global pairwise alignment with explicit linear gap cost; sequence similarity does not establish transcript identity.'}


def fold_rna(req):
    import RNA
    sequence = req['sequence'].upper()
    if not sequence or len(sequence) > 1500 or any(c not in 'ACGU' for c in sequence):
        raise ValueError('RNA folding requires 1–1,500 unambiguous A/C/G/U bases.')
    temperature = float(req['temperatureC'])
    salt = float(req['saltM'])
    cutoff = float(req['probabilityCutoff'])
    dangles = int(req['dangles'])
    if not all(math.isfinite(v) for v in [temperature, salt, cutoff]) or not 0 <= temperature <= 80 or not 0.01 <= salt <= 2 or not 0 < cutoff <= 1 or dangles not in (0, 2):
        raise ValueError('Review temperature (0–80 °C), salt (0.01–2 M), probability cutoff (0–1] and dangles (0 or 2).')
    if not isinstance(req['noLP'], bool):
        raise ValueError('The no-lonely-pairs setting must be explicit.')
    md = RNA.md()
    md.temperature, md.salt, md.dangles, md.noLP = temperature, salt, dangles, req['noLP']
    fc = RNA.fold_compound(sequence, md, RNA.OPTION_MFE | RNA.OPTION_PF)
    structure, mfe = fc.mfe()
    fc.exp_params_rescale(mfe)
    _, ensemble = fc.pf()
    matrix = fc.bpp()
    pairs = [[i, j, matrix[i][j]] for i in range(1, len(sequence)+1)
             for j in range(i+1, len(sequence)+1) if matrix[i][j] >= cutoff]
    if not all(math.isfinite(v) for v in [mfe, ensemble]):
        raise ValueError('RNA folding returned a nonfinite energy.')
    return {'sequence':sequence,'sequenceSha256':hashlib.sha256(sequence.encode('ascii')).hexdigest(),
            'structure':structure, 'mfeKcalMol':mfe, 'ensembleFreeEnergyKcalMol':ensemble,
            'pairs':pairs[:10000], 'pairsTruncated':len(pairs)>10000,
            'method':'ViennaRNA '+RNA.__version__+'; pseudoknot-free secondary structure, Turner default energy parameters',
            'settings':{'temperatureC':temperature,'saltM':salt,'dangles':dangles,'noLP':req['noLP'],
                        'probabilityCutoff':cutoff},
            'interpretation':'Model-based secondary structure and ensemble probabilities; not an RNA-family identification, native-fold confirmation or expression-yield prediction.'}
