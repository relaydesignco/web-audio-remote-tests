# Web Audio Media Recorder Remote Mic Test

The 2 js files are nearly identical, but the `record-stb.js` creates an audio stream from the mic on the remote after connecting.

`record.js` will ask for your permission to use an audio device on your computer. If the orange remote is paired to your computer you can use that.

## Minor Gotcha

For the STB, the test will work best if the remote and mic have been paired to the STB already.

The `pairMic` method will attempt to pair the remote and mic, but I didn't actually test this, as mine was already paired.

## Instructions

After connecting the remote mic or allowing access from the browser.

Press RETURN to record audio and again to STOP recording.

Then press SPACE to playback recording.

Press ESC to reset, and you can repeat the process.