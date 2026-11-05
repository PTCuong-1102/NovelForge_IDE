use git2::{IndexAddOption, Oid, Repository, Signature};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitError {
    pub kind: String,
    pub message: String,
}

impl std::fmt::Display for GitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.kind, self.message)
    }
}

impl std::error::Error for GitError {}

impl GitError {
    fn new(kind: &str, message: impl Into<String>) -> Self {
        GitError {
            kind: kind.to_string(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorySnapshot {
    pub id: String,               // Full commit OID (round-trips with Oid::from_str)
    pub commit_oid: Option<String>,
    pub branch_name: String,
    pub label: String,
    pub timestamp: String,
    pub word_count_delta: i32,
    pub total_words: usize,
}

fn count_words_in_dir(dir: &Path) -> usize {
    let mut total = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                total += count_words_in_dir(&path);
            } else if path.extension().map_or(false, |ext| ext == "md") {
                if let Ok(content) = std::fs::read_to_string(&path) {
                    total += content.split_whitespace().count();
                }
            }
        }
    }
    total
}

fn snapshot_words(msg: &str) -> Option<usize> {
    msg.lines()
        .find_map(|l| l.trim().strip_prefix("NovelForge-Words:"))
        .and_then(|v| v.trim().parse::<usize>().ok())
}

fn open_repo(project_root: &str) -> Result<Repository, GitError> {
    Repository::discover(Path::new(project_root)).map_err(|e| {
        GitError::new(
            "NOT_A_REPO",
            format!("Directory is not a git repository: {e}"),
        )
    })
}

/// Find the most recent snapshot commit reachable from HEAD.
/// Returns (commit, parsed total_words).
fn latest_snapshot(repo: &Repository) -> Option<(git2::Commit<'_>, Option<usize>)> {
    let head_oid = repo.head().ok()?.target()?;
    let mut revwalk = repo.revwalk().ok()?;
    revwalk.push(head_oid).ok()?;
    for oid in revwalk.flatten() {
        if let Ok(commit) = repo.find_commit(oid) {
            if let Some(msg) = commit.message() {
                if msg.contains("NovelForge-Snapshot: true") {
                    let words = snapshot_words(msg);
                    return Some((commit, words));
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn create_snapshot(
    project_root: String,
    branch_name: Option<String>,
    label: String,
) -> Result<StorySnapshot, GitError> {
    let root = Path::new(&project_root);
    let repo = open_repo(&project_root)?;

    let manuscript_dir = root.join("manuscript");
    let lorebook_dir = root.join("lorebook");
    if !manuscript_dir.exists() && !lorebook_dir.exists() {
        return Err(GitError::new(
            "NO_CONTENT",
            "Neither manuscript/ nor lorebook/ exists in the project root.",
        ));
    }

    let mut index = repo
        .index()
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    // Stage manuscript and lorebook only; never touch anything else.
    index
        .add_all(["manuscript", "lorebook"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;
    index
        .write()
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    let tree_id = index
        .write_tree()
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    // Nothing-to-commit guard: same tree as parent => reuse, do not create empty snapshot.
    if let Some(parent) = &parent_commit {
        if parent.tree_id() == tree_id {
            return Err(GitError::new(
                "NOTHING_TO_COMMIT",
                "No changes in manuscript/ or lorebook/ since the last commit.",
            ));
        }
    }

    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    let sig = Signature::now("NovelForge Author", "author@novelforge.local")
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    let total_words = count_words_in_dir(&manuscript_dir);
    let prev_words = latest_snapshot(&repo).and_then(|(_, w)| w).unwrap_or(0);
    let word_count_delta = (total_words as i64 - prev_words as i64) as i32;

    let commit_message = format!(
        "snapshot: {}\n\nNovelForge-Snapshot: true\nNovelForge-Words: {}",
        label.trim(),
        total_words
    );

    let parents: Vec<&git2::Commit> = match &parent_commit {
        Some(c) => vec![c],
        None => vec![],
    };

    let commit_id = repo
        .commit(Some("HEAD"), &sig, &sig, &commit_message, &tree, &parents)
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    let current_branch = branch_name.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "main".to_string())
    });

    Ok(StorySnapshot {
        id: commit_id.to_string(),
        commit_oid: Some(commit_id.to_string()),
        branch_name: current_branch,
        label,
        timestamp: chrono::Utc::now().to_rfc3339(),
        word_count_delta,
        total_words,
    })
}

#[tauri::command]
pub fn list_snapshots(project_root: String) -> Result<Vec<StorySnapshot>, GitError> {
    let repo = open_repo(&project_root)?;

    let head = match repo.head() {
        Ok(h) => h,
        // Unborn HEAD: repository exists but has no commits yet.
        Err(_) => return Ok(Vec::new()),
    };

    let head_oid = match head.target() {
        Some(oid) => oid,
        None => return Ok(Vec::new()),
    };

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    revwalk
        .push(head_oid)
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    let branch_name = head.shorthand().unwrap_or("main").to_string();
    let mut snapshots = Vec::new();
    let mut prev_words_for_delta: Option<usize> = None;

    for oid_res in revwalk {
        let oid = match oid_res {
            Ok(o) => o,
            Err(_) => continue,
        };
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let msg = match commit.message() {
            Some(m) => m,
            None => continue,
        };
        if !msg.contains("NovelForge-Snapshot: true") {
            continue;
        }

        let label = msg
            .lines()
            .next()
            .unwrap_or("")
            .replace("snapshot:", "")
            .trim()
            .to_string();

        let time_str = chrono::DateTime::from_timestamp(commit.time().seconds(), 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_else(|| "".to_string());

        let total_words = snapshot_words(msg).unwrap_or(0);
        let word_count_delta = match prev_words_for_delta {
            Some(newer) => (total_words as i64 - newer as i64) as i32,
            None => 0,
        };
        prev_words_for_delta = Some(total_words);

        snapshots.push(StorySnapshot {
            id: oid.to_string(),
            commit_oid: Some(oid.to_string()),
            branch_name: branch_name.clone(),
            label,
            timestamp: time_str,
            word_count_delta,
            total_words,
        });
    }

    Ok(snapshots)
}

#[tauri::command]
pub fn restore_snapshot(
    project_root: String,
    snapshot_id: String,
    confirm: bool,
) -> Result<(), GitError> {
    if !confirm {
        return Err(GitError::new(
            "CONFIRM_REQUIRED",
            "Explicit confirmation is required to restore a snapshot.",
        ));
    }

    let repo = open_repo(&project_root)?;

    // Accept either a full OID or the legacy 8-char prefix produced by older builds.
    let raw = snapshot_id.trim_start_matches("snap-");
    let commit = if raw.len() == 40 {
        let oid = Oid::from_str(raw)
            .map_err(|e| GitError::new("INVALID_OID", e.to_string()))?;
        repo.find_commit(oid)
            .map_err(|e| GitError::new("COMMIT_NOT_FOUND", e.to_string()))?
    } else {
        let mut revwalk = repo
            .revwalk()
            .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;
        let head_oid = repo
            .head()
            .ok()
            .and_then(|h| h.target())
            .ok_or_else(|| GitError::new("UNBORN_HEAD", "Repository has no commits."))?;
        revwalk
            .push(head_oid)
            .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;
        let mut found = None;
        for oid in revwalk.flatten() {
            if oid.to_string().starts_with(raw) {
                if let Ok(c) = repo.find_commit(oid) {
                    if c.message().map_or(false, |m| m.contains("NovelForge-Snapshot: true")) {
                        found = Some(c);
                        break;
                    }
                }
            }
        }
        found.ok_or_else(|| {
            GitError::new("COMMIT_NOT_FOUND", "No snapshot commit matches the given id.")
        })?
    };

    let tree = commit
        .tree()
        .map_err(|e| GitError::new("GIT_FAILURE", e.to_string()))?;

    // Safe restore: overwrite only files tracked under manuscript/ and lorebook/
    // from the snapshot tree. Never moves HEAD, never touches other paths,
    // never deletes untracked files.
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force().path("manuscript").path("lorebook");

    repo.checkout_tree(tree.as_object(), Some(&mut checkout))
        .map_err(|e| GitError::new("RESTORE_FAILED", e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_repo() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let repo = Repository::init(dir.path()).unwrap();
        // Seed an initial commit so HEAD exists.
        fs::create_dir_all(dir.path().join("manuscript")).unwrap();
        fs::write(dir.path().join("manuscript/ch-01.md"), "alpha beta\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("manuscript/ch-01.md")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = Signature::now("Test", "test@test").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();
        dir
    }

    #[test]
    fn create_snapshot_fails_outside_repo() {
        let dir = tempfile::tempdir().unwrap();
        let err = create_snapshot(
            dir.path().to_string_lossy().to_string(),
            None,
            "test snapshot".to_string(),
        )
        .unwrap_err();
        assert_eq!(err.kind, "NOT_A_REPO");
    }

    #[test]
    fn create_and_list_roundtrip() {
        let dir = setup_repo();
        let root = dir.path().to_string_lossy().to_string();

        fs::write(dir.path().join("manuscript/ch-01.md"), "alpha beta gamma\n").unwrap();
        let snap = create_snapshot(root.clone(), None, "rev one".to_string()).unwrap();
        assert_eq!(snap.total_words, 3);
        assert_eq!(snap.id.len(), 40);

        let list = list_snapshots(root.clone()).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].label, "rev one");
        assert_eq!(list[0].total_words, 3);
    }

    #[test]
    fn create_snapshot_rejects_empty_commit() {
        let dir = setup_repo();
        let root = dir.path().to_string_lossy().to_string();
        let err = create_snapshot(root, None, "no changes".to_string()).unwrap_err();
        assert_eq!(err.kind, "NOTHING_TO_COMMIT");
    }

    #[test]
    fn restore_requires_confirm() {
        let dir = setup_repo();
        let root = dir.path().to_string_lossy().to_string();
        fs::write(dir.path().join("manuscript/ch-01.md"), "alpha beta gamma\n").unwrap();
        let snap = create_snapshot(root.clone(), None, "rev one".to_string()).unwrap();
        let err = restore_snapshot(root, snap.id, false).unwrap_err();
        assert_eq!(err.kind, "CONFIRM_REQUIRED");
    }

    #[test]
    fn restore_only_touches_manuscript() {
        let dir = setup_repo();
        let root = dir.path().to_string_lossy().to_string();
        fs::write(dir.path().join("notes.txt"), "keep me\n").unwrap();

        fs::write(dir.path().join("manuscript/ch-01.md"), "alpha beta gamma delta\n").unwrap();
        let snap = create_snapshot(root.clone(), None, "rev one".to_string()).unwrap();

        // Mutate manuscript and an unrelated file.
        fs::write(dir.path().join("manuscript/ch-01.md"), "changed\n").unwrap();
        fs::write(dir.path().join("notes.txt"), "do not touch\n").unwrap();

        restore_snapshot(root, snap.id, true).unwrap();

        let restored = fs::read_to_string(dir.path().join("manuscript/ch-01.md")).unwrap();
        assert_eq!(restored.trim(), "alpha beta gamma delta");
        assert_eq!(fs::read_to_string(dir.path().join("notes.txt")).unwrap(), "do not touch\n");
    }
}
