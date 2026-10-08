# Video inspection — synthetic fixtures

Four baseline and three new tiny MP4s were created from FFmpeg `lavfi` on 2026-10-08, not captured on a physical mobile device. They test limited ISO BMFF extraction, not production codec/device acceptance.

```sh
ffmpeg -hide_banner -nostdin -loglevel error -y -f lavfi -i 'color=c=blue:s=64x48:r=12:d=1.25' -an -c:v libx264 -preset ultrafast -pix_fmt yuv420p video-12fps.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -f lavfi -i 'color=c=red:s=80x60:r=10:d=1.2' -f lavfi -i 'anullsrc=r=48000:cl=mono' -t 1.2 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 64k -movflags +faststart video-plus-audio.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -display_rotation 90 -i video-12fps.mp4 -c copy -movflags +faststart video-rotated.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -display_rotation -90 -i video-12fps.mp4 -c copy -movflags +faststart video-rotated-minus90.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -threads 1 -f lavfi -i 'testsrc2=size=64x48:rate=12:duration=2' -vf "setpts='if(lt(N,12),N/(12*TB),(1+(N-12)/6)/TB)'" -fps_mode vfr -c:v libx264 -preset ultrafast -x264-params bframes=0 -pix_fmt yuv420p -video_track_timescale 12000 video-vfr.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -threads 1 -f lavfi -i 'color=c=blue:s=64x48:r=12:d=2' -f lavfi -i 'color=c=red:s=80x60:r=6:d=2' -f lavfi -i 'anullsrc=r=48000:cl=mono' -map 0:v -map 1:v -map 2:a -t 2 -c:v libx264 -preset ultrafast -x264-params bframes=0 -pix_fmt yuv420p -c:a aac -b:a 32k -movflags +faststart video-multistream.mp4
ffmpeg -hide_banner -nostdin -loglevel error -y -threads 1 -f lavfi -i 'color=c=black:s=64x48:r=1/900:d=3600' -c:v libx264 -preset ultrafast -x264-params bframes=0 -pix_fmt yuv420p -movflags +faststart video-hour-sparse.mp4
```

Independent FFprobe observations: `video-12fps.mp4` 1.25 s, 64×48 H.264, one video track; `video-plus-audio.mp4` 1.20 s, 80×60 H.264 plus AAC audio; `video-rotated.mp4` +90° display matrix and `video-rotated-minus90.mp4` −90° matrix.

`video-vfr.mp4` has 24 video packets, presentation duration 2.916667 s, and packet duration values 0.083333, 0.166667 and 0.250000 s. `video-multistream.mp4` has two separately identified H.264 video tracks (64×48 at 24 packets and 80×60 at 12 packets) plus AAC audio, for 2 seconds. `video-hour-sparse.mp4` has only four video packets, each lasting 900 seconds; total duration is 3600 seconds while the file is approximately 1.5 KB. The latter stresses high sample-duration values without constructing a huge decoded video.

Reproduce independent reference observations with FFprobe (tested locally with FFmpeg 8.1.2):

```sh
ffprobe -v error -show_entries format=duration,size:stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration -of json video-multistream.mp4
ffprobe -v error -select_streams v:0 -show_entries packet=pts_time,duration_time -of compact video-vfr.mp4
ffprobe -v error -select_streams v:0 -show_entries packet=pts_time,duration_time -of compact video-hour-sparse.mp4
```

`vectors.json` records independent observations. Tests compare the local parser with these vectors and (when FFprobe exists) re-probe the actual binaries. **Decode-time `stts` deltas are not authoritative proof of presentation frame rate or a global CFR/VFR classification**: composition offsets, edits, malformed tables and other timing metadata can change presentation. The UI exposes only observed decode-time constancy/variation, explicitly warning that CFR/VFR remains unproven. FPS, CFR/VFR, per-stream bitrate and transcode claims stay unknown. Real-world video and physical-device acceptance remain unproven.
