use std::path::Path;
use std::process::Command;

use serde::Serialize;

use crate::cli::normalize_work_dir;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInspectResult {
    is_git_repo: bool,
    branch: Option<String>,
    resolved_work_dir: String,
}

fn run_git(dir: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn inspect_workspace(work_dir: String) -> Result<WorkspaceInspectResult, String> {
    let path = normalize_work_dir(Some(&work_dir))?
        .ok_or_else(|| "invalid work directory".to_string())?;

    if !path.exists() {
        return Err("work directory does not exist".to_string());
    }
    if !path.is_dir() {
        return Err("work directory is not a folder".to_string());
    }

    let resolved = path.canonicalize().map_err(|e| e.to_string())?;
    let resolved_work_dir = resolved.to_string_lossy().into_owned();

    let repo_output = run_git(&resolved, &["rev-parse", "--is-inside-work-tree"])?;
    let is_git_repo = repo_output.status.success()
        && String::from_utf8_lossy(&repo_output.stdout).trim() == "true";

    let branch = if is_git_repo {
        let branch_output = run_git(&resolved, &["branch", "--show-current"])?;
        let branch_name = String::from_utf8_lossy(&branch_output.stdout)
            .trim()
            .to_string();

        if !branch_name.is_empty() {
            Some(branch_name)
        } else {
            let detached_output = run_git(&resolved, &["rev-parse", "--short", "HEAD"])?;
            let detached_head = String::from_utf8_lossy(&detached_output.stdout)
                .trim()
                .to_string();
            if detached_output.status.success() && !detached_head.is_empty() {
                Some(detached_head)
            } else {
                None
            }
        }
    } else {
        None
    };

    Ok(WorkspaceInspectResult {
        is_git_repo,
        branch,
        resolved_work_dir,
    })
}
