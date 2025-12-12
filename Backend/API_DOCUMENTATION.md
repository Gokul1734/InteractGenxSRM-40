# InteractGenx SRM API Documentation

## Base URL

```markdown:Backend/API_DOCUMENTATION.md
```
Production: https://your-app.onrender.com
Development: http://localhost:5000
```

## Response Format

All API responses follow this standard format:

```json
{
  "success": true | false,
  "message": "Description of the result",
  "data": { ... } | [ ... ],
  "error": "Error message (only on failure)"
}
```

---

## Table of Contents

1. [Health Checks](#1-health-checks)
2. [Users API](#2-users-api)
3. [Sessions API](#3-sessions-api)
4. [Session Members API](#4-session-members-api)
5. [Invitations API](#5-invitations-api)
6. [Tracking Files API](#6-tracking-files-api)
7. [Validation API](#7-validation-api)

---

## 1. Health Checks

### GET `/`
Server root health check.

**Response:**
```json
{
  "ok": true
}
```

### GET `/api/auth/health`
Auth service health check.

**Response:**
```json
{
  "success": true,
  "message": "Auth service running"
}
```

### GET `/api/posts/health`
Posts service health check.

**Response:**
```json
{
  "success": true,
  "message": "Posts service running"
}
```

### GET `/api/tracking-files/health`
Tracking service health check.

**Response:**
```json
{
  "success": true,
  "message": "Tracking service is running",
  "data": {
    "storage": "MongoDB",
    "database_status": "connected" | "disconnected",
    "session_count": 10
  }
}
```

### GET `/api/tracking-files/test`
Simple test endpoint.

**Response:**
```json
{
  "success": true,
  "message": "API is working!",
  "timestamp": "2025-12-13T10:00:00.000Z"
}
```

---

## 2. Users API

### POST `/api/users`
Create a new user.

**Request Body:**
```json
{
  "user_name": "John Doe",
  "user_email": "john@example.com"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "_id": "6761234567890abcdef12345",
    "user_code": "ABC123U",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "is_active": true,
    "createdAt": "2025-12-13T10:00:00.000Z",
    "updatedAt": "2025-12-13T10:00:00.000Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Email already registered"
}
```

---

### GET `/api/users`
Get all users.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `active_only` | string | Set to `"true"` to get only active users |

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "6761234567890abcdef12345",
      "user_code": "ABC123U",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "is_active": true,
      "createdAt": "2025-12-13T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/users/:user_code`
Get user by user code.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_code` | string | User's unique code (e.g., `ABC123U`) |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "6761234567890abcdef12345",
    "user_code": "ABC123U",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "is_active": true,
    "createdAt": "2025-12-13T10:00:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

### GET `/api/users/id/:id`
Get user by MongoDB ID.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId |

**Response:** Same as GET `/api/users/:user_code`

---

### PUT `/api/users/:user_code`
Update user.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_code` | string | User's unique code |

**Request Body:**
```json
{
  "user_name": "John Updated",
  "user_email": "john.updated@example.com",
  "is_active": true
}
```
> All fields are optional.

**Success Response (200):**
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "_id": "6761234567890abcdef12345",
    "user_code": "ABC123U",
    "user_name": "John Updated",
    "user_email": "john.updated@example.com",
    "is_active": true
  }
}
```

---

### DELETE `/api/users/:user_code`
Delete user.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_code` | string | User's unique code |

**Success Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": {
    "user_code": "ABC123U"
  }
}
```

---

### GET `/api/users/:user_code/sessions`
Get all sessions for a user.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_code` | string | User's unique code |

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "6761234567890abcdef12345",
      "session_code": "XYZ789S",
      "session_name": "Research Session 1",
      "session_description": "Browser tracking for research",
      "is_active": true,
      "members": [ ... ]
    }
  ]
}
```

---

### GET `/api/users/validate/:user_code`
Validate if user code exists.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_code` | string | User's unique code |

**Success Response (200):**
```json
{
  "success": true,
  "valid": true,
  "message": "User code is valid",
  "data": {
    "user_code": "ABC123U",
    "user_name": "John Doe",
    "is_active": true
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "valid": false,
  "message": "User code not found. Please register on the dashboard first."
}
```

---

## 3. Sessions API

### POST `/api/sessions`
Create a new session.

**Request Body:**
```json
{
  "session_name": "Research Session 1",
  "session_description": "Tracking browser activity for research study",
  "created_by_user_code": "ABC123U"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `session_name` | No | Defaults to "Session {code}" |
| `session_description` | **Yes** | Description of the session |
| `created_by_user_code` | **Yes** | User code of creator (must exist) |

**Success Response (201):**
```json
{
  "success": true,
  "message": "Session created successfully",
  "data": {
    "_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "session_description": "Tracking browser activity for research study",
    "is_active": true,
    "members": [],
    "created_by": {
      "_id": "6761234567890abcdef12345",
      "user_name": "John Doe",
      "user_code": "ABC123U",
      "user_email": "john@example.com"
    },
    "started_at": "2025-12-13T10:00:00.000Z"
  }
}
```

---

### GET `/api/sessions`
Get all sessions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `active_only` | string | Set to `"true"` to get only active sessions |

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "6761234567890abcdef12345",
      "session_code": "XYZ789S",
      "session_name": "Research Session 1",
      "session_description": "Browser tracking for research",
      "is_active": true,
      "created_by": {
        "user_name": "John Doe",
        "user_code": "ABC123U"
      },
      "member_count": 5,
      "active_member_count": 3,
      "started_at": "2025-12-13T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/sessions/:session_code`
Get session by session code.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `session_code` | string | Session's unique code (e.g., `XYZ789S`) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "session_description": "Browser tracking for research",
    "is_active": true,
    "created_by": { ... },
    "members": [ ... ],
    "member_count": 5,
    "active_member_count": 3
  }
}
```

---

### GET `/api/sessions/id/:id`
Get session by MongoDB ID.

**Response:** Same as GET `/api/sessions/:session_code`

---

### PUT `/api/sessions/:session_code`
Update session.

**Request Body:**
```json
{
  "session_name": "Updated Session Name",
  "session_description": "Updated description",
  "is_active": true
}
```
> All fields are optional.

**Response (200):**
```json
{
  "success": true,
  "message": "Session updated successfully",
  "data": { ... }
}
```

---

### DELETE `/api/sessions/:session_code`
Delete session and all related tracking data.

**Response (200):**
```json
{
  "success": true,
  "message": "Session and related tracking data deleted successfully",
  "data": {
    "session_code": "XYZ789S"
  }
}
```

---

### POST `/api/sessions/:session_code/end`
End a session.

**Response (200):**
```json
{
  "success": true,
  "message": "Session ended successfully",
  "data": {
    "session_code": "XYZ789S",
    "ended_at": "2025-12-13T12:00:00.000Z"
  }
}
```

---

### GET `/api/sessions/validate/:session_code`
Validate if session code exists.

**Success Response (200):**
```json
{
  "success": true,
  "valid": true,
  "message": "Session code is valid",
  "data": {
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "is_active": true,
    "member_count": 3
  }
}
```

---

### GET `/api/sessions/:session_code/full`
Get full session data with all navigation tracking.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "is_active": true,
    "started_at": "2025-12-13T10:00:00.000Z",
    "ended_at": null,
    "created_by": {
      "user_id": "...",
      "user_name": "John Doe",
      "user_code": "ABC123U"
    },
    "member_count": 2,
    "active_member_count": 2,
    "members": [
      {
        "user_code": "ABC123U",
        "user_name": "John Doe",
        "is_active": true,
        "joined_at": "2025-12-13T10:00:00.000Z",
        "navigation_tracking": {
          "tracking_id": "...",
          "event_count": 150,
          "is_recording": true,
          "recording_started_at": "2025-12-13T10:00:00.000Z",
          "navigation_events": [ ... ]
        }
      }
    ],
    "total_events": 300
  }
}
```

---

### GET `/api/sessions/:session_code/getLiveUpdate`
Get live navigation tracking updates for all session members.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `since` | string | ISO timestamp to get only events after this time |

**Response (200):**
```json
{
  "success": true,
  "timestamp": "2025-12-13T10:05:00.000Z",
  "session": {
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "session_description": "Browser tracking",
    "is_active": true,
    "started_at": "2025-12-13T10:00:00.000Z",
    "created_by": { ... }
  },
  "summary": {
    "member_count": 3,
    "active_recording_count": 2,
    "total_events": 450,
    "has_any_updates": true
  },
  "members": [
    {
      "user_code": "ABC123U",
      "user_name": "John Doe",
      "is_recording": true,
      "has_tracking": true,
      "event_count": 150,
      "has_new_updates": true,
      "current_state": {
        "url": "https://example.com/page",
        "title": "Example Page",
        "favicon": "https://example.com/favicon.ico",
        "last_event_type": "PAGE_LOADED",
        "last_event_time": "2025-12-13T10:04:55.000Z"
      },
      "recent_events": [ ... ]
    }
  ]
}
```

---

## 4. Session Members API

### GET `/api/sessions/:session_code/members`
Get session members.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `active_only` | string | Set to `"true"` to get only active members |

**Response (200):**
```json
{
  "success": true,
  "session_code": "XYZ789S",
  "session_name": "Research Session 1",
  "count": 3,
  "data": [
    {
      "user_id": "6761234567890abcdef12345",
      "user_code": "ABC123U",
      "user_name": "John Doe",
      "is_active": true,
      "joined_at": "2025-12-13T10:00:00.000Z",
      "left_at": null,
      "has_tracking": true
    }
  ]
}
```

---

### POST `/api/sessions/:session_code/members`
Add user to session.

**Request Body:**
```json
{
  "user_code": "DEF456U"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User added to session successfully",
  "data": {
    "session_code": "XYZ789S",
    "user_code": "DEF456U",
    "user_name": "Jane Doe",
    "member_count": 4
  }
}
```

---

### DELETE `/api/sessions/:session_code/members/:user_code`
Remove user from session.

**Response (200):**
```json
{
  "success": true,
  "message": "User removed from session successfully",
  "data": {
    "session_code": "XYZ789S",
    "user_code": "DEF456U"
  }
}
```

---

## 5. Invitations API

### POST `/api/sessions/:session_code/invitations`
Send invitation to join a session (only session creator can send).

**Request Body:**
```json
{
  "inviter_user_code": "ABC123U",
  "invitee_user_code": "DEF456U",
  "message": "Please join our research session!"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `inviter_user_code` | **Yes** | Session creator's user code |
| `invitee_user_code` | **Yes** | User to invite |
| `message` | No | Optional invitation message |

**Success Response (201):**
```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "data": {
    "invitation_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "invited_user": {
      "user_code": "DEF456U",
      "user_name": "Jane Doe",
      "user_email": "jane@example.com"
    },
    "invited_by": {
      "user_code": "ABC123U",
      "user_name": "John Doe"
    },
    "status": "pending",
    "message": "Please join our research session!",
    "created_at": "2025-12-13T10:00:00.000Z"
  }
}
```

**Error Response (403):**
```json
{
  "success": false,
  "message": "Only the session creator can send invitations"
}
```

---

### GET `/api/sessions/:session_code/invitations`
Get all invitations for a session.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `accepted`, `declined`, `cancelled` |

**Response (200):**
```json
{
  "success": true,
  "session_code": "XYZ789S",
  "session_name": "Research Session 1",
  "count": 2,
  "data": [
    {
      "invitation_id": "6761234567890abcdef12345",
      "invited_user": {
        "user_code": "DEF456U",
        "user_name": "Jane Doe",
        "user_email": "jane@example.com"
      },
      "invited_by": {
        "user_code": "ABC123U",
        "user_name": "John Doe"
      },
      "message": "Please join!",
      "status": "pending",
      "created_at": "2025-12-13T10:00:00.000Z",
      "responded_at": null
    }
  ]
}
```

---

### GET `/api/invitations/pending/:user_code`
Get all pending invitations for a user.

**Response (200):**
```json
{
  "success": true,
  "user_code": "DEF456U",
  "count": 1,
  "data": [
    {
      "invitation_id": "6761234567890abcdef12345",
      "session": {
        "session_code": "XYZ789S",
        "session_name": "Research Session 1",
        "session_description": "Browser tracking",
        "is_active": true
      },
      "invited_by": {
        "user_code": "ABC123U",
        "user_name": "John Doe",
        "user_email": "john@example.com"
      },
      "message": "Please join!",
      "status": "pending",
      "created_at": "2025-12-13T10:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/invitations/:invitation_id/accept`
Accept an invitation and join the session.

**Request Body:**
```json
{
  "user_code": "DEF456U"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Invitation accepted successfully. You have been added to the session.",
  "data": {
    "invitation_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "user_code": "DEF456U",
    "user_name": "Jane Doe",
    "joined_at": "2025-12-13T10:05:00.000Z",
    "member_count": 4
  }
}
```

---

### POST `/api/invitations/:invitation_id/decline`
Decline an invitation.

**Request Body:**
```json
{
  "user_code": "DEF456U"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Invitation declined successfully",
  "data": {
    "invitation_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "status": "declined",
    "responded_at": "2025-12-13T10:05:00.000Z"
  }
}
```

---

### DELETE `/api/invitations/:invitation_id`
Cancel an invitation (only session creator can cancel).

**Request Body:**
```json
{
  "user_code": "ABC123U"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Invitation cancelled successfully",
  "data": {
    "invitation_id": "6761234567890abcdef12345",
    "session_code": "XYZ789S",
    "invited_user_code": "DEF456U",
    "status": "cancelled"
  }
}
```

---

## 6. Tracking Files API

### POST `/api/tracking-files/start`
Start a new tracking session.

**Request Body:**
```json
{
  "user_code": "ABC123U",
  "session_code": "XYZ789S",
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "session_name": "Research Session 1",
  "session_description": "Browser tracking"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `user_code` | **Yes** | User's unique code |
| `session_code` | **Yes** | Session's unique code |
| `user_name` | No | User's name (for auto-creation) |
| `user_email` | No | User's email (for auto-creation) |
| `session_name` | No | Session name |
| `session_description` | No | Session description |

**Response (201):**
```json
{
  "success": true,
  "message": "Tracking session started",
  "data": {
    "folder": "ABC123U_XYZ789S",
    "user_code": "ABC123U",
    "session_code": "XYZ789S",
    "tracking_id": "6761234567890abcdef12345",
    "session_id": "6761234567890abcdef12346"
  }
}
```

---

### POST `/api/tracking-files/update`
Update tracking data with new events (live, every 2 seconds).

**Request Body:**
```json
{
  "user_code": "ABC123U",
  "session_code": "XYZ789S",
  "data": {
    "recording_started_at": "2025-12-13T10:00:00.000Z",
    "recording_ended_at": null,
    "navigation_events": [
      {
        "event_type": "PAGE_LOADED",
        "timestamp": "2025-12-13T10:01:00.000Z",
        "context": {
          "url": "https://example.com",
          "title": "Example Page",
          "tabId": 123,
          "windowId": 1
        }
      }
    ]
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Data updated live",
  "data": {
    "folder": "ABC123U_XYZ789S",
    "event_count": 150,
    "updated_at": "2025-12-13T10:05:00.000Z"
  }
}
```

---

### POST `/api/tracking-files/stop`
Stop/finalize tracking session.

**Request Body:**
```json
{
  "user_code": "ABC123U",
  "session_code": "XYZ789S"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tracking session stopped",
  "data": {
    "folder": "ABC123U_XYZ789S",
    "event_count": 250,
    "duration_ms": 3600000
  }
}
```

---

### GET `/api/tracking-files/session/:user_code/:session_code`
Get tracking session data for a specific user.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_code": "ABC123U",
    "session_code": "XYZ789S",
    "recording_started_at": "2025-12-13T10:00:00.000Z",
    "recording_ended_at": "2025-12-13T11:00:00.000Z",
    "navigation_events": [ ... ],
    "event_count": 250,
    "is_active": false
  }
}
```

---

### GET `/api/tracking-files/live/:session_code`
Get live collaborative data for all users in a session.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session_code": "XYZ789S",
    "total_participants": 3,
    "all_events": [ ... ],
    "participants": [ ... ]
  }
}
```

---

### GET `/api/tracking-files/sessions`
List all tracking sessions.

**Response (200):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "folder": "ABC123U_XYZ789S",
      "user_code": "ABC123U",
      "session_code": "XYZ789S",
      "started_at": "2025-12-13T10:00:00.000Z",
      "ended_at": "2025-12-13T11:00:00.000Z",
      "event_count": 250,
      "is_active": false
    }
  ]
}
```

---

### GET `/api/tracking-files/sessions/:session_code/members`
Get all members and their live status in a session.

**Response (200):**
```json
{
  "success": true,
  "session_code": "XYZ789S",
  "session_id": "6761234567890abcdef12345",
  "session_name": "Research Session 1",
  "is_active": true,
  "started_at": "2025-12-13T10:00:00.000Z",
  "member_count": 3,
  "active_count": 2,
  "members": [
    {
      "user_code": "ABC123U",
      "user_name": "John Doe",
      "is_active": true,
      "joined_at": "2025-12-13T10:00:00.000Z",
      "navigation_tracking": {
        "tracking_id": "...",
        "event_count": 150,
        "is_recording": true,
        "navigation_events": [ ... ],
        "last_event": { ... }
      }
    }
  ]
}
```

---

### GET `/api/tracking-files/sessions/:session_code/full`
Get complete session data with all members and navigation tracking.

**Response:** Similar to `/api/sessions/:session_code/full`

---

### DELETE `/api/tracking-files/session/:user_code/:session_code`
Delete a tracking session.

**Response (200):**
```json
{
  "success": true,
  "message": "Session deleted",
  "data": {
    "folder": "ABC123U_XYZ789S"
  }
}
```

---

## 7. Validation API

### GET `/api/tracking-files/validate/user/:user_code`
Validate if user code exists.

**Response (200):**
```json
{
  "success": true,
  "valid": true,
  "message": "User code is valid",
  "data": {
    "user_code": "ABC123U",
    "user_name": "John Doe",
    "is_active": true
  }
}
```

---

### GET `/api/tracking-files/validate/session/:session_code`
Validate if session code exists.

**Response (200):**
```json
{
  "success": true,
  "valid": true,
  "message": "Session code is valid",
  "data": {
    "session_code": "XYZ789S",
    "session_name": "Research Session 1",
    "is_active": true,
    "member_count": 3
  }
}
```

---

### GET `/api/tracking-files/validate/:user_code/:session_code`
Validate both user code and session code in one request.

**Response (200):**
```json
{
  "success": true,
  "valid": true,
  "message": "Both user code and session code are valid",
  "data": {
    "user": {
      "user_code": "ABC123U",
      "user_name": "John Doe",
      "is_active": true
    },
    "session": {
      "session_code": "XYZ789S",
      "session_name": "Research Session 1",
      "is_active": true,
      "member_count": 3
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "valid": false,
  "message": "User code not found. Session code not found.",
  "errors": [
    "User code not found. Please register on the dashboard first.",
    "Session code not found. Please create a session on the dashboard first."
  ]
}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 403 | Forbidden - Not authorized |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error |
| 503 | Service Unavailable - Database not connected |

---

## Navigation Event Types

Events tracked by the browser extension:

| Event Type | Description |
|------------|-------------|
| `PAGE_LOADED` | Page finished loading |
| `PAGE_OPEN` | New page opened |
| `PAGE_URL_CHANGE` | URL changed (SPA navigation) |
| `TAB_ACTIVATED` | Tab became active |
| `TAB_UPDATED` | Tab content updated |
| `TAB_CREATED` | New tab created |
| `TAB_CLOSED` | Tab was closed |
| `WINDOW_FOCUSED` | Browser window gained focus |

---

## Notes

- All `user_code` values are automatically converted to uppercase
- Session codes end with 'S' suffix (format: `XXXXXXS`)
- User codes end with 'U' suffix (format: `XXXXXXU`)
- All timestamps are in ISO 8601 format
- MongoDB ObjectIds are used for `_id` fields
```

---

**To add this file to your project:**

1. Create a new file at `Backend/API_DOCUMENTATION.md`
2. Copy the entire content above and paste it
3. Save the file

Or switch to **agent mode** and I can create the file for you directly! 🚀
