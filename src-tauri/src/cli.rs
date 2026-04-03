use std::path::{Path, PathBuf};

/// Only allow canonical UUID strings (prevents shell / AppleScript injection).
fn is_valid_cli_session_uuid(s: &str) -> bool {
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let lens = [8usize, 4, 4, 4, 12];
    for (i, &len) in lens.iter().enumerate() {
        if parts[i].len() != len {
            return false;
        }
        if !parts[i].chars().all(|c| c.is_ascii_hexdigit()) {
            return false;
        }
    }
    true
}

pub(crate) fn work_dir_is_safe(p: &str) -> bool {
    !p.is_empty()
        && !p.contains('\0')
        && !p.contains('\n')
        && !p.contains('\r')
}

pub(crate) fn normalize_work_dir(work_dir: Option<&String>) -> Result<Option<PathBuf>, String> {
    match work_dir {
        None => Ok(None),
        Some(s) if s.is_empty() => Ok(None),
        Some(s) => {
            if !work_dir_is_safe(s) {
                return Err("invalid work directory".to_string());
            }
            let path = Path::new(s);
            if path.exists() && !path.is_dir() {
                return Err("work directory is not a folder".to_string());
            }
            Ok(Some(path.to_path_buf()))
        }
    }
}

/// Escape a string for use inside an AppleScript double-quoted literal.
#[cfg(target_os = "macos")]
fn applescript_escape_double_quoted(s: &str) -> String {
    s.chars()
        .flat_map(|c| match c {
            '\\' => vec!['\\', '\\'],
            '"' => vec!['\\', '"'],
            _ => vec![c],
        })
        .collect()
}

/// Reject obviously invalid PIDs (system / idle). Does not prove the PID belongs to onabreak.
fn validate_kill_pid(pid: u32) -> Result<(), String> {
    if pid == 0 || pid <= 4 {
        return Err("refusing to kill reserved or invalid PID".to_string());
    }
    Ok(())
}

fn kill_process_by_pid(pid: u32) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        let status = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .status()?;
        if !status.success() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("taskkill exited with status {status}"),
            ));
        }
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status();
    }
    Ok(())
}

/// Kill a running CLI process by PID (called from frontend when PTY needs termination).
/// Prefer killing via the PTY plugin; this is a fallback. PID must not be a system-reserved value.
#[tauri::command]
pub async fn kill_cli_process(pid: u32) -> Result<(), String> {
    validate_kill_pid(pid)?;
    kill_process_by_pid(pid).map_err(|e| e.to_string())
}

/// Open a new terminal window running `claude --resume <session_uuid>` in the given work directory.
#[tauri::command]
pub async fn open_terminal_session(
    session_uuid: String,
    work_dir: Option<String>,
) -> Result<(), String> {
    if !is_valid_cli_session_uuid(&session_uuid) {
        return Err("invalid session id".to_string());
    }

    let wd = normalize_work_dir(work_dir.as_ref())?;

    #[cfg(windows)]
    {
        // `session_uuid` is validated as a UUID; safe to embed in the /K command line.
        let cmdline = format!("claude --resume {}", session_uuid);
        let mut cmd = std::process::Command::new("cmd.exe");
        cmd.args(["/C", "start", "cmd.exe", "/K", &cmdline]);
        if let Some(ref path) = wd {
            cmd.current_dir(path);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let script = if let Some(ref path) = wd {
            let p = path
                .to_str()
                .ok_or_else(|| "work directory is not valid UTF-8".to_string())?;
            let p_esc = applescript_escape_double_quoted(p);
            let u_esc = applescript_escape_double_quoted(&session_uuid);
            format!(
                r#"tell application "Terminal" to do script "cd " & quoted form of "{}" & " && claude --resume " & quoted form of "{}""#,
                p_esc, u_esc
            )
        } else {
            let u_esc = applescript_escape_double_quoted(&session_uuid);
            format!(
                r#"tell application "Terminal" to do script "cd ~ && claude --resume " & quoted form of "{}""#,
                u_esc
            )
        };
        std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        let inner = format!("claude --resume {}", session_uuid);
        let terminals = ["x-terminal-emulator", "gnome-terminal", "xterm", "konsole"];
        let mut launched = false;
        for term in &terminals {
            let result = if *term == "gnome-terminal" {
                let mut c = std::process::Command::new(term);
                c.args(["--", "bash", "-c", &inner]);
                if let Some(ref path) = wd {
                    c.current_dir(path);
                }
                c.spawn()
            } else {
                let mut c = std::process::Command::new(term);
                c.args(["-e", "bash", "-c", &inner]);
                if let Some(ref path) = wd {
                    c.current_dir(path);
                }
                c.spawn()
            };
            if result.is_ok() {
                launched = true;
                break;
            }
        }
        if !launched {
            return Err("No supported terminal emulator found".to_string());
        }
    }

    Ok(())
}
