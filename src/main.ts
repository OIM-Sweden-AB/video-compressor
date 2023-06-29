import "./style.css";
import { Command } from "@tauri-apps/api/shell";
import { homeDir } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;">
    <h1>One Incredible Video Compressor</h1>
    <div id="dropZone" style="height:200px;border:3px dashed black;display:flex;place-items:center;justify-content:center;">
      <h2 style="color:#dbdbdb;">Drop a video here</h2>
    </div>
    <div class="card">
    <p>Compressed files are placed in <a href="${await homeDir()}\Videos">${await homeDir()}\Videos</a> </p>
    <p id="errorMsg"></p>
      <button id="start" type="button">Start compressing</button>
      <div id="queue" style="width:400px;height:100px;overflow:auto;"></div>
      <div id="progress"></div>
    </div>
  </div>
`;

export interface LiveData {
  frame: number;
  fps: number;
  bitrate: number;
}

class VideoCompressor {
  public button!: HTMLButtonElement;
  public errorMsg!: HTMLParagraphElement;
  public progress!: HTMLParagraphElement;
  public queueContainer!: HTMLDivElement;

  public filePaths?: string[];
  public totalFrames?: number;
  public duration?: string;
  public fps?: number;
  public liveData: LiveData = {
    frame: 0,
    fps: 0,
    bitrate: 0,
  };

  constructor() {
    this.button = document.querySelector("#start")!;
    this.errorMsg = document.querySelector("#errorMsg")!;
    this.progress = document.querySelector("#progress")!;
    this.queueContainer = document.querySelector("#queue")!;

    this.init();
  }

  init() {
    this.addEventListeners();
  }

  addEventListeners() {
    this.button?.addEventListener("click", this.startCompression.bind(this));
    listen("tauri://file-drop", async (event) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.filePaths = event.payload as string[];
      this.updateQueue();
    });
  }

  getTotalFrames(d: string) {
    let output = d;
    let durationPattern = /Duration: (\d{2}:\d{2}:\d{2}.\d{2})/;
    let fpsPattern = /, (\d+) fps,/;

    let durationMatch = output.match(durationPattern);
    let fpsMatch = output.match(fpsPattern);

    if (durationMatch || fpsMatch) {
      if (durationMatch) {
        this.duration = durationMatch[1];
      }

      if (fpsMatch) {
        this.fps = parseInt(fpsMatch[1]);
      }

      if (this.duration && this.fps) {
        const timeParts = this.duration.split(":").map(parseFloat);
        let d = 0;
        if (timeParts.length === 3) {
          d = timeParts[0] * 60 * 60 + timeParts[1] * 60 + timeParts[2];
        } else if (timeParts.length === 2) {
          d = timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 1) {
          d = timeParts[0];
        } else {
        }
        this.totalFrames = d * this.fps;
        console.log("Duration:", this.duration);
        console.log("Frames per second:", this.fps);
        console.log("Total frames:", this.totalFrames);
      }
    }
  }

  getCurrentFrame(d: string) {
    let regex =
      /^frame=\s*(\d+)\s*fps=\s*([\d\.]+)\s*q=[\d\.\-]+\s*L?size=\s*[\d\.\-]+kB\s*time=[\d\:\.\-]+\s*bitrate=\s*([\d\.]+)kbits\/s\s*speed=[\d\.xN\/A]+\s*$/;

    let lines = d.split("\n");
    lines.forEach((line: string) => {
      let match = line.match(regex);
      if (match) {
        this.liveData = {
          frame: parseInt(match[1], 10),
          fps: parseFloat(match[2]),
          bitrate: parseFloat(match[3]),
        };
      }
    });
    return this.liveData;
  }

  async startCompression() {
    if (this.filePaths && this.filePaths.length) {
      this.errorMsg!.innerHTML = "";
      this.filePaths.forEach(async (file) => {
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

        command.stderr.addListener("data", (d) => {
          if (!this.totalFrames) this.getTotalFrames(d);
          const { frame } = this.getCurrentFrame(d);
          if (this.totalFrames) {
            this.progress!.innerHTML =
              JSON.stringify(Math.ceil((frame / this.totalFrames) * 100)) + "%";
          }
        });

        const output = await command.execute();
        if (output.code === 0) {
          this.reset(homeDirPath, fileName as string);
        }
      });
    }
  }

  updateQueue() {
    this.queueContainer.innerHTML = JSON.stringify(this.filePaths, null, " ");
  }

  reset(homeDirPath: string, fileName: string) {
    this.progress.innerHTML = `Compression complete. File was put in ${homeDirPath}\Videos\\${fileName} `;
    this.filePaths = undefined;
    this.totalFrames = undefined;
    this.duration = undefined;
    this.fps = undefined;
    this.queueContainer.innerHTML = "";
  }
}

new VideoCompressor();
