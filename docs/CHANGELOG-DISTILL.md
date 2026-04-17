# Distill (simplification) — March 2025

Summary of complexity removed to align with **minimal, tool-first** design (CLAUDE.md) and frontend-design guidance (no redundant copy, no identical card grids).

## Removed

### Redundant intro cards (all main views)

- **Overview:** Removed the card that said *"Overview: Add, view, and manage your TRMNL devices. Use the form below to add a device, or select a device from the list for more details."* The tab label and the form/list are sufficient.
- **Device Details:** Removed the card that restated *"Device Details: View and edit device details, manage screens, and access device-specific actions."* The page content makes this clear.
- **Maintenance:** Removed the intro card; replaced with a single line: *"Coming soon."*
- **Virtual Device:** Removed the card that said *"Virtual Device: This can be used to test your screens."* The card title "Virtual Device" and the form are sufficient.

**Why:** Tab/nav already provides context. Repeating the section name and a long description adds noise for technical users and violates “don’t repeat the same information” and “identical card grids” guidance. All features remain accessible; only the redundant block was removed.

### Shortened copy

- **AddScreenCard** (per-tab context): Shortened the three mode descriptions (cached link, no-cache link, file upload, HTML) to one short line each so the UI stays scannable.

## Unchanged

- No features or entry points were removed. Device list, device detail, add screen, virtual device, HTML preview, and maintenance are unchanged in behavior.
- Empty states and alerts (e.g. “No devices found.”, “No screens for this device. Add one.”) kept as-is; they are essential and non-redundant.

## Alternative access

- None needed. Removed content only restated the page title and obvious next steps. If users miss context, the tab name and section headings (Add Device, Devices, etc.) provide it.

---

## Second pass (March 2025)

### App bar

- Shortened title to **Kuroshiro vX** and a **TRMNL** link. Removed “server implementation” copy.

### Empty states

- **Overview:** One line: *“No devices yet. Add one with the form above.”*
- **Screen list:** *“No screens yet. Add one in Add Screen above.”*
- **Device logs:** *“No logs yet.”*
- **Current screen:** *“No screen available.”*

### Device information (progressive disclosure)

- **Advanced** expansion panel: Refresh rate, Special function, Reset device, Automatic updates, and Mirroring (with Mirror MAC/API key) are now inside a single “Advanced” section. Default view shows only identity, status, and core fields (Friendly ID, MAC, API key).

### Add Screen

- Tab helper text shown only for **External Link** (cached vs no-cache). File and HTML tabs have no helper line. Copy shortened to one sentence.

### Virtual Device

- Raw API **Response** JSON moved into an expandable “Response” panel so the default view emphasizes the screen image.

### Navigation drawer

- **Tools** group removed. Virtual Device and HTML Preview are top-level nav items (flatter structure).
