from pathlib import Path
import copy
import unittest
import numpy as np
import molecule as m
import trajectories as t
root=Path(__file__).resolve().parents[1]
class TrajectoryTests(unittest.TestCase):
 def fixture(self):
  inspected=m.inspect({'text':(root/'fixtures/structures/1CRN.pdb').read_text(encoding='utf-8'),'format':'pdb'});text=inspected['displayText'];positions=[a['position'] for a in inspected['atoms']];data={'format':'proteonator-trajectory','version':'1','topologySha256':m.sha(text),'atomIds':[a['id'] for a in inspected['atoms']],'units':'angstrom','motion':'ensemble','method':'Synthetic rigid translations for an analytic test','source':'1CRN coordinate fixture, translated only','frames':[{'positions':[[x+delta,y,z] for x,y,z in positions]} for delta in [0,1,-1]]};return {'topologyText':text,'data':data}
 def test_frame_positions_are_actual_registered_data_and_keep_connectivity(self):
  req=self.fixture();result=t.frame({**req,'index':1});frame=m.inspect({'text':result['text'],'format':'mmcif'});self.assertAlmostEqual(frame['atoms'][0]['position'][0],req['data']['frames'][1]['positions'][0][0],places=5);self.assertEqual(len(m.parse(result['text'],'mmcif').connections),3)
 def test_analytic_unaligned_rmsd_rmsf_and_nanometer_conversion(self):
  req=self.fixture();result=t.analysis(req);np.testing.assert_allclose(result['rmsdAngstrom'],[0,1,1],atol=1e-10);np.testing.assert_allclose([a['rmsfAngstrom'] for a in result['rmsfByAtom']],np.sqrt(2/3),atol=1e-10);req['data']['units']='nanometer'
  for f in req['data']['frames']:f['positions']=(np.asarray(f['positions'])/10).tolist()
  np.testing.assert_allclose(t.analysis(req)['rmsdAngstrom'],[0,1,1],atol=1e-10)
 def test_hash_order_nonfinite_times_and_frames_reject(self):
  req=self.fixture()
  for mutate in [lambda r:r['data'].update(topologySha256='0'*64),lambda r:r['data']['atomIds'].reverse(),lambda r:r['data']['frames'][0]['positions'][0].__setitem__(0,float('nan')),lambda r:r['data']['frames'][0].update(timePs=1),lambda r:r['data'].update(motion='trajectory')]:
   bad=copy.deepcopy(req);mutate(bad)
   with self.assertRaises(ValueError):t.frame({**bad,'index':0})
  with self.assertRaises(ValueError):t.frame({**req,'index':3})
if __name__=='__main__':unittest.main(verbosity=2)
