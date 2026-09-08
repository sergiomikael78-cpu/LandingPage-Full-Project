import { TabDefinition, TabGroupDefinition, BrowserTabState, BrowserGroupState } from "../shared/message-schema";

export class TabController {
  /**
   * Queries all open tabs and tab groups in current window or all windows.
   */
  static async getCurrentBrowserState(): Promise<{ tabs: BrowserTabState[]; groups: BrowserGroupState[] }> {
    const rawTabs = await chrome.tabs.query({});
    const tabs: BrowserTabState[] = rawTabs.map((t) => ({
      id: t.id ?? -1,
      windowId: t.windowId,
      title: t.title ?? "",
      url: t.url ?? "",
      pinned: t.pinned ?? false,
      groupId: t.groupId ?? -1,
      index: t.index,
    }));

    let groups: BrowserGroupState[] = [];
    if (chrome.tabGroups) {
      try {
        const rawGroups = await chrome.tabGroups.query({});
        groups = rawGroups.map((g) => ({
          id: g.id,
          title: g.title ?? "",
          color: g.color ?? "grey",
          collapsed: g.collapsed ?? false,
        }));
      } catch (err) {
        console.warn("chrome.tabGroups query error or not supported:", err);
      }
    }

    return { tabs, groups };
  }

  static async launchWorkspace(
    groupsDef: TabGroupDefinition[],
    tabsDef: TabDefinition[],
    onProgress?: (total: number, opened: number, currentUrl: string) => void
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    const createdGroupsMap = new Map<string, number>();
    const groupWindowMap = new Map<string, number>();

    // 1. Default Target window for ungrouped tabs
    const currentWindow = await chrome.windows.getCurrent();
    const defaultWindowId = currentWindow.id;

    let openedCount = 0;
    const totalCount = tabsDef.length;

    // 2. Open tabs and organize by group (each group in a new window)
    for (const tabDef of tabsDef) {
      try {
        if (!tabDef.url || !tabDef.url.startsWith("http")) {
          errors.push(`Invalid URL skipped: ${tabDef.url}`);
          continue;
        }

        let createdTabId: number | undefined;
        let targetWindowId = defaultWindowId;

        if (tabDef.groupName && chrome.tabGroups) {
          let savedWindowId = groupWindowMap.get(tabDef.groupName);
          if (savedWindowId === undefined) {
            // Create a new window for the first tab of this group
            const newWin = await chrome.windows.create({ 
              url: tabDef.url,
              state: "maximized"
            });
            savedWindowId = newWin.id;
            if (savedWindowId) {
              groupWindowMap.set(tabDef.groupName, savedWindowId);
            }
            if (newWin.tabs && newWin.tabs.length > 0) {
              createdTabId = newWin.tabs[0].id;
              if (tabDef.pinned && createdTabId) {
                await chrome.tabs.update(createdTabId, { pinned: true });
              }
            }
          } else {
            // Window already exists for this group, create tab in it
            targetWindowId = savedWindowId;
            const createdTab = await chrome.tabs.create({
              windowId: targetWindowId,
              url: tabDef.url,
              pinned: tabDef.pinned ?? false,
              active: false,
            });
            createdTabId = createdTab.id;
          }
        } else {
          // No group, create in default window
          const createdTab = await chrome.tabs.create({
            windowId: defaultWindowId,
            url: tabDef.url,
            pinned: tabDef.pinned ?? false,
            active: false,
          });
          createdTabId = createdTab.id;
        }

        openedCount++;
        if (onProgress) {
          onProgress(totalCount, openedCount, tabDef.url);
        }

        // Group management
        if (tabDef.groupName && createdTabId && chrome.tabGroups) {
          try {
            let groupId = createdGroupsMap.get(tabDef.groupName);
            if (groupId === undefined) {
              const savedWindowId = groupWindowMap.get(tabDef.groupName);
              groupId = await chrome.tabs.group({
                tabIds: [createdTabId],
                createProperties: { windowId: savedWindowId },
              });
              createdGroupsMap.set(tabDef.groupName, groupId);

              // Update group styling
              const matchingGroupDef = groupsDef.find((g) => g.name === tabDef.groupName);
              await chrome.tabGroups.update(groupId, {
                title: tabDef.groupName,
                color: matchingGroupDef?.color ?? "blue",
                collapsed: matchingGroupDef?.collapsed ?? false,
              });
            } else {
              await chrome.tabs.group({
                groupId,
                tabIds: [createdTabId],
              });
            }
          } catch (groupError) {
            console.warn(`Fallback: Failed to group tab ${tabDef.name}:`, groupError);
            errors.push(`Failed to place "${tabDef.name}" into group "${tabDef.groupName}"`);
          }
        }
      } catch (tabError: any) {
        errors.push(`Failed to open tab "${tabDef.name}" (${tabDef.url}): ${tabError?.message || tabError}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Safely opens the Google logout URL and closes all other workspace tabs/windows.
   */
  static async openGoogleLogout(): Promise<void> {
    // 1. Get all currently open windows in this Chrome profile
    const windows = await chrome.windows.getAll({ populate: false });
    
    // 2. Open a new window with the logout page
    const logoutWin = await chrome.windows.create({
      url: "https://accounts.google.com/Logout",
      state: "maximized"
    });

    // 3. Close all OTHER windows to effectively "end work"
    for (const win of windows) {
      if (win.id && win.id !== logoutWin.id) {
        try {
          await chrome.windows.remove(win.id);
        } catch (e) {
          console.warn("Could not close window", win.id, e);
        }
      }
    }
  }
}
