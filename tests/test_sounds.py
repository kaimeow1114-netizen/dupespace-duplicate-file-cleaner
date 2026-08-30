import runpy
import struct
import wave
from pathlib import Path


def test_trash_sound_is_short_tonal_and_ships_without_paper_noise():
    root = Path(__file__).resolve().parents[1]
    generator = runpy.run_path(str(root / "scripts" / "generate_sounds.py"))
    expected = generator["sequence"](
        generator["tone"](760, .10, .22), generator["silence"](.025),
        generator["tone"](960, .14, .22),
    )
    assert generator["SOUNDS"]["trash"] == expected
    with wave.open(str(root / "src" / "dupespace" / "assets" / "trash.wav")) as audio:
        assert audio.getnframes() / audio.getframerate() < .3
        samples = struct.unpack(f"<{audio.getnframes()}h", audio.readframes(audio.getnframes()))
    assert max(map(abs, samples)) < 7000
