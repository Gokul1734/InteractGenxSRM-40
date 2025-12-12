# Co-Browsing Extension UI

A modern, real-time view-only co-browsing browser extension dashboard built with React and Tailwind CSS.

## Features

### 1️⃣ Login Section
- Simple local login with name and email
- User profile display with logout functionality

### 2️⃣ Session Manager
- Create new sessions
- Join existing sessions by ID
- View all active sessions with status indicators
- Real-time session updates
- Tab selection for sharing
- Start/Stop sharing controls

### 3️⃣ Site Compatibility Panel
- Shows supported websites (HTTP/HTTPS, dynamic web apps)
- Lists unsupported sites (Chrome Web Store, chrome:// pages, etc.)
- Clear visual indicators for compatibility

### 4️⃣ Shareable Tabs Panel
- Lists all open browser tabs
- Shows favicon, title, and URL for each tab
- Status badges (Shareable / Restricted)
- Single-tab selection
- Real-time tab updates

### 5️⃣ Tracked Actions Panel
- Displays all tracked actions:
  - Scroll Tracking
  - Mouse Movement
  - Click Indicators
  - Navigation Tracking
  - DOM Snapshot Updates
- Shows viewer restrictions (read-only mode)
- Locked enabled state for all tracking features

### 6️⃣ Live Status Panel
- Shows LIVE badge when session is active
- Displays Session ID
- Connected viewer count
- Current tab being shared
- Quick stop sharing button

### 7️⃣ Toast Notifications
- Real-time pop-up notifications for:
  - Session invites
  - New sessions created
  - Sharing status changes
  - Tab changes
  - Errors and success messages
- Auto-dismiss after 5 seconds
- Color-coded by notification type

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **Tailwind CSS 3** - Styling
- **Vite** - Build tool
- **Lucide React** - Icons

## UI Components

- `LoginSection.jsx` - Authentication interface
- `SessionSelector.jsx` - Session management
- `SupportedSites.jsx` - Site compatibility info
- `ShareableTabs.jsx` - Tab selection interface
- `TrackedActions.jsx` - Tracking features display
- `LiveStatus.jsx` - Real-time session status
- `ToastNotification.jsx` - Pop-up notification system

## Usage

1. **Login**: Enter your name and email to access the dashboard
2. **Create/Join Session**: Create a new session or join an existing one
3. **Select Tab**: Choose which browser tab to share
4. **Start Sharing**: Begin broadcasting your selected tab
5. **Monitor**: Watch the live status panel for real-time updates
6. **Notifications**: Receive pop-ups for all important events

## Features Demo

The UI includes simulated real-time events:
- Invite notification after 5 seconds
- New session creation after 10 seconds
- Tab change notification after 15 seconds
- Sharing status update after 20 seconds

## Browser Extension Integration

This UI is designed to integrate with a browser extension backend. The current implementation uses:
- Mock data for demonstration
- Placeholder event handlers
- Simulated real-time updates

To integrate with actual browser extension APIs, replace the mock data and handlers with Chrome Extension API calls.

## Styling

- Clean card-based layout
- Gradient backgrounds
- Rounded corners and shadows
- Responsive design
- Smooth animations and transitions
- Color-coded status indicators

## License

MIT
