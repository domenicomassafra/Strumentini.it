# Video inspection — synthetic fixtures

These four tiny MP4s were created from FFmpeg `lavfi` on 2026-10-08, not captured on a physical mobile device. They test limited ISO BMFF extraction, not production codec/device acceptance.

```sh
ffmpeg -hide_banner -nostdin -loglevel error -y -f lavfi -i 'color=c=blue:s=64x48:r=12:d=1.25' -an -c:v libx264 -preset ultrafast -pix_fmt yuv420p video-12fps.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -f lavfi -i 'color=c=red:s=80x60:r=10:d=1.2' -f lavfi -i 'anullsrc=r=48000:cl=mono' -t 1.2 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart video-plus-audio.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -display_rotation 90 -i video-12fps.mp4 -c copy -movflags +faststart video-rotated.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -display_rotation -90 -i video-12fps.mp4 -c copy -movflags +faststart video-rotated-minus90.mp4
```

Independent FFprobe observations: `video-12fps.mp4` 1.25 s, 64×48 H.264, one video track; `video-plus-audio.mp4` 1.20 s, 80×60 H.264 plus AAC audio; `video-rotated.mp4` +90° display matrix and `video-rotated-minus90.mp4` −90° matrix. The engine keeps FPS/CFR/VFR and per-stream bitrate unknown. Real-world video and physical-device acceptance remain unproven.
