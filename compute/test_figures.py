import unittest
from figures import plot_series


class ScientificFigures(unittest.TestCase):
    def test_full_alignment_limit_preserves_missing_positions(self):
        result = plot_series({'kind': 'displacement', 'series': [None, 1.0] * 25000})
        self.assertEqual(result['points'], 50000)
        self.assertIn('Displacement', result['svg'])
        self.assertNotIn('nan', result['svg'].lower())

    def test_limits_and_nonfinite_inputs_reject(self):
        for request in [
            {'kind': 'hydropathy', 'series': [0] * 10001},
            {'kind': 'displacement', 'series': [0] * 50001},
            {'kind': 'displacement', 'series': [float('nan')]},
            {'kind': 'displacement', 'series': [True]},
            {'kind': 'unsupported', 'series': [0]},
        ]:
            with self.assertRaises(ValueError):
                plot_series(request)


if __name__ == '__main__':
    unittest.main(verbosity=2)
