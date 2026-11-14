import unittest
import io
from Bio import SeqIO
from Bio.Seq import Seq
from Bio.SeqRecord import SeqRecord
from Bio.SeqFeature import SeqFeature, SimpleLocation
from sequence_tools import import_genbank, fold_rna

class SequenceAdapters(unittest.TestCase):
    def test_reverse_strand_cds_and_bacterial_initiation(self):
        record=SeqRecord(Seq('TTATTTCAC'),id='FIXTURE',name='FIXTURE',description='Synthetic parser fixture')
        record.annotations['molecule_type']='DNA'
        record.features=[SeqFeature(SimpleLocation(0,9,strand=-1),type='CDS',qualifiers={'transl_table':['11'],'translation':['MK'],'label':['Reverse CDS']})]
        out=io.StringIO();SeqIO.write(record,out,'genbank')
        result=import_genbank({'text':out.getvalue()})
        self.assertEqual(result['proteins'][0]['sequence'],'MK')
        self.assertEqual(result['proteins'][0]['codingSequence'],'GTGAAATAA')
        self.assertEqual(result['records'][0]['features'][0]['strand'],-1)
        self.assertTrue(result['proteins'][0]['completeCDS'])
        self.assertEqual(result['proteins'][0]['codonPositions'][0],[8,7,6])

    def test_inconsistent_annotation_is_a_visible_error(self):
        record=SeqRecord(Seq('ATGAAATAA'),id='FIXTURE',name='FIXTURE',description='Synthetic annotation mismatch')
        record.annotations['molecule_type']='DNA'
        record.features=[SeqFeature(SimpleLocation(0,9),type='CDS',qualifiers={'translation':['MF']})]
        out=io.StringIO();SeqIO.write(record,out,'genbank')
        result=import_genbank({'text':out.getvalue()})
        self.assertIn('disagrees',result['proteins'][0]['error'])

    def test_unpairable_rna_has_zero_pairing_and_zero_mfe(self):
        result=fold_rna({'sequence':'AAAAAAAAAAAA','temperatureC':37,'saltM':1.021,'probabilityCutoff':.01,'dangles':2,'noLP':False})
        self.assertEqual(result['structure'],'.'*12)
        self.assertEqual(result['mfeKcalMol'],0)
        self.assertEqual(result['pairs'],[])
        self.assertEqual(result['settings']['temperatureC'],37)

    def test_rna_parameter_and_alphabet_failures_are_not_fallback_results(self):
        req={'sequence':'ACGUACGU','temperatureC':37,'saltM':1.021,'probabilityCutoff':.01,'dangles':2,'noLP':False}
        for key,value in [('sequence','ACGT'),('saltM',0),('temperatureC',float('nan')),('dangles',1)]:
            with self.assertRaises(ValueError):fold_rna({**req,key:value})

if __name__=='__main__':unittest.main(verbosity=2)
