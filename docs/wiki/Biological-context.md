# Biological context and evidence

Explicitly retrieve UniProt, PDBe SIFTS and available Ensembl records. Accession, source, retrieval time and service errors remain in the project. Cached context remains usable offline. These services do not receive the open coordinate file.

Source annotations may describe genes, transcripts/isoforms, domains, active/binding sites, processing and PTMs. SIFTS segment and resolved sequence identities are checked before structural correspondence is reported. A source without trustworthy references can remain unmapped; no unique transcript is invented.

Features keeps native source annotations separate from engineered modules. Sequence-bound domain/feature imports require an exact record/hash and supplied evidence. Compare supplied sequences/isoforms without promoting similarity into gene identity or creating missing structure.

Confidence/validation profiles require an exact coordinate/source/model/assembly binding, explicit metric, units, source and method. B factors do not become pLDDT automatically. Changed/stale structures do not acquire fresh validation from an older imported profile.

State-specific evidence distinguishes planned, observed and interpreted outcomes. Sequence, maturation, chemical pairing, purity and activity records remain separate. Scientific limitations and third-party credit remain attached to reports and methods.
