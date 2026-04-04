use std::path::{Path, PathBuf};

pub(crate) fn work_dir_is_safe(path: &str) -> bool {
    !path.is_empty() && !path.contains('\0') && !path.contains('\n') && !path.contains('\r')
}

pub(crate) fn normalize_work_dir(work_dir: Option<&String>) -> Result<Option<PathBuf>, String> {
    match work_dir {
        None => Ok(None),
        Some(path) if path.is_empty() => Ok(None),
        Some(path) => {
            if !work_dir_is_safe(path) {
                return Err("invalid work directory".to_string());
            }

            let path = Path::new(path);
            if path.exists() && !path.is_dir() {
                return Err("work directory is not a folder".to_string());
            }

            Ok(Some(path.to_path_buf()))
        }
    }
}
