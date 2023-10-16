import "./style.css";
import { Command } from "@tauri-apps/api/shell";
import { homeDir } from "@tauri-apps/api/path";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api";

interface LiveData {
  frame: number;
  fps: number;
  bitrate: number;
}

interface FileData {
  before: string;
  after: string;
}

async function render(): Promise<HTMLDivElement> {
  return new Promise(async (resolve) => {
    const app = document.querySelector<HTMLDivElement>("#app")!;
    app.innerHTML = `
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
      <div id="fileStats"></div>
      <div id="progress"></div>
      <div id="log"></div>
      </div>
    </div>
  `;
    resolve(app);
  });
}

export default class VideoCompressor {
  public button: HTMLButtonElement;
  public errorMsg: HTMLParagraphElement;
  public queueContainer: HTMLDivElement;
  public progress: HTMLDivElement;
  public log: HTMLDivElement;
  public fileStats: HTMLDivElement;

  public filePaths?: string[];
  public totalFrames?: number;
  public duration?: string;
  public fps?: number;
  public liveData: LiveData = {
    frame: 0,
    fps: 0,
    bitrate: 0,
  };
  public fileData: FileData;
  public retries = 0;

  constructor(app: HTMLDivElement) {
    this.button = app.querySelector<HTMLButtonElement>("#start")!;
    this.errorMsg = app.querySelector<HTMLParagraphElement>("#errorMsg")!;
    this.progress = app.querySelector<HTMLDivElement>("#progress")!;
    this.queueContainer = app.querySelector<HTMLDivElement>("#queue")!;
    this.log = app.querySelector<HTMLDivElement>("#log")!;
    this.fileStats = app.querySelector<HTMLDivElement>("#fileStats")!;
    this.fileData = { before: "", after: "" };
    this.init();
  }

  init() {
    this.addEventListeners();
  }

  errorHandler(error: string) {
    this.errorMsg!.innerHTML = error;
    throw new Error(error);
  }

  addEventListeners() {
    this.button?.addEventListener("click", this.startCompression.bind(this));
    listen("tauri://file-drop", async (event) => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      let file = event.payload as string[];
      tauriFileStat(file[0]).then((file) => {
        this.fileData.before = formatBytes(file.size);
        this.filePaths = event.payload as string[];
        this.reRender();
      });
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
    this.log.innerHTML = JSON.stringify(this.liveData);
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
          tauriFileStat(`${homeDirPath}\Videos\\${fileName}`).then((file) => {
            this.fileData.after = formatBytes(file.size);
            this.reset(homeDirPath, fileName as string);
          });
        }
      });
    }
  }

  reRender() {
    this.queueContainer!.innerHTML = JSON.stringify(this.filePaths, null, " ");
    this.fileStats.innerHTML = "Before: " + this.fileData.before;
  }

  reset(homeDirPath: string, fileName: string) {
    this.fileStats.innerHTML += " After: " + this.fileData.after;
    this.progress!.innerHTML = `Compression complete. File was put in ${homeDirPath}\Videos\\${fileName} `;
    this.filePaths = undefined;
    this.totalFrames = undefined;
    this.duration = undefined;
    this.fps = undefined;
    this.queueContainer!.innerHTML = "";
  }
}

render().then((app) => new VideoCompressor(app));

export interface TauriFileStat {
  mtime: number;
  /* Is this a directory. */
  isDir: boolean;
  /* Is this a regular file. */
  isFile: boolean;
  /* File size in bytes. */
  size: number;
}

async function tauriFileStat(filename: string): Promise<TauriFileStat> {
  const x = await invoke("filestat", { filename });
  return JSON.parse(x as string) as TauriFileStat;
}

function formatBytes(a: number, b = 2) {
  if (!+a) return "0 Bytes";
  const c = 0 > b ? 0 : b,
    d = Math.floor(Math.log(a) / Math.log(1024));
  return `${parseFloat((a / Math.pow(1024, d)).toFixed(c))} ${
    ["Bytes", "KiB", "MiB", "GiB", "TiB"][d]
  }`;
}
