# ClipFlow Express.js API

A clean, modular Express.js backend API for the ClipFlow video clip generation platform. This API provides video upload, SRT subtitle processing, and timestamp-based clip generation using AWS S3 and FFmpeg.

## 🚀 Features

- **Video Upload & Management** - Upload videos to AWS S3 with chunked multipart upload support
- **SRT Subtitle Processing** - Upload and process SRT subtitle files
- **Clip Generation** - Generate video clips based on precise timestamps
- **JWT Authentication** - Secure user authentication and authorization
- **Role-Based Access** - Admin and user roles with subscription-based features
- **File Management** - AWS S3 integration for scalable file storage
- **Video Processing** - FFmpeg integration for video manipulation
- **Comprehensive Logging** - Winston logger with file and console outputs
- **Input Validation** - Express-validator for request validation
- **Error Handling** - Centralized error handling with proper HTTP status codes
- **Rate Limiting** - Subscription-based API rate limiting

## 📋 API Endpoints

### Authentication Routes (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user profile
- `PUT /auth/me` - Update user profile
- `POST /auth/change-password` - Change password
- `POST /auth/logout` - Logout user

### Clip Management Routes (`/clips`)
- `POST /clips` - Create new clip project with video/SRT upload
- `GET /clips` - Get all clip projects for user (with pagination)
- `GET /clips/:id` - Get specific clip project
- `PUT /clips/:id` - Update clip project with generated clips + timestamps
- `POST /clips/:id/generate` - Generate clips based on timestamps
- `DELETE /clips/:id` - Delete clip project and associated files

## 🛠 Tech Stack

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3
- **Video Processing**: FFmpeg
- **Validation**: Express-validator + Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting
- **File Upload**: Multer with S3 integration

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd express-clipflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file based on the requirements:
   ```env
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/clipflow
   JWT_SECRET=your-super-secret-jwt-key
   AWS_ACCESS_KEY_ID=your-aws-access-key
   AWS_SECRET_ACCESS_KEY=your-aws-secret-key
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-clipflow-bucket
   ```

4. **Install FFmpeg**
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu**: `sudo apt install ffmpeg`
   - **Windows**: Download from [FFmpeg website](https://ffmpeg.org/download.html)

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/clipflow |
| `JWT_SECRET` | JWT signing secret | **Required** |
| `AWS_ACCESS_KEY_ID` | AWS access key | **Required** |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | **Required** |
| `AWS_REGION` | AWS region | us-east-1 |
| `AWS_S3_BUCKET` | S3 bucket name | **Required** |
| `FFMPEG_PATH` | Path to FFmpeg binary | (uses system PATH) |
| `TEMP_DIR` | Temporary files directory | ./temp |
| `LOG_LEVEL` | Logging level | info |

### AWS S3 Setup

1. Create an S3 bucket for file storage
2. Configure IAM user with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-bucket-name",
           "arn:aws:s3:::your-bucket-name/*"
         ]
       }
     ]
   }
   ```

## 📚 Usage Examples

### 1. User Registration
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "name": "John Doe"
  }'
```

### 2. Create Clip Project
```bash
curl -X POST http://localhost:3000/clips \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "title=My Video Project" \
  -F "videoFile=@video.mp4" \
  -F "srtFile=@subtitles.srt"
```

### 3. Generate Clips from Timestamps
```bash
curl -X POST http://localhost:3000/clips/CLIP_ID/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamps": [
      {
        "id": "clip_001",
        "title": "Introduction",
        "description": "Opening segment",
        "startTime": 0,
        "endTime": 30
      },
      {
        "id": "clip_002",
        "title": "Main Content", 
        "description": "Core discussion",
        "startTime": 30,
        "endTime": 90
      }
    ],
    "quality": "high",
    "format": "mp4"
  }'
```

## 🏗 Project Structure

```
express-clipflow/
├── src/
│   ├── controllers/          # Request handlers
│   │   ├── authController.js
│   │   └── clipsController.js
│   ├── middleware/           # Custom middleware
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/              # Database models
│   │   ├── User.js
│   │   └── Clip.js
│   ├── routes/              # Route definitions
│   │   ├── auth.js
│   │   └── clips.js
│   ├── services/            # Business logic
│   │   ├── clipService.js
│   │   ├── awsService.js
│   │   └── videoService.js
│   └── utils/               # Utility functions
│       └── logger.js
├── logs/                    # Log files
├── temp/                    # Temporary files
├── package.json
├── server.js               # Entry point
└── README.md
```

## 🔐 Security Features

- **JWT Authentication** - Stateless token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Input Validation** - Comprehensive request validation
- **Rate Limiting** - Subscription-based API limits
- **CORS Protection** - Configurable origins
- **Helmet Security** - HTTP security headers
- **File Type Validation** - Whitelist-based file filtering
- **Error Sanitization** - No sensitive data in error responses

## 🚦 Error Handling

The API uses a centralized error handling system with consistent error responses:

```json
{
  "error": "Validation failed",
  "status": 400,
  "timestamp": "2023-08-22T10:30:00.000Z",
  "path": "/clips",
  "method": "POST",
  "details": {
    "errors": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  }
}
```

## 📊 Logging

Winston logger with multiple transports:
- **Console**: Development logging with colors
- **File**: Production logging in JSON format
- **Error File**: Separate error-only log file
- **Request Logging**: HTTP request/response logging

## 🔧 Development

### Running Tests
```bash
npm test
```

### Code Formatting
```bash
npm run lint
npm run format
```

### Production Deployment
```bash
# Build and optimize
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Or use Docker
docker build -t clipflow-api .
docker run -p 3000:3000 --env-file .env clipflow-api
```

## 📈 Performance Considerations

- **File Streaming**: Large video files are processed in streams
- **Chunked Uploads**: Support for multipart uploads to handle large files
- **Connection Pooling**: MongoDB connection optimization
- **Caching**: Redis integration ready for caching layers
- **Background Processing**: Video processing can be moved to queues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Open an issue on GitHub
- Check the documentation
- Review the API examples above

---

**ClipFlow Express API** - Built with ❤️ for video content creators
