"""Bounded scientific figures from explicit, already calculated data."""
import io
import math
import os
import tempfile


def plot_series(req):
    os.environ.setdefault('MPLCONFIGDIR',os.path.join(tempfile.gettempdir(),'Proteonator-matplotlib'))
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    series = req['series']
    kind = req['kind']
    if kind not in ('hydropathy', 'displacement'):
        raise ValueError('Unsupported scientific figure.')
    limit = 10000 if kind == 'hydropathy' else 50000
    if not isinstance(series, list) or not 1 <= len(series) <= limit:
        raise ValueError(f'A {kind} figure needs 1–{limit:,} data positions.')
    values = []
    for value in series:
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value)):
            raise ValueError('Figure values must be finite numbers or explicit missing values.')
        values.append(float('nan') if value is None else value)
    with plt.rc_context({'svg.fonttype':'none', 'font.size':10}):
        fig, ax = plt.subplots(figsize=(9, 3.8), layout='constrained')
        try:
            ax.plot(range(1, len(values)+1), values, color='#006B50', linewidth=1.3)
            ax.set_xlabel('Protein position (1-based)' if kind == 'hydropathy' else 'Reviewed correspondence row (1-based)')
            ax.set_ylabel('Kyte–Doolittle hydropathy' if kind == 'hydropathy' else 'Displacement (Å)')
            ax.set_title('Sequence hydropathy' if kind == 'hydropathy' else 'Displacement in the fitted reference frame')
            if kind == 'hydropathy':
                ax.set_ylim(-4.6, 4.6)
                ax.axhline(0, color='#444444', linewidth=.6)
            else:
                ax.set_ylim(bottom=0)
            ax.grid(alpha=.2)
            stream=io.StringIO()
            fig.savefig(stream, format='svg', metadata={'Creator':'Proteonator; Matplotlib '+matplotlib.__version__, 'Date':None})
            return {'svg':stream.getvalue().replace('<svg ', '<svg role="img" aria-label="'+('Sequence hydropathy profile' if kind=='hydropathy' else 'Displacement in the fitted reference frame')+'" ',1), 'renderer':'Matplotlib '+matplotlib.__version__, 'kind':kind, 'points':len(values)}
        finally:
            plt.close(fig)
