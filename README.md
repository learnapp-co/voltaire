# ClipFlow API

A NestJS application with MongoDB and comprehensive authentication system.

## Features

- **MongoDB Integration**: Using Mongoose for data modeling
- **JWT Authentication**: Secure token-based authentication with global guards
- **Email System**: Professional email templates using @nestjs-modules/mailer
- **Password Management**: Bcrypt hashing with password reset functionality
- **Role-based Access Control**: Admin and user roles
- **User Management**: CRUD operations with proper authorization
- **Template Engine**: Handlebars templates for responsive emails

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/clipflow

# Application Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=525600
RESET_TOKEN_EXPIRE_MINUTES=15

# Email Configuration (@nestjs-modules/mailer)
EMAIL_HOST=smtp.ethereal.email
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@clipflow.com
FRONTEND_URL=http://localhost:3000
```

## Installation

```bash
npm install
```

## Running the application

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

## API Endpoints

### Authentication

- `POST /auth/login` - User login
- `GET /auth/profile` - Get current user profile
- `POST /auth/users` - Create new user (Admin only)
- `POST /auth/reset-password` - Request password reset
- `POST /auth/reset-password/confirm` - Confirm password reset with token
- `PATCH /auth/change-password` - Change password (authenticated users)
- `POST /auth/admin/reset-password` - Admin reset user password
- `GET /auth/verify` - Verify JWT token

### Users

- `GET /users` - List all users (Admin only)
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user (Admin only)
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Delete user (Admin only)

### Email

- `POST /email/send` - Send generic email (Admin only)
- `POST /email/welcome` - Send welcome email (Admin only)
- `POST /email/password-reset` - Send password reset email (Admin only)
- `GET /email/test-config` - Test email configuration (Admin only)
- `POST /email/test` - Send test email (Admin only)
- `GET /email/health` - Email service health check

### Public Endpoints

- `GET /` - Welcome message
- `GET /health` - Health check
- `GET /email/health` - Email service health check

## User Schema

```typescript
{
  email: string (unique, required)
  firstName: string (required)
  lastName: string (required)
  hashedPassword: string (required)
  isActive: boolean (default: true)
  isAdmin: boolean (default: false)
  resetTokenExpires?: Date
  requiresPasswordChange: boolean (default: true)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

## Authentication Flow

1. **User Creation**: Admins can create users with temporary passwords
2. **Login**: Users authenticate with email/password
3. **JWT Token**: Successful login returns a JWT token
4. **Protected Routes**: Most endpoints require valid JWT token
5. **Password Reset**: Users can request password reset tokens
6. **Role-based Access**: Admin endpoints require admin privileges

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT tokens with configurable expiration
- Password reset tokens that invalidate when password changes
- Role-based access control
- Global authentication guard with public route decorators