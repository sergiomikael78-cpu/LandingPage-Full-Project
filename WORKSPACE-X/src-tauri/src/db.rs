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
}
