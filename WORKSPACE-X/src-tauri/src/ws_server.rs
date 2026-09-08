use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::Mutex as StdMutex;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;

#[derive(Clone)]
pub struct WsServerState {
    pub is_connected: Arc<AtomicUsize>,
    pub tx: broadcast::Sender<String>,
    pub latest_browser_state: Arc<StdMutex<Option<Value>>>,
}

impl WsServerState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            is_connected: Arc::new(AtomicUsize::new(0)),
            tx,
            latest_browser_state: Arc::new(StdMutex::new(None)),
        }
    }

    pub fn send_message(&self, message: &str) -> Result<usize, String> {
        self.tx.send(message.to_string()).map_err(|e| e.to_string())
    }

    pub fn set_browser_state(&self, val: Value) {
        if let Ok(mut state) = self.latest_browser_state.lock() {
            *state = Some(val);
        }
    }

    pub fn get_browser_state(&self) -> Option<Value> {
        if let Ok(state) = self.latest_browser_state.lock() {
            state.clone()
        } else {
            None
        }
    }
}

pub async fn start_ws_server(state: WsServerState) {
    let addr = "127.0.0.1:9001";
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[WorkspaceHub Server] Failed to bind WebSocket server on {}: {}", addr, e);
            return;
        }
    };

    println!("[WorkspaceHub Server] WebSocket server listening on {}", addr);

    while let Ok((stream, peer_addr)) = listener.accept().await {
        println!("[WorkspaceHub Server] Incoming connection from: {}", peer_addr);
        let state_clone = state.clone();
        let mut rx = state.tx.subscribe();

        tokio::spawn(async move {
            let ws_stream = match accept_async(stream).await {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[WorkspaceHub Server] Error during WebSocket handshake: {}", e);
                    return;
                }
            };

            println!("[WorkspaceHub Server] Extension WebSocket handshake successful.");
            state_clone.is_connected.fetch_add(1, Ordering::SeqCst);

            let (mut write, mut read) = ws_stream.split();

            loop {
                tokio::select! {
                    // Forward outgoing messages from Rust/Tauri to Extension
                    Ok(out_msg) = rx.recv() => {
                        println!("[WorkspaceHub Server] Forwarding message to Extension: {}", out_msg);
                        let _ = write.send(tokio_tungstenite::tungstenite::Message::Text(out_msg)).await;
                    }
                    // Handle incoming messages from Extension to Rust
                    Some(msg) = read.next() => {
                        match msg {
                            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                println!("[WorkspaceHub Server] Received message: {}", text);

                                if let Ok(v) = serde_json::from_str::<Value>(&text) {
                                    if let Some(msg_type) = v.get("type").and_then(|t| t.as_str()) {
                                        if msg_type == "PING" {
                                            let pong = serde_json::json!({
                                                "id": v.get("id").unwrap_or(&serde_json::Value::Null),
                                                "type": "PONG",
                                                "protocolVersion": "1.0.0",
                                                "payload": { "status": "ALIVE" },
                                                "timestamp": chrono::Utc::now().timestamp_millis()
                                            });

                                            let _ = write
                                                .send(tokio_tungstenite::tungstenite::Message::Text(
                                                    pong.to_string(),
                                                ))
                                                .await;
                                        } else if msg_type == "BROWSER_STATE_RESPONSE" {
                                            if let Some(payload) = v.get("payload") {
                                                state_clone.set_browser_state(payload.clone());
                                            }
                                        }
                                    }
                                }
                            }
                            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                                println!("[WorkspaceHub Server] Connection closed by extension.");
                                break;
                            }
                            Err(e) => {
                                eprintln!("[WorkspaceHub Server] Error reading message: {}", e);
                                break;
                            }
                            _ => {}
                        }
                    }
                    else => break,
                }
            }

            state_clone.is_connected.fetch_sub(1, Ordering::SeqCst);
            println!("[WorkspaceHub Server] Client disconnected.");
        });
    }
}
