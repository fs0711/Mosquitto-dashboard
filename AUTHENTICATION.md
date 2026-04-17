# Authentication System

## Overview

The Mosquitto Dashboard now includes a complete authentication system with user management capabilities. The system uses:

- **SQLite** - Local database (no additional installation required)
- **JWT (JSON Web Tokens)** - For session management
- **bcrypt** - For password hashing
- **Role-based access control** - Admin and Viewer roles

## Default Credentials

When you first run the application, a default admin account is automatically created:

- **Username:** `admin`
- **Password:** `admin`

⚠️ **Important:** Change the default password immediately after first login!

## Features

### User Roles

- **Admin** - Full access to all features including user management
- **Viewer** - Read-only access to dashboard features

### User Management (Admin Only)

Admins can access the User Management page to:
- View all users
- Create new users
- Edit existing users (update email, role, password)
- Activate/deactivate users
- Delete users

### Security Features

- Passwords are hashed using bcrypt
- JWT tokens with 24-hour expiration
- Protected API endpoints
- Automatic token refresh on page load
- Automatic redirect to login on unauthorized access
- Prevention of deleting the last admin user

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

The following new packages are included:
- `PyJWT==2.8.0` - JWT token handling
- `passlib[bcrypt]==1.7.4` - Password hashing

### 2. Environment Variables (Optional)

You can customize the JWT secret key in your `.env` file:

```env
JWT_SECRET_KEY=your-super-secret-key-here
```

If not set, a default key will be used (change this in production!).

### 3. Database Initialization

The SQLite database (`dashboard.db`) is automatically created in the `backend/services` directory when you first run the application. The default admin user is created automatically.

### 4. Run the Backend

```bash
python run.py
```

The backend will start on port 5013 with the database initialized.

## API Endpoints

### Authentication

#### POST `/api/auth/login`
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "admin"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@localhost",
    "role": "admin",
    "is_active": 1
  }
}
```

#### GET `/api/auth/me`
Get current user information (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

#### POST `/api/auth/change-password`
Change the current user's password.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "old_password": "admin",
  "new_password": "newpassword123"
}
```

### User Management (Admin Only)

#### GET `/api/auth/users`
Get all users.

#### POST `/api/auth/users`
Create a new user.

**Request:**
```json
{
  "username": "newuser",
  "password": "password123",
  "email": "user@example.com",
  "role": "viewer"
}
```

#### PUT `/api/auth/users/{user_id}`
Update a user.

**Request:**
```json
{
  "email": "updated@example.com",
  "role": "admin",
  "is_active": true,
  "password": "newpassword"  // optional
}
```

#### DELETE `/api/auth/users/{user_id}`
Delete a user.

## Frontend Integration

### Authentication Context

The frontend uses a React context (`AuthContext`) to manage authentication state:

```jsx
import { useAuth } from "./contexts/AuthContext";

function MyComponent() {
  const { user, token, login, logout, isAuthenticated, isAdmin } = useAuth();
  
  // Use authentication state
}
```

### Protected Routes

All dashboard routes are automatically protected. Unauthenticated users are redirected to the login page.

### Making Authenticated API Calls

The `fetchData` utility function automatically includes the JWT token:

```javascript
import { fetchData } from "./utils";

// Token is automatically included
const data = await fetchData("/api/v1/systree");
```

## Security Best Practices

1. **Change Default Password** - Immediately change the default admin password
2. **Set JWT Secret** - Use a strong, random JWT secret key in production
3. **Use HTTPS** - Always use HTTPS in production to protect tokens in transit
4. **Regular Password Updates** - Encourage users to update passwords regularly
5. **Limit Admin Accounts** - Only create admin accounts when necessary

## Database Location

The SQLite database is stored at:
```
backend/services/dashboard.db
```

To backup the database, simply copy this file.

## Troubleshooting

### "Invalid or expired token" Error

- Token may have expired (24-hour limit)
- Simply logout and login again

### Can't Login with Default Credentials

- Check if database was initialized correctly
- Look for `dashboard.db` in `backend/services/`
- Check backend logs for errors

### Lost Admin Access

If you've lost admin access, you can manually update the database:

```bash
cd backend/services
sqlite3 dashboard.db
```

```sql
-- Reset admin password to "admin"
UPDATE users SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LwA5hQfJZqD.fQYoC' WHERE username = 'admin';

-- Make user admin
UPDATE users SET role = 'admin' WHERE username = 'your_username';
```

## Migration Notes

All existing routes remain functional. The authentication layer adds:
- Login page at `/login`
- User Management page at `/user-management` (admin only)
- Protected access to all dashboard routes

No changes to existing Mosquitto configuration are required.
