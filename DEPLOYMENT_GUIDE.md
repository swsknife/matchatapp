# MatchChatApp Deployment Guide

This guide explains how to deploy the MatchChatApp server to Render.com (free tier) and build a release APK that connects to the deployed server.

## Step 1: Deploy the Server to Render.com

1. Create a new account on [Render.com](https://render.com) if you don't have one
2. Click on "New +" and select "Web Service"
3. Connect your GitHub repository or use the "Public Git repository" option
4. Enter the repository URL (or push your code to GitHub first)
5. Configure the service:
   - Name: match-chat-app-server
   - Root Directory: server (important - specify this to point to the server folder)
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the Free plan
6. Click "Create Web Service"
7. Wait for the deployment to complete (this may take a few minutes)
8. Once deployed, note the URL of your service (e.g., https://match-chat-app-server.onrender.com)

## Step 2: Test the Deployed Server

1. Visit `https://your-app-name.onrender.com/ping` in your browser
2. You should see "pong" as the response
3. Visit `https://your-app-name.onrender.com/` in your browser
4. You should see "MatchChatApp server is running!"

## Step 3: Update the App Configuration

1. Edit the `.env.production` file in the root of your project
2. Update the `REACT_APP_SERVER_URL` to match your Render.com URL:
   ```
   REACT_APP_SERVER_URL=https://your-app-name.onrender.com
   ```

## Step 4: Build the Release APK

1. Run the `build-release-apk.bat` script by double-clicking it
2. Wait for the build process to complete
3. The APK will be generated at:
   ```
   android/app/build/outputs/apk/user1/release/app-user1-release.apk
   ```

## Step 5: Install and Test the APK

1. Transfer the APK to your Android device
2. Install the APK by tapping on it
3. Open the app and test the connection to your deployed server

## Troubleshooting

If you encounter connection issues:

1. Check that your server is running on Render.com
2. Verify that the URL in `.env.production` matches your Render.com URL
3. Check the app logs for any connection errors
4. Make sure your device has internet access

## Notes

- The free tier of Render.com has some limitations:
  - The service will spin down after 15 minutes of inactivity
  - The first request after inactivity may take a few seconds to respond
  - There are monthly usage limits

- For production use, consider upgrading to a paid plan or using a different hosting service