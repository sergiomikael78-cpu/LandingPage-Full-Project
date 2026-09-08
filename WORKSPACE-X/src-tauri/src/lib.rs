mod db;
mod ws_server;

use db::{Database, Workspace, WorkspaceGroup, WorkspaceTab};
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use ws_server::WsServerState;

pub struct AppState {
    pub db: Database,
    pub ws_state: WsServerState,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceDetails {
    pub workspace: Workspace,
    pub groups: Vec<WorkspaceGroup>,
    pub tabs: Vec<WorkspaceTab>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportedWorkspace {
    pub version: String,
    pub workspace: Workspace,
    pub groups: Vec<WorkspaceGroup>,
    pub tabs: Vec<WorkspaceTab>,
}

#[tauri::command]
fn get_workspaces(state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<Workspace>, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.db.get_workspaces().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_workspace_details(
    workspace_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<WorkspaceDetails, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let workspaces = app_state.db.get_workspaces().map_err(|e| e.to_string())?;

    let workspace = workspaces
        .into_iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace with ID {} not found", workspace_id))?;

    let groups = app_state
        .db
        .get_groups_by_workspace(&workspace_id)
        .map_err(|e| e.to_string())?;

    let tabs = app_state
        .db
        .get_tabs_by_workspace(&workspace_id)
        .map_err(|e| e.to_string())?;

    Ok(WorkspaceDetails {
        workspace,
        groups,
        tabs,
    })
}

#[tauri::command]
fn create_workspace(
    name: String,
    description: Option<String>,
    color: Option<String>,
    behavior_mode: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Workspace, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state
        .db
        .create_workspace(&name, description.as_deref(), color.as_deref(), &behavior_mode)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_workspace(
    workspace_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.db.delete_workspace(&workspace_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_group(
    workspace_id: String,
    name: String,
    color: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<WorkspaceGroup, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state
        .db
        .add_group(&workspace_id, &name, &color)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_tab(
    workspace_id: String,
    group_id: Option<String>,
    name: String,
    url: String,
    pinned: bool,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<WorkspaceTab, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state
        .db
        .add_tab(&workspace_id, group_id.as_deref(), &name, &url, pinned)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_tab(tab_id: String, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    app_state.db.delete_tab(&tab_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn launch_workspace(
    workspace_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;

    let workspace = app_state
        .db
        .get_workspaces()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace ID {} not found", workspace_id))?;

    let groups = app_state
        .db
        .get_groups_by_workspace(&workspace_id)
        .map_err(|e| e.to_string())?;

    let tabs = app_state
        .db
        .get_tabs_by_workspace(&workspace_id)
        .map_err(|e| e.to_string())?;

    let groups_payload: Vec<serde_json::Value> = groups
        .iter()
        .map(|g| {
            serde_json::json!({
                "name": g.name,
                "color": g.color,
                "collapsed": g.collapsed_default
            })
        })
        .collect();

    let tabs_payload: Vec<serde_json::Value> = tabs
        .iter()
        .map(|t| {
            let group_name = t
                .group_id
                .as_ref()
                .and_then(|gid| groups.iter().find(|g| g.id == *gid).map(|g| g.name.clone()));

            serde_json::json!({
                "id": t.id,
                "name": t.name,
                "url": t.url,
                "groupName": group_name,
                "pinned": t.pinned
            })
        })
        .collect();

    let msg = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "type": "OPEN_TABS",
        "protocolVersion": "1.0.0",
        "payload": {
            "workspaceId": workspace.id,
            "workspaceName": workspace.name,
            "groups": groups_payload,
            "tabs": tabs_payload
        },
        "timestamp": chrono::Utc::now().timestamp_millis()
    });

    app_state.ws_state.send_message(&msg.to_string())?;
    Ok(())
}

#[tauri::command]
fn end_workspace_session(state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;

    let msg = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "type": "NAVIGATE_LOGOUT",
        "protocolVersion": "1.0.0",
        "payload": {},
        "timestamp": chrono::Utc::now().timestamp_millis()
    });

    app_state.ws_state.send_message(&msg.to_string())?;
    Ok(())
}

#[tauri::command]
async fn fetch_live_browser_state(
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<serde_json::Value, String> {
    let ws_state = {
        let app_state = state.lock().map_err(|e| e.to_string())?;
        app_state.ws_state.clone()
    };

    let req_msg = serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "type": "GET_BROWSER_STATE",
        "protocolVersion": "1.0.0",
        "payload": {},
        "timestamp": chrono::Utc::now().timestamp_millis()
    });

    ws_state.send_message(&req_msg.to_string())?;

    // Wait up to 1.5s for response from extension
    for _ in 0..15 {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if let Some(val) = ws_state.get_browser_state() {
            return Ok(val);
        }
    }

    Err("Timeout waiting for Chrome extension browser state response".to_string())
}

#[tauri::command]
fn export_workspace_json(
    workspace_id: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let workspace = app_state
        .db
        .get_workspaces()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|w| w.id == workspace_id)
        .ok_or_else(|| format!("Workspace ID {} not found", workspace_id))?;

    let groups = app_state
        .db
        .get_groups_by_workspace(&workspace_id)
        .map_err(|e| e.to_string())?;

    let tabs = app_state
        .db
        .get_tabs_by_workspace(&workspace_id)
        .map_err(|e| e.to_string())?;

    let exported = ExportedWorkspace {
        version: "1.0.0".to_string(),
        workspace,
        groups,
        tabs,
    };

    serde_json::to_string_pretty(&exported).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_workspace_json(
    json_str: String,
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<Workspace, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let exported: ExportedWorkspace = serde_json::from_str(&json_str).map_err(|e| format!("Invalid workspace JSON schema: {}", e))?;

    let new_ws = app_state
        .db
        .create_workspace(
            &format!("{} (Imported)", exported.workspace.name),
            exported.workspace.description.as_deref(),
            exported.workspace.color.as_deref(),
            &exported.workspace.behavior_mode,
        )
        .map_err(|e| e.to_string())?;

    let mut group_id_map = std::collections::HashMap::new();

    for group in exported.groups {
        let created_group = app_state
            .db
            .add_group(&new_ws.id, &group.name, &group.color)
            .map_err(|e| e.to_string())?;
        group_id_map.insert(group.id, created_group.id);
    }

    for tab in exported.tabs {
        let target_group_id = tab.group_id.and_then(|gid| group_id_map.get(&gid).cloned());
        app_state
            .db
            .add_tab(&new_ws.id, target_group_id.as_deref(), &tab.name, &tab.url, tab.pinned)
            .map_err(|e| e.to_string())?;
    }

    Ok(new_ws)
}

#[tauri::command]
fn get_extension_status(state: tauri::State<'_, Mutex<AppState>>) -> Result<bool, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    Ok(app_state.ws_state.is_connected.load(Ordering::SeqCst) > 0)
}

#[tauri::command]
fn launch_browser_bridge(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let resource_dir = app_handle.path().resource_dir().map_err(|e| e.to_string())?;
    
    // Tauri bundles "../extension" into "_up_/extension"
    let mut ext_path = resource_dir.join("_up_").join("extension");
    if !ext_path.exists() {
        // Fallback for dev mode
        ext_path = std::env::current_dir().unwrap_or_default().join("extension");
    }
    
    let mut path_str = ext_path.display().to_string();
    if path_str.starts_with("\\\\?\\") {
        path_str = path_str.replace("\\\\?\\", "");
    }
    
    // Gunakan isolated profile agar ekstensi pasti termuat & tidak terblokir oleh menu Profile Picker Chrome
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| "C:\\".to_string());
    let profile_dir = format!("{}\\WorkspaceHub\\ChromeProfile", appdata);
    
    // Gunakan powershell agar aman dari isu parsing quote milik CMD
    let args = format!("Start-Process chrome -ArgumentList '--user-data-dir=\"{}\"', '--load-extension=\"{}\"'", profile_dir, path_str);
    
    std::process::Command::new("powershell")
        .args(["-WindowStyle", "Hidden", "-Command", &args])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(path_str)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_dir = std::env::var("APPDATA")
        .map(|appdata| std::path::PathBuf::from(appdata).join("WorkspaceHub"))
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&db_dir).ok();

    let db_path_buf = db_dir.join("workspace_hub.db");
    let db_path = db_path_buf.to_string_lossy();

    let db = Database::new(&db_path);
    if let Err(err) = db.init() {
        eprintln!("[WorkspaceHub DB] Error initializing SQLite database at {}: {}", db_path, err);
    }

    let ws_state = WsServerState::new();
    let ws_state_clone = ws_state.clone();

    // Spawn WebSocket server task in background
    tauri::async_runtime::spawn(async move {
        ws_server::start_ws_server(ws_state_clone).await;
    });

    let app_state = Mutex::new(AppState { db, ws_state });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_workspaces,
            get_workspace_details,
            create_workspace,
            delete_workspace,
            add_group,
            add_tab,
            delete_tab,
            launch_workspace,
            fetch_live_browser_state,
            export_workspace_json,
            import_workspace_json,
            get_extension_status,
            launch_browser_bridge,
            end_workspace_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
