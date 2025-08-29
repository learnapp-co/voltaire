# MongoDB Atlas Setup for ClipFlow

## Step 1: Create New Database User
1. Go to MongoDB Atlas → Database Access
2. Click "+ Add New Database User"
3. Authentication Method: Password
4. Username: `clipflow_user`
5. Password: Generate or create strong password
6. Database User Privileges:
   - Built-in Role: `readWriteAnyDatabase`
   - Or Custom Role: `readWrite` on database `clipflow_fresh`

## Step 2: Create New Database
1. Go to Clusters → Browse Collections
2. Click "+ Create Database"
3. Database Name: `clipflow_fresh`
4. Collection Name: `users`
5. Click "Create"

## Step 3: Get Connection String
1. Go to Clusters → Connect
2. Choose "Connect your application"
3. Driver: Node.js
4. Version: 4.1 or later
5. Copy the connection string:
   `mongodb+srv://clipflow_user:<password>@cluster0.xxxxx.mongodb.net/clipflow_fresh?retryWrites=true&w=majority`

## Step 4: Update Environment Variables
Create/update your .env file:
```env
MONGODB_URI=mongodb+srv://clipflow_user:<password>@cluster0.xxxxx.mongodb.net/clipflow_fresh?retryWrites=true&w=majority
MONGODB_DB_NAME=clipflow_fresh
```

## Step 5: Network Access
1. Go to Network Access
2. Ensure your IP is whitelisted (0.0.0.0/0 for development)
3. Click "Add IP Address" if needed

## Step 6: Test Connection
Run your app and check for successful database connection in logs.
