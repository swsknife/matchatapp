# MatchChatApp Server

This is the server component for the MatchChatApp.

## Deployment to Render.com

1. Create a new account on [Render.com](https://render.com) if you don't have one
2. Click on "New +" and select "Web Service"
3. Connect your GitHub repository or use the "Public Git repository" option
4. Enter the repository URL
5. Configure the service:
   - Name: match-chat-app-server
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the Free plan
6. Click "Create Web Service"

## Environment Variables

The server uses the following environment variables:
- `PORT`: The port on which the server will run (default: 3000)
- `NODE_ENV`: The environment (development/production)

## Testing the Deployment

Once deployed, you can test the server by visiting:
- `https://your-app-name.onrender.com/ping` - Should return "pong"
- `https://your-app-name.onrender.com/` - Should return "MatchChatApp server is running!"