import "./style.css";
import { Command } from "@tauri-apps/api/shell";
import { homeDir } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";

let filePaths: string[];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;">
    <h1>One Incredible Video Compressor</h1>
    <div id="dropZone" style="height:200px;border:3px dashed black;display:flex;place-items:center;justify-content:center;">
    <h2 style="color:#dbdbdb;">Drop a video here</h2>
    </div>
    <div class="card">
      <button id="start" type="button">Start compressing</button>
      <div id="queue" style="width:400px;height:300px;overflow:auto;"></div>
    </div>
  </div>
`;

const button = document.querySelector("#start");

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
      command.stderr.addListener("data", (d) => console.log(d));
      const output = await command.execute();
      console.log("exited with code ", output.code);
    });
  } else [console.error("No files submitted")];
}

function updateQueue() {
  const queueContainer = document.querySelector<HTMLDivElement>("#queue");
  queueContainer!.innerHTML = JSON.stringify(filePaths, null, " ");
}

button?.addEventListener("click", startCompression);

listen("tauri://file-drop", async (event) => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log(event);
  filePaths = event.payload as string[];
  updateQueue();
});
