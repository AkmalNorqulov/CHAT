const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws'); // Import ws library

const app = express();
const server = http.createServer(app);

// Serve static files from the 'public' directory (or root if index.html is in the root)
app.use(express.static(path.join(__dirname)));

// Route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Store messages and connected clients
const messages = [];
let clients = []; // Using 'let' as it will be reassigned on client disconnection

// Function to broadcast messages to all clients
const broadcast = (message) => {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.push(ws);

  // Send message history to the newly connected client
  ws.send(JSON.stringify({ type: 'history', data: messages }));

  ws.on('message', (messageAsString) => {
    try {
      const parsedMessage = JSON.parse(messageAsString);

      if (parsedMessage.type === 'delete') {
        const messageIdToDelete = parsedMessage.id;
        const initialLength = messages.length;
        // Filter out the message to be deleted
        const messageIndex = messages.findIndex(msg => msg.id === messageIdToDelete);

        if (messageIndex > -1) {
          messages.splice(messageIndex, 1);
          console.log(`Message ${messageIdToDelete} deleted`);
          broadcast({ type: 'messageDeleted', id: messageIdToDelete });
        } else {
          console.log(`Message ${messageIdToDelete} not found for deletion.`);
          // Optionally notify the requesting client that the message was not found
          // ws.send(JSON.stringify({ type: 'error', message: `Message with id ${messageIdToDelete} not found.` }));
        }
      } else { // Assuming it's a new message submission
        // Add server-side timestamp and unique ID
        const newMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: parsedMessage.content, // Assuming client sends { content: "their message" }
          user: parsedMessage.user || 'Anonymous', // Add user if provided, otherwise 'Anonymous'
          timestamp: new Date().toISOString(),
        };

        messages.push(newMessage);
        broadcast({ type: 'message', data: newMessage });
      }
    } catch (error) {
      console.error('Failed to parse message or process:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format or server error.' }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients = clients.filter(client => client !== ws);
    // Optionally, broadcast a "user left" message
    // broadcast({ type: 'notification', message: 'A user has left the chat.' });
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    // Attempt to remove client on error as well, as 'close' might not always fire
    clients = clients.filter(client => client !== ws);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log(`WebSocket server started on ws://localhost:${PORT}`);
});
