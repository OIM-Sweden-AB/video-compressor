// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn filestat(filename: &str) -> Result<String, String> {
  use std::fs;
  use std::time::{UNIX_EPOCH};
  use std::fmt::{format};

  let metadata = fs::metadata(filename)
      .expect("Failed to stat file");
  let time = metadata.modified()
      .expect("Failed to get mtime");
  let millis = time.duration_since(UNIX_EPOCH)
      .expect("Failed to calculate mtime")
      .as_millis();

  let u64millis = u64::try_from(millis).expect("Integer to large");

  let is_file = if metadata.is_file() { "true" } else { "false" };
  let is_dir = if metadata.is_dir() { "true" } else { "false" };
  let size = metadata.len();

  return Ok(
      format!("{{\"mtime\":{},\"isFile\":{},\"isDir\":{},\"size\":{}}}", u64millis, is_file, is_dir, size)
  )
}

fn main() {
  tauri::Builder::default()
  .invoke_handler(tauri::generate_handler![filestat])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
