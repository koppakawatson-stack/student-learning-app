// Real-time messaging functions for messages.html
// Add this to replace the existing sendMessage and loadMessages functions

// Send Message - REAL API VERSION
async function sendMessageReal() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();

    if (!messageText || !activeConversation) return;

    const currentUserId = localStorage.getItem('skillSwapUserId');
    if (!currentUserId) {
        alert('Please log in to send messages');
        return;
    }

    // Extract numeric ID from activeConversation (remove 'real_' prefix if present)
    const receiverId = activeConversation.replace('real_', '');

    try {
        // Send to API
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: currentUserId,
                receiverId: receiverId,
                content: messageText
            })
        });

        if (response.ok) {
            // Add message to UI immediately
            const messagesContainer = document.getElementById('messagesContainer');
            const messageElement = document.createElement('div');
            messageElement.className = 'message sent';
            messageElement.innerHTML = `
        <div class="message-content">${messageText}</div>
        <div class="message-time">Just now</div>
      `;
            messagesContainer.appendChild(messageElement);

            // Clear input
            messageInput.value = '';

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            alert('Failed to send message');
        }
    } catch (e) {
        console.error('Error sending message:', e);
        alert('Connection error. Please try again.');
    }
}

// Load messages - REAL API VERSION
async function loadMessagesReal(conversationId) {
    const messagesContainer = document.getElementById('messagesContainer');
    const currentUserId = localStorage.getItem('skillSwapUserId');

    if (!currentUserId) {
        messagesContainer.innerHTML = '<div class="message-date">Please log in to view messages</div>';
        return;
    }

    // Extract numeric ID (remove 'real_' prefix if present)
    const otherUserId = conversationId.replace('real_', '');

    try {
        const response = await fetch(`/api/messages/${currentUserId}/${otherUserId}`);

        if (response.ok) {
            const messages = await response.json();

            messagesContainer.innerHTML = '<div class="message-date">Today</div>';

            messages.forEach(msg => {
                const messageElement = document.createElement('div');
                const isSent = msg.sender_id == currentUserId;
                messageElement.className = `message ${isSent ? 'sent' : 'received'}`;

                const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                messageElement.innerHTML = `
          <div class="message-content">${msg.content}</div>
          <div class="message-time">${time}</div>
        `;
                messagesContainer.appendChild(messageElement);
            });

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (e) {
        console.error('Error loading messages:', e);
        messagesContainer.innerHTML = '<div class="message-date">Error loading messages</div>';
    }
}

// Instructions:
// 1. In messages.html, replace the sendMessage() function call with sendMessageReal()
// 2. In messages.html, replace the loadMessages() function call with loadMessagesReal()
// 3. Or simply rename these functions to sendMessage and loadMessages
