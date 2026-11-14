"""Snapshot curated genetic-code definitions from the pinned Biopython release."""
import json
from pathlib import Path
from Bio import __version__
from Bio.Data import CodonTable

root = Path(__file__).resolve().parents[1]
tables = []
for code_id, table in sorted(CodonTable.unambiguous_dna_by_id.items()):
    dual = sorted(set(table.forward_table) & set(table.stop_codons))
    tables.append({"id": code_id, "name": table.names[0], "forward": table.forward_table,
                   "starts": table.start_codons, "stops": table.stop_codons,
                   "dualCoding": dual})
target = root / 'src/sequence/genetic-codes.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({"source": "NCBI Genetic Codes via Biopython", "biopython": __version__,
                             "sourceUrl": "https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi",
                             "tables": tables}, indent=2) + '\n', encoding='utf-8')
print(f'Exported {len(tables)} genetic-code tables; contextual dual-coding tables are marked.')
