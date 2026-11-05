use git2::{IndexAddOption, Oid, Repository, ResetType, Signature};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorySnapshot {
    pub id: String,
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

#[tauri::command]
pub fn create_snapshot(
    project_root: String,
    branch_name: Option<String>,
    label: String,
) -> Result<StorySnapshot, GitError> {
    let root = Path::new(&project_root);
    let repo = Repository::discover(root).map_err(|e| GitError {
        kind: "NOT_A_REPO".to_string(),
        message: format!("Directory is not a git repository: {}", e),
    })?;

    let mut index = repo.index().map_err(|e| GitError {
        kind: "GIT_FAILURE".to_string(),
        message: e.to_string(),
    })?;

    // Stage manuscript and lorebook directories if they exist
    let _ = index.add_all(["manuscript", "lorebook"].iter(), IndexAddOption::DEFAULT, None);
    let _ = index.write();

    let tree_id = index.write_tree().map_err(|e| GitError {
        kind: "GIT_FAILURE".to_string(),
        message: e.to_string(),
    })?;

    let tree = repo.find_tree(tree_id).map_err(|e| GitError {
        kind: "GIT_FAILURE".to_string(),
        message: e.to_string(),
    })?;

    let sig = Signature::now("NovelForge Author", "author@novelforge.local").map_err(|e| {
        GitError {
            kind: "GIT_FAILURE".to_string(),
            message: e.to_string(),
        }
    })?;

    let parent_commit = match repo.head() {
        Ok(head_ref) => head_ref.peel_to_commit().ok(),
        Err(_) => None,
    };

    let parents: Vec<&git2::Commit> = match &parent_commit {
        Some(c) => vec![c],
        None => vec![],
    };

    let commit_message = format!("snapshot: {}\n\nNovelForge-Snapshot: true", label.trim());

    let commit_id = repo
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            &commit_message,
            &tree,
            &parents,
        )
        .map_err(|e| GitError {
            kind: "GIT_FAILURE".to_string(),
            message: e.to_string(),
        })?;

    let current_branch = branch_name.unwrap_or_else(|| {
        repo.head()
            .ok()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
            .unwrap_or_else(|| "main".to_string())
    });

    let manuscript_dir = root.join("manuscript");
    let current_words = count_words_in_dir(&manuscript_dir);

    Ok(StorySnapshot {
        id: format!("snap-{}", &commit_id.to_string()[..8]),
        commit_oid: Some(commit_id.to_string()),
        branch_name: current_branch,
        label,
        timestamp: chrono::Utc::now().to_rfc3339(),
        word_count_delta: 0,
        total_words: current_words,
    })
}

#[tauri::command]
pub fn list_snapshots(project_root: String) -> Result<Vec<StorySnapshot>, GitError> {
    let root = Path::new(&project_root);
    let repo = Repository::discover(root).map_err(|e| GitError {
        kind: "NOT_A_REPO".to_string(),
        message: format!("Directory is not a git repository: {}", e),
    })?;

    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(Vec::new()),
    };

    let head_oid = match head.target() {
        Some(oid) => oid,
        None => return Ok(Vec::new()),
    };

    let mut revwalk = repo.revwalk().map_err(|e| GitError {
        kind: "GIT_FAILURE".to_string(),
        message: e.to_string(),
    })?;

    revwalk.push(head_oid).map_err(|e| GitError {
        kind: "GIT_FAILURE".to_string(),
        message: e.to_string(),
    })?;

    let branch_name = head.shorthand().unwrap_or("main").to_string();
    let mut snapshots = Vec::new();

    for oid_res in revwalk {
        if let Ok(oid) = oid_res {
            if let Ok(commit) = repo.find_commit(oid) {
                if let Some(msg) = commit.message() {
                    if msg.contains("NovelForge-Snapshot: true") {
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

                        snapshots.push(StorySnapshot {
                            id: format!("snap-{}", &oid.to_string()[..8]),
                            commit_oid: Some(oid.to_string()),
                            branch_name: branch_name.clone(),
                            label,
                            timestamp: time_str,
                            word_count_delta: 0,
                            total_words: 0,
                        });
                    }
                }
            }
        }
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
        return Err(GitError {
            kind: "CONFIRM_REQUIRED".to_string(),
            message: "Explicit confirmation is required to restore a snapshot.".to_string(),
        });
    }

    let root = Path::new(&project_root);
    let repo = Repository::discover(root).map_err(|e| GitError {
        kind: "NOT_A_REPO".to_string(),
        message: format!("Directory is not a git repository: {}", e),
    })?;

    let oid_str = snapshot_id.trim_start_matches("snap-");
    let oid = Oid::from_str(oid_str).map_err(|e| GitError {
        kind: "INVALID_OID".to_string(),
        message: e.to_string(),
    })?;

    let commit = repo.find_commit(oid).map_err(|e| GitError {
        kind: "COMMIT_NOT_FOUND".to_string(),
        message: e.to_string(),
    })?;

    repo.reset(commit.as_object(), ResetType::Hard, None)
        .map_err(|e| GitError {
            kind: "RESTORE_FAILED".to_string(),
            message: e.to_string(),
        })?;

    Ok(())
}
