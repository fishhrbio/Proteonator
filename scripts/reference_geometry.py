"""Independent standard-library oracle for the bundled 1BRS A/D fixture.

This deliberately does not import application code. It is a numerical test aid,
not a general structural-analysis package or a chemistry validation method.
"""
import collections
import hashlib
import json
import math
from pathlib import Path

fixture = Path(__file__).resolve().parents[1] / 'fixtures' / 'structures' / '1BRS.pdb'
data = fixture.read_bytes()
groups = collections.defaultdict(list)
connections = collections.defaultdict(set)
canonical = set('ALA ARG ASN ASP CYS GLN GLU GLY HIS ILE LEU LYS MET PHE PRO SER THR TRP TYR VAL SEC PYL'.split())
for line in data.decode('utf-8').splitlines():
    record = line[:6].strip()
    if record == 'MODEL':
        raise ValueError('This fixture oracle expects one implicit model')
    if record == 'CONECT':
        ids = [int(line[i:i+5]) for i in range(6,len(line),5) if line[i:i+5].strip()]
        for target in ids[1:]:
            connections[ids[0]].add(target)
            connections[target].add(ids[0])
    if record != 'ATOM' or line[17:20].strip() not in canonical:
        continue
    key = (line[21:22].strip(),line[22:26].strip(),line[26:27].strip(),line[17:20].strip())
    groups[key].append(dict(serial=int(line[6:11]),name=line[12:16].strip(),alt=line[16:17].strip(),
        occupancy=float(line[54:60]) if line[54:60].strip() else 1.0,
        element=line[76:78].strip().upper(),xyz=tuple(float(line[i:i+8]) for i in (30,38,46)),residue=key))
active=[]
for key,atoms in groups.items():
    scores=collections.defaultdict(list)
    for atom in atoms:
        if atom['alt']:
            scores[atom['alt']].append(atom['occupancy'])
    preferred=min(scores,key=lambda alt:(-sum(scores[alt])/len(scores[alt]),alt!='A',alt)) if scores else ''
    blank={a['name'] for a in atoms if not a['alt'] and a['occupancy']>0}
    active.extend(a for a in atoms if a['occupancy']>0 and a['element'] and a['element'] not in {'H','D','T'}
        and (not a['alt'] or (a['alt']==preferred and a['name'] not in blank)))
a_atoms=[a for a in active if a['residue'][0]=='A']
d_atoms=[a for a in active if a['residue'][0]=='D']
radii={'C':1.70,'N':1.55,'O':1.52,'S':1.80,'P':1.80}
closest=None
contacts=[]
overlaps=[]
residue_pairs=set()
for a in a_atoms:
    neighbors=set(connections[a['serial']])
    for intermediate in list(neighbors):
        neighbors.update(connections[intermediate])
    for b in d_atoms:
        distance=math.dist(a['xyz'],b['xyz'])
        signature=f"{a['serial']}:{b['serial']}"
        if closest is None or distance<closest['distanceAngstrom']:
            closest={'serialA':str(a['serial']),'serialB':str(b['serial']),'distanceAngstrom':distance}
        if distance<=4:
            contacts.append(signature)
            residue_pairs.add((a['residue'],b['residue']))
        if a['element'] in radii and b['element'] in radii and b['serial'] not in neighbors:
            overlap=radii[a['element']]+radii[b['element']]-distance
            if overlap-0.4>1e-12:
                overlaps.append(signature)
result={'fixture':'1BRS.pdb','sourceSha256':hashlib.sha256(data).hexdigest(),
    'method':'independent Python fixed-column read and math.dist; A/D active protein heavy atoms',
    'atomCountA':len(a_atoms),'atomCountB':len(d_atoms),'evaluatedPairCount':len(a_atoms)*len(d_atoms),
    'minimumDistance':closest,'contactCount':len(contacts),'contactResiduePairCount':len(residue_pairs),
    'clashCandidateCount':len(overlaps),'contactSerialPairs':sorted(contacts),'overlapSerialPairs':sorted(overlaps)}
print(json.dumps(result,indent=2))
