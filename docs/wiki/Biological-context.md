# Biological context

Retrieve context explicitly after checking the UniProt accession. UniProt supplies available gene, organism, isoform, function, maturation and PTM annotations. PDBe SIFTS supplies structure-to-sequence segments. Available Ensembl transcript records add genomic exon summaries; introns are compressed and the bars are not a structure-to-genome registration.

Selected structural residues map through a matching chain and SEQRES segment, then their residue identity is checked against the retrieved protein. The application does not assume a constant author-number offset. Missing coverage, engineered changes, ambiguous genes and incomplete cross-references can prevent a unique mapping. A local coordinate file may remain unmapped even after retrieving a plausible accession.

Cached records include retrieval time, sources and service errors and reopen offline. A service failure does not substitute invented annotations. Splice isoforms and PTMs represent different biological processes; selecting an isoform sequence does not produce a three-dimensional conformation. Enzyme mechanisms are shown only to the extent supplied by curated annotations.
