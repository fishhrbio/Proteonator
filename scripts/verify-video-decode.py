"""Independent container/codec verification using the private QA PyAV dependency."""
from pathlib import Path
import hashlib
import json
import av

root=Path(__file__).resolve().parents[1]
file=root/'work/media-verification/camera.webm'
times=[];images=set();width=height=0
with av.open(str(file)) as container:
    stream=container.streams.video[0]
    codec=stream.codec_context.name
    for frame in container.decode(stream):
        width,height=frame.width,frame.height
        assert frame.time is not None, 'Decoded frame has no presentation timestamp'
        times.append(frame.time)
        if len(images)<10:
            pixels=frame.to_ndarray(format='rgb24')
            assert pixels.max()>pixels.min(), 'Decoded image is blank'
            images.add(hashlib.sha256(pixels.tobytes()).hexdigest())
result={'status':'passed','decoder':'PyAV '+av.__version__+' / FFmpeg','codec':codec,'width':width,'height':height,'frames':len(times),'distinctDecodedImages':len(images),'firstPresentationSeconds':times[0] if times else None,'lastPresentationSeconds':times[-1] if times else None,'timestampSpanSeconds':times[-1]-times[0] if times else 0}
(root/'work/video-decode-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
assert (width,height)==(1280,720), result
assert len(times)>=10 and len(images)>=3, result
assert all(b>a for a,b in zip(times,times[1:])), result
assert 4<=result['timestampSpanSeconds']<=8, result
print(json.dumps(result))
