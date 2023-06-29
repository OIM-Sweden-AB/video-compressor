import "./style.css";
import { Command } from "@tauri-apps/api/shell";
import { homeDir } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";

let filePaths: string[];
let totalFrames: number;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;">
    <h1>One Incredible Video Compressor</h1>
    <div id="dropZone" style="height:200px;border:3px dashed black;display:flex;place-items:center;justify-content:center;">
    <h2 style="color:#dbdbdb;">Drop a video here</h2>
    </div>
    <div class="card">
    <p>Compressed files are placed in <a href="${await homeDir()}\Videos">${await homeDir()}\Videos</a> </p>
      <button id="start" type="button">Start compressing</button>
      <div id="queue" style="width:400px;height:100px;overflow:auto;"></div>
      <div id="progress"></div>
    </div>
  </div>
`;

const button = document.querySelector("#start");

function getTotalFrames(d: string) {
  let output = d;
  let durationPattern = /Duration: (\d{2}:\d{2}:\d{2}.\d{2})/;
  let fpsPattern = /, (\d+) fps,/;

  let durationMatch = output.match(durationPattern);
  let fpsMatch = output.match(fpsPattern);

  let duration, fps;

  if (durationMatch) {
    duration = durationMatch[1]; // Duration: 00:00:09.96 -> 00:00:09.96
  }

  if (fpsMatch) {
    fps = parseInt(fpsMatch[1]); // 25 fps -> 25
  }

  if (duration && fps) {
    const d = parseFloat(duration.split(":").pop());

    totalFrames = d * fps;
    console.log("Duration:", duration);
    console.log("Frames per second:", fps);
  }
}

function getCurrentFrame(d: string) {
  let regex =
    /^frame=\s*(\d+)\s*fps=\s*([\d\.]+)\s*q=[\d\.\-]+\s*L?size=\s*[\d\.\-]+kB\s*time=[\d\:\.\-]+\s*bitrate=\s*([\d\.]+)kbits\/s\s*speed=[\d\.xN\/A]+\s*$/;

  let lines = d.split("\n");
  let frameLines = lines
    .map((line: string) => {
      let match = line.match(regex);
      if (match) {
        return {
          frame: parseInt(match[1], 10),
          fps: parseFloat(match[2]),
          bitrate: parseFloat(match[3]),
        };
      } else {
        return null;
      }
    })
    .filter((item: any) => item !== null);

  if (frameLines.length) console.log(frameLines);
}

async function startCompression() {
  if (filePaths.length) {
    filePaths.forEach(async (file) => {
      const fileName = file.split("\\").pop();
      const homeDirPath = await homeDir();
      const command = Command.sidecar("bin/ffmpeg", [
        "-i",
        file,
        "-vcodec",
        "h264",
        "-acodec",
        "mp3",
        `${homeDirPath}/Videos/${fileName}`,
      ]);

      const progress = document.querySelector("#progress");

      command.stderr.addListener("data", (d) => {
        progress!.innerHTML = d;

        const totalFrames = getTotalFrames(d);
        const currentFrame = getCurrentFrame(d);
      });

      const output = await command.execute();
      console.log(output.stderr);
      console.log("exited with code ", output.code);
    });
  } else console.error("No files submitted");
}

function updateQueue() {
  const queueContainer = document.querySelector<HTMLDivElement>("#queue");
  queueContainer!.innerHTML = JSON.stringify(filePaths, null, " ");
}

button?.addEventListener("click", startCompression);

listen("tauri://file-drop", async (event) => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  filePaths = event.payload as string[];
  updateQueue();
});
