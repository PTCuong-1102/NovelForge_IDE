use serde::Serialize;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "type", content = "message")]
pub enum FsError {
    OutsideProjectRoot,
    NotFound,
    Io(String),
}

impl std::fmt::Display for FsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FsError::OutsideProjectRoot => write!(f, "Path is outside the canonical project root"),
            FsError::NotFound => write!(f, "Target file or directory not found"),
            FsError::Io(msg) => write!(f, "IO Error: {}", msg),
        }
    }
}

impl std::error::Error for FsError {}

/// Resolves a candidate path against a project root, preventing path traversal attacks.
/// Ensures the resolved target strictly resides within root.
pub fn canonical_within(root: &Path, candidate: &Path) -> Result<PathBuf, FsError> {
    let canonical_root = root
        .canonicalize()
        .map_err(|e| FsError::Io(format!("Invalid root: {}", e)))?;

    // The git and internal index directories of a project are never a valid write target.
    for comp in candidate.components() {
        if let Component::Normal(os) = comp {
            let name = os.to_string_lossy();
            if name.eq_ignore_ascii_case(".git") || name.eq_ignore_ascii_case(".novelforge") {
                return Err(FsError::OutsideProjectRoot);
            }
        }
    }

    // Combine candidate if relative, or inspect if absolute
    let target = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        canonical_root.join(candidate)
    };

    // Normalize path by eliminating '.' and '..' components
    let mut normalized = PathBuf::new();
    for comp in target.components() {
        match comp {
            Component::Prefix(p) => normalized.push(Component::Prefix(p)),
            Component::RootDir => normalized.push(Component::RootDir),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return Err(FsError::OutsideProjectRoot);
                }
            }
            Component::Normal(c) => normalized.push(c),
        }
    }

    // If file exists, canonicalize target; if not, resolve the nearest existing
    // ancestor and re-attach the missing tail (a symlinked parent must not escape).
    let final_path = if normalized.exists() {
        normalized
            .canonicalize()
            .map_err(|e| FsError::Io(e.to_string()))?
    } else {
        let mut tail: Vec<std::ffi::OsString> = Vec::new();
        if let Some(name) = normalized.file_name() {
            tail.push(name.to_os_string());
        }
        let mut current = normalized.parent();
        let mut resolved: Option<PathBuf> = None;
        while let Some(dir) = current {
            match dir.canonicalize() {
                Ok(canon) => {
                    resolved = Some(canon);
                    break;
                }
                Err(_) => {
                    let Some(name) = dir.file_name() else {
                        break;
                    };
                    tail.push(name.to_os_string());
                    current = dir.parent();
                }
            }
        }
        let mut out = resolved.ok_or(FsError::OutsideProjectRoot)?;
        for part in tail.iter().rev() {
            out.push(part);
        }
        out
    };

    // Verify final path starts with canonical root
    if !final_path.starts_with(&canonical_root) {
        return Err(FsError::OutsideProjectRoot);
    }

    Ok(final_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_accepts_path_inside_project_root() {
        let temp = std::env::temp_dir().join("nf_test_inside");
        let _ = fs::create_dir_all(&temp);
        let file = temp.join("ch-01.md");
        let _ = fs::write(&file, "test");

        let res = canonical_within(&temp, Path::new("ch-01.md"));
        assert!(res.is_ok());

        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn test_rejects_path_outside_project_root() {
        let temp = std::env::temp_dir().join("nf_test_outside");
        let _ = fs::create_dir_all(&temp);

        let malicious = Path::new("..").join("secret.txt");
        let res = canonical_within(&temp, &malicious);
        assert_eq!(res, Err(FsError::OutsideProjectRoot));

        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn test_rejects_dot_git_directory_access() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join(".git/hooks")).unwrap();

        let res = canonical_within(temp.path(), Path::new(".git/hooks/pre-commit"));
        assert_eq!(res, Err(FsError::OutsideProjectRoot));

        let res = canonical_within(temp.path(), Path::new(".git"));
        assert_eq!(res, Err(FsError::OutsideProjectRoot));
    }

    #[test]
    fn test_rejects_symlinked_parent_for_missing_file() {
        let temp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), temp.path().join("link")).unwrap();

        // The file does not exist yet, but its parent is a symlink out of the root.
        let res = canonical_within(temp.path(), Path::new("link/sub/new-file.md"));
        assert_eq!(res, Err(FsError::OutsideProjectRoot));
    }

    #[test]
    fn test_accepts_missing_file_under_missing_directory_inside_root() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join("manuscript")).unwrap();

        let res = canonical_within(temp.path(), Path::new("manuscript/act-99/ch-99.md"));
        assert!(res.is_ok(), "expected Ok, got {:?}", res.err());
        assert!(res.unwrap().ends_with("manuscript/act-99/ch-99.md"));
    }
}
