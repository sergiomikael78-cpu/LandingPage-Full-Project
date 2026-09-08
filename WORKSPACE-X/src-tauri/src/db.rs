use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub behavior_mode: String,
    pub browser_preference: Option<String>,
    pub is_favorite: bool,
    pub is_archived: bool,
    pub position: i32,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceGroup {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub color: String,
    pub position: i32,
    pub collapsed_default: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceTab {
    pub id: String,
    pub workspace_id: String,
    pub group_id: Option<String>,
    pub name: String,
    pub url: String,
    pub position: i32,
    pub pinned: bool,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ActiveSessionInfo {
    pub id: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub started_at: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FullBackupWorkspace {
    pub workspace: Workspace,
    pub groups: Vec<WorkspaceGroup>,
    pub tabs: Vec<WorkspaceTab>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FullBackupData {
    pub app: String,
    pub version: String,
    pub exported_at: String,
    pub workspaces: Vec<FullBackupWorkspace>,
    pub extra_data: Option<serde_json::Value>,
}

pub struct Database {
    pub conn_path: String,
}

impl Database {
    pub fn new(db_path: &str) -> Self {
        Database {
            conn_path: db_path.to_string(),
        }
    }

    pub fn init(&self) -> Result<()> {
        let conn = Connection::open(&self.conn_path)?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                icon TEXT,
                color TEXT DEFAULT '#4F46E5',
                behavior_mode TEXT NOT NULL DEFAULT 'static',
                browser_preference TEXT DEFAULT 'Google',
                is_favorite BOOLEAN NOT NULL DEFAULT 0,
                is_archived BOOLEAN NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_used_at DATETIME
            );

            CREATE TABLE IF NOT EXISTS workspace_groups (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT 'grey',
                position INTEGER NOT NULL DEFAULT 0,
                collapsed_default BOOLEAN NOT NULL DEFAULT 0,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS workspace_tabs (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                group_id TEXT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                pinned BOOLEAN NOT NULL DEFAULT 0,
                metadata TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES workspace_groups(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'idle',
                started_at DATETIME,
                ended_at DATETIME,
                error_message TEXT,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
            );

            CREATE TABLE IF NOT EXISTS launch_logs (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                tab_id_ref TEXT NOT NULL,
                status TEXT NOT NULL,
                error_detail TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS application_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            ",
        )?;

        // Seed default CS NIGHT SHIFT workspace if DB is fresh
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM workspaces")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;

        if count == 0 {
            self.seed_default_workspace(&conn)?;
        }

        Ok(())
    }

    fn seed_default_workspace(&self, conn: &Connection) -> Result<()> {
        let ws_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO workspaces (id, name, description, color, behavior_mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                ws_id,
                "CS NIGHT SHIFT",
                "Default workspace for Customer Service night shift duties",
                "#10B981",
                "static",
                now,
                now
            ],
        )?;

        let g1_id = uuid::Uuid::new_v4().to_string();
        let g2_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO workspace_groups (id, workspace_id, name, color, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![g1_id, ws_id, "GOOGLE TOOLS", "blue", 0],
        )?;

        conn.execute(
            "INSERT INTO workspace_groups (id, workspace_id, name, color, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![g2_id, ws_id, "CS DASHBOARDS", "green", 1],
        )?;

        conn.execute(
            "INSERT INTO workspace_tabs (id, workspace_id, group_id, name, url, position, pinned) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![uuid::Uuid::new_v4().to_string(), ws_id, g1_id, "Gmail", "https://mail.google.com", 0, true],
        )?;

        conn.execute(
            "INSERT INTO workspace_tabs (id, workspace_id, group_id, name, url, position, pinned) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![uuid::Uuid::new_v4().to_string(), ws_id, g1_id, "Google Drive", "https://drive.google.com", 1, false],
        )?;

        conn.execute(
            "INSERT INTO workspace_tabs (id, workspace_id, group_id, name, url, position, pinned) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![uuid::Uuid::new_v4().to_string(), ws_id, g2_id, "CS LiveChat", "https://web.whatsapp.com", 0, false],
        )?;

        Ok(())
    }

    pub fn get_workspaces(&self) -> Result<Vec<Workspace>> {
        let conn = Connection::open(&self.conn_path)?;
        let mut stmt = conn.prepare("SELECT id, name, description, icon, color, behavior_mode, browser_preference, is_favorite, is_archived, position, created_at, updated_at, last_used_at FROM workspaces ORDER BY position ASC, created_at DESC")?;

        let workspaces = stmt
            .query_map([], |row| {
                Ok(Workspace {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    icon: row.get(3)?,
                    color: row.get(4)?,
                    behavior_mode: row.get(5)?,
                    browser_preference: row.get(6)?,
                    is_favorite: row.get(7)?,
                    is_archived: row.get(8)?,
                    position: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                    last_used_at: row.get(12)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(workspaces)
    }

    pub fn get_groups_by_workspace(&self, workspace_id: &str) -> Result<Vec<WorkspaceGroup>> {
        let conn = Connection::open(&self.conn_path)?;
        let mut stmt = conn.prepare("SELECT id, workspace_id, name, color, position, collapsed_default FROM workspace_groups WHERE workspace_id = ?1 ORDER BY position ASC")?;

        let groups = stmt
            .query_map([workspace_id], |row| {
                Ok(WorkspaceGroup {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                    position: row.get(4)?,
                    collapsed_default: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(groups)
    }

    pub fn get_tabs_by_workspace(&self, workspace_id: &str) -> Result<Vec<WorkspaceTab>> {
        let conn = Connection::open(&self.conn_path)?;
        let mut stmt = conn.prepare("SELECT id, workspace_id, group_id, name, url, position, pinned, metadata FROM workspace_tabs WHERE workspace_id = ?1 ORDER BY position ASC")?;

        let tabs = stmt
            .query_map([workspace_id], |row| {
                Ok(WorkspaceTab {
                    id: row.get(0)?,
                    workspace_id: row.get(1)?,
                    group_id: row.get(2)?,
                    name: row.get(3)?,
                    url: row.get(4)?,
                    position: row.get(5)?,
                    pinned: row.get(6)?,
                    metadata: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(tabs)
    }

    pub fn create_workspace(&self, name: &str, description: Option<&str>, color: Option<&str>, behavior_mode: &str) -> Result<Workspace> {
        let conn = Connection::open(&self.conn_path)?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO workspaces (id, name, description, color, behavior_mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                name,
                description,
                color.unwrap_or("#6366F1"),
                behavior_mode,
                now,
                now
            ],
        )?;

        Ok(Workspace {
            id,
            name: name.to_string(),
            description: description.map(|s| s.to_string()),
            icon: None,
            color: color.map(|s| s.to_string()),
            behavior_mode: behavior_mode.to_string(),
            browser_preference: Some("Google".to_string()),
            is_favorite: false,
            is_archived: false,
            position: 0,
            created_at: now.clone(),
            updated_at: now,
            last_used_at: None,
        })
    }

    pub fn delete_workspace(&self, workspace_id: &str) -> Result<()> {
        let conn = Connection::open(&self.conn_path)?;
        conn.execute("DELETE FROM workspaces WHERE id = ?1", params![workspace_id])?;
        Ok(())
    }

    pub fn add_group(&self, workspace_id: &str, name: &str, color: &str) -> Result<WorkspaceGroup> {
        let conn = Connection::open(&self.conn_path)?;
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO workspace_groups (id, workspace_id, name, color, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, workspace_id, name, color, 0],
        )?;

        Ok(WorkspaceGroup {
            id,
            workspace_id: workspace_id.to_string(),
            name: name.to_string(),
            color: color.to_string(),
            position: 0,
            collapsed_default: false,
        })
    }

    pub fn add_tab(&self, workspace_id: &str, group_id: Option<&str>, name: &str, url: &str, pinned: bool) -> Result<WorkspaceTab> {
        let conn = Connection::open(&self.conn_path)?;
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO workspace_tabs (id, workspace_id, group_id, name, url, position, pinned) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, workspace_id, group_id, name, url, 0, pinned],
        )?;

        Ok(WorkspaceTab {
            id,
            workspace_id: workspace_id.to_string(),
            group_id: group_id.map(|s| s.to_string()),
            name: name.to_string(),
            url: url.to_string(),
            position: 0,
            pinned,
            metadata: None,
        })
    }

    pub fn delete_tab(&self, tab_id: &str) -> Result<()> {
        let conn = Connection::open(&self.conn_path)?;
        conn.execute("DELETE FROM workspace_tabs WHERE id = ?1", params![tab_id])?;
        Ok(())
    }

    pub fn start_session(&self, workspace_id: &str) -> Result<ActiveSessionInfo> {
        let conn = Connection::open(&self.conn_path)?;
        let now = chrono::Utc::now().to_rfc3339();

        // End any existing active session first
        conn.execute(
            "UPDATE sessions SET state = 'ended', ended_at = ?1 WHERE state = 'active'",
            params![now],
        )?;

        let session_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO sessions (id, workspace_id, state, started_at) VALUES (?1, ?2, 'active', ?3)",
            params![session_id, workspace_id, now],
        )?;

        // Update workspace last_used_at
        conn.execute(
            "UPDATE workspaces SET last_used_at = ?1 WHERE id = ?2",
            params![now, workspace_id],
        )?;

        let mut stmt = conn.prepare("SELECT name FROM workspaces WHERE id = ?1")?;
        let workspace_name: String = stmt.query_row(params![workspace_id], |row| row.get(0))?;

        Ok(ActiveSessionInfo {
            id: session_id,
            workspace_id: workspace_id.to_string(),
            workspace_name,
            started_at: now,
            state: "active".to_string(),
        })
    }

    pub fn get_active_session(&self) -> Result<Option<ActiveSessionInfo>> {
        let conn = Connection::open(&self.conn_path)?;
        let mut stmt = conn.prepare(
            "SELECT s.id, s.workspace_id, w.name, s.started_at, s.state
             FROM sessions s
             JOIN workspaces w ON s.workspace_id = w.id
             WHERE s.state = 'active'
             ORDER BY s.started_at DESC
             LIMIT 1",
        )?;

        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(ActiveSessionInfo {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                workspace_name: row.get(2)?,
                started_at: row.get(3)?,
                state: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn end_active_session(&self) -> Result<()> {
        let conn = Connection::open(&self.conn_path)?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE sessions SET state = 'ended', ended_at = ?1 WHERE state = 'active'",
            params![now],
        )?;
        Ok(())
    }

    pub fn export_full_database(&self) -> Result<FullBackupData> {
        let workspaces = self.get_workspaces()?;
        let mut full_workspaces = Vec::new();

        for ws in workspaces {
            let groups = self.get_groups_by_workspace(&ws.id)?;
            let tabs = self.get_tabs_by_workspace(&ws.id)?;
            full_workspaces.push(FullBackupWorkspace {
                workspace: ws,
                groups,
                tabs,
            });
        }

        Ok(FullBackupData {
            app: "WORKSPACE-X".to_string(),
            version: "2.0.0".to_string(),
            exported_at: chrono::Utc::now().to_rfc3339(),
            workspaces: full_workspaces,
            extra_data: None,
        })
    }

    pub fn import_full_database(&self, backup: FullBackupData, mode: &str) -> Result<()> {
        let mut conn = Connection::open(&self.conn_path)?;
        let tx = conn.transaction()?;

        if mode == "replace" {
            tx.execute("DELETE FROM workspace_tabs", [])?;
            tx.execute("DELETE FROM workspace_groups", [])?;
            tx.execute("DELETE FROM workspaces", [])?;
            tx.execute("DELETE FROM sessions", [])?;
        }

        for item in backup.workspaces {
            let ws = item.workspace;
            let ws_id = if mode == "replace" {
                ws.id
            } else {
                let exists: bool = tx
                    .prepare("SELECT 1 FROM workspaces WHERE id = ?1 OR name = ?2")?
                    .exists(params![ws.id, ws.name])?;
                if exists {
                    uuid::Uuid::new_v4().to_string()
                } else {
                    ws.id
                }
            };

            let ws_name = if mode == "merge" {
                let name_exists: bool = tx
                    .prepare("SELECT 1 FROM workspaces WHERE name = ?1")?
                    .exists(params![ws.name])?;
                if name_exists {
                    format!("{} (Imported)", ws.name)
                } else {
                    ws.name
                }
            } else {
                ws.name
            };

            let now = chrono::Utc::now().to_rfc3339();

            tx.execute(
                "INSERT INTO workspaces (id, name, description, icon, color, behavior_mode, browser_preference, is_favorite, is_archived, position, created_at, updated_at, last_used_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    ws_id,
                    ws_name,
                    ws.description,
                    ws.icon,
                    ws.color.unwrap_or_else(|| "#6366F1".to_string()),
                    ws.behavior_mode,
                    ws.browser_preference,
                    ws.is_favorite,
                    ws.is_archived,
                    ws.position,
                    if ws.created_at.is_empty() { now.clone() } else { ws.created_at },
                    now.clone(),
                    ws.last_used_at,
                ],
            )?;

            let mut group_id_map = std::collections::HashMap::new();

            for group in item.groups {
                let new_group_id = uuid::Uuid::new_v4().to_string();
                group_id_map.insert(group.id, new_group_id.clone());

                tx.execute(
                    "INSERT INTO workspace_groups (id, workspace_id, name, color, position, collapsed_default)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        new_group_id,
                        ws_id,
                        group.name,
                        group.color,
                        group.position,
                        group.collapsed_default,
                    ],
                )?;
            }

            for tab in item.tabs {
                let new_tab_id = uuid::Uuid::new_v4().to_string();
                let mapped_group_id = tab.group_id.as_ref().and_then(|gid| group_id_map.get(gid).cloned());

                tx.execute(
                    "INSERT INTO workspace_tabs (id, workspace_id, group_id, name, url, position, pinned, metadata)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        new_tab_id,
                        ws_id,
                        mapped_group_id,
                        tab.name,
                        tab.url,
                        tab.position,
                        tab.pinned,
                        tab.metadata,
                    ],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
    }
}
