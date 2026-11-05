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

    // If file exists, canonicalize target; if not, canonicalize parent and re-append filename
    let final_path = if normalized.exists() {
        normalized
            .canonicalize()
            .map_err(|e| FsError::Io(e.to_string()))?
    } else {
        let parent = normalized
            .parent()
            .ok_or(FsError::OutsideProjectRoot)?;
        if parent.exists() {
            let canon_parent = parent
                .canonicalize()
                .map_err(|e| FsError::Io(e.to_string()))?;
            let file_name = normalized
                .file_name()
                .ok_or(FsError::OutsideProjectRoot)?;
            canon_parent.join(file_name)
        } else {
            normalized
        }
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
}
