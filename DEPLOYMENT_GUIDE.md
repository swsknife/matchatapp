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
   - Important: Do NOT set a custom PORT environment variable - Render.com will automatically assign a port
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
   - Go to your Render.com dashboard and check the logs
   - Make sure there are no errors in the server startup
   - Verify the server is actually running and not in a crashed state

2. Verify that the URL in `.env.production` matches your Render.com URL exactly
   - It should be something like `https://match-chat-app-server.onrender.com`
   - Do NOT include any port number in the URL
   - Make sure there are no trailing slashes or spaces

3. Check if you can access the server from a browser
   - Try visiting `https://your-app-name.onrender.com/ping` in a browser
   - If you get "pong" back, the server is running correctly
   - If not, there might be an issue with your Render.com deployment

4. Check for environment variable issues
   - Make sure you haven't set a custom PORT variable in Render.com
   - Let Render.com automatically assign and manage the port

5. Check the app logs for any connection errors
   - Look for network-related errors in your app's logs
   - Check for any CORS or SSL-related issues

6. Make sure your device has internet access and can reach Render.com
   - Some networks might block certain domains or have firewall restrictions

## Notes

- The free tier of Render.com has some limitations:
  - The service will spin down after 15 minutes of inactivity
  - The first request after inactivity may take a few seconds to respond
  - There are monthly usage limits

- Port Configuration:
  - Render.com automatically assigns a port via the PORT environment variable
  - Your server code should use `process.env.PORT` to listen on the correct port
  - External access is always through the standard HTTPS port (443), so don't include a port in your URLs

- For production use, consider upgrading to a paid plan or using a different hosting service