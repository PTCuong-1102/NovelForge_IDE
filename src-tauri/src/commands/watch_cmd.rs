use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// The event the frontend listens to when a project file appears, moves or is removed.
pub const PROJECT_FILES_CHANGED: &str = "novelforge:project-files-changed";

/// Holds the active watcher so it can be replaced when the project changes.
#[derive(Default)]
pub struct ProjectWatcher(pub Mutex<Option<RecommendedWatcher>>);

#[tauri::command]
pub async fn start_project_watcher(
    app: AppHandle,
    state: tauri::State<'_, ProjectWatcher>,
    project_root: String,
) -> Result<(), String> {
    let root = PathBuf::from(&project_root);
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    // Replace any watcher of a previous project.
    *guard = None;

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else { return };
        let interesting = matches!(
            event.kind,
            EventKind::Create(_) | EventKind::Remove(_) | EventKind::Modify(_)
        );
        if interesting {
            let _ = app_handle.emit(PROJECT_FILES_CHANGED, ());
        }
    })
    .map_err(|e| e.to_string())?;

    for dir in ["manuscript", "lorebook"] {
        let path = root.join(dir);
        if path.exists() {
            watcher
                .watch(&path, RecursiveMode::Recursive)
                .map_err(|e| e.to_string())?;
        }
    }

    *guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub async fn stop_project_watcher(
    state: tauri::State<'_, ProjectWatcher>,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn the_watcher_announces_a_new_file() {
        let dir = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::channel();
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
                let _ = tx.send(result);
            })
            .unwrap();
        watcher
            .watch(dir.path(), RecursiveMode::NonRecursive)
            .unwrap();

        std::fs::write(dir.path().join("moi.md"), "nội dung").unwrap();

        let event = rx
            .recv_timeout(Duration::from_secs(5))
            .expect("the watcher must report the new file");
        assert!(event.is_ok(), "the watcher must report a valid event");
    }
}
