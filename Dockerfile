# Use Node.js 20.19.0 Alpine for smaller image size
FROM node:20.19.0-alpine

# Install FFmpeg and other dependencies (optimized for Railway)
RUN apk add --no-cache ffmpeg \
    && ffmpeg -version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci --legacy-peer-deps

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev --legacy-peer-deps

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Note: Upload directories will be created dynamically by the application

# Switch to non-root user
USER nestjs

# Set environment variables for Railway optimization
ENV UPLOAD_PATH=/tmp/uploads
ENV NODE_OPTIONS="--max-old-space-size=3072"
ENV FFMPEG_THREADS=2

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "run", "start:prod"]
