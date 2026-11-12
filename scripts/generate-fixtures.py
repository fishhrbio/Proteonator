from pathlib import Path
import hashlib
import json
import datetime
import subprocess
import sys

root=Path(__file__).resolve().parents[1]
fixtures=root/'fixtures'
synthetic=fixtures/'synthetic'
synthetic.mkdir(exist_ok=True)
(fixtures/'expected').mkdir(exist_ok=True)
source=(fixtures/'structures'/'1CRN.pdb').read_text(encoding='utf-8').splitlines()
atoms=[line for line in source if line.startswith('ATOM  ')]
assert len(atoms)==327
records=['HEADER    SYNTHETIC PARSER LOAD FIXTURE',
         'REMARK    48 TRANSLATED COPIES OF 1CRN; NOT AN OBSERVED ASSEMBLY.',
         'REMARK    NO INTERACTION OR BIOLOGICAL INTERPRETATION IS VALID.']
chains='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuv'
serial=0
for index,chain in enumerate(chains):
    dx=(index%8)*100
    dy=(index//8)*100
    for line in atoms:
        serial+=1
        x=float(line[30:38])+dx
        y=float(line[38:46])+dy
        records.append(line[:6]+f'{serial:5d}'+line[11:21]+chain+line[22:30]+f'{x:8.3f}{y:8.3f}'+line[46:])
    records.append('TER                  '+chain)
records.append('END')
(synthetic/'crambin-grid-48.pdb').write_text('\n'.join(records)+'\n',encoding='utf-8',newline='\n')
assert serial==15696

def atom(serial,chain,x,y,z,seq=1,ins='',alt='',occupancy=1):
    line=list(' '*80)
    for start,value in [(0,'ATOM  '),(6,f'{serial:5d}'),(12,' CA '),(16,alt),(17,'ALA'),(21,chain),(22,f'{seq:4d}'),(26,ins),(30,f'{x:8.3f}'),(38,f'{y:8.3f}'),(46,f'{z:8.3f}'),(54,f'{occupancy:6.2f}'),(60,' 20.00'),(76,' C')]:
        line[start:start+len(value)]=value
    return ''.join(line)
edge_files={
 'distance-3-4-5.pdb':[atom(1,'A',0,0,0),atom(2,'B',3,4,0)],
 'contact-boundary.pdb':[atom(1,'A',0,0,0),atom(2,'B',4,0,0)],
 'insertion-alternates.pdb':[atom(1,'A',0,0,0,seq=10),atom(2,'A',1,0,0,seq=10,ins='A',alt='A',occupancy=.4),atom(3,'A',2,0,0,seq=10,ins='A',alt='B',occupancy=.6),atom(4,'A',3,0,0,seq=10,ins='B')],
}
for name,rows in edge_files.items():
    (synthetic/name).write_text('REMARK    SYNTHETIC NUMERICAL TEST ONLY\n'+'\n'.join(rows)+'\nEND\n',encoding='utf-8',newline='\n')
print('Generated the 48-copy parser fixture and three analytic identity fixtures; expectations were not changed.')
