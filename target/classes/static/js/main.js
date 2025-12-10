'use strict';

var stompClient = null;
var username = null;
var selectedUser = null;

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var chatHeader = document.querySelector('#chatHeader');
var usersList = document.querySelector('#usersList');
var typingStatus = document.querySelector('#typingStatus');
var currentUserBadge = document.querySelector('#currentUser');

var colors = ['#2196F3', '#32c787', '#00BCD4', '#ff5652', '#ffc107', '#ff85af', '#FF9800', '#39bbb0'];

function connect(event) {
    username = document.querySelector('#name').value.trim();
    if (username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');
        currentUserBadge.innerText = username; // Sidebarda ismingiz chiqadi

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}

function onConnected() {
    stompClient.subscribe('/topic/public', onMessageReceived);
    stompClient.subscribe('/topic/private/' + username, onPrivateMessageReceived);

    stompClient.send("/app/chat.addUser", {}, JSON.stringify({sender: username, type: 'JOIN'}));

    fetchUsers();
    fetchMessages(username, "public");
}

function onError(error) {
    typingStatus.textContent = 'Aloqa uzildi. Qayta ulanmoqda...';
    typingStatus.style.color = 'red';
    setTimeout(connect, 5000);
}

function sendMessage(event) {
    event.preventDefault();
    var messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        var chatMessage = {
            sender: username,
            content: messageContent,
            type: 'CHAT'
        };
        if (selectedUser) {
            chatMessage.recipient = selectedUser;
            stompClient.send("/app/chat.private", {}, JSON.stringify(chatMessage));
        } else {
            stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        }
        messageInput.value = '';
    }
}

function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    if (message.type === 'JOIN' || message.type === 'LEAVE') {
        fetchUsers();
    }
    if (!selectedUser && (message.type === 'CHAT' || message.type === 'IMAGE' || message.type === 'JOIN' || message.type === 'LEAVE')) {
        displayMessage(message);
    }
}

function onPrivateMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    if (message.type === 'TYPING') {
        if (selectedUser === message.sender) {
            typingStatus.innerText = "yozmoqda...";
            setTimeout(() => typingStatus.innerText = '', 2000);
        }
        return;
    }
    if (selectedUser === message.sender || (message.sender === username && selectedUser === message.recipient)) {
        displayMessage(message);
    } else {
        // Notification logikasi (Chat user listda qizil bo'lishi mumkin)
    }
}

// --- DIZAYN UCHUN ENG MUHIM O'ZGARISH ---
function displayMessage(message) {
    var messageElement = document.createElement('li');

    if (message.type === 'JOIN' || message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + (message.type === 'JOIN' ? ' qo\'shildi' : ' chiqib ketdi');
    } else {
        messageElement.classList.add('chat-message');

        // Kim yuborganini aniqlash (Style uchun)
        if (message.sender === username) {
            messageElement.classList.add('sender');
        } else {
            messageElement.classList.add('receiver');
        }

        // Avatar (Agar receiver bo'lsa)
        // ... (Avatar kodini keyinroq qo'shsa bo'ladi, hozircha oddiy)

        var usernameText = document.createElement('span');
        usernameText.classList.add('message-sender-name');
        usernameText.innerText = message.sender;
        messageElement.appendChild(usernameText);
    }

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(message.content);
    textElement.appendChild(messageText);
    messageElement.appendChild(textElement);

    // Vaqtni qo'shish
    var date = new Date(message.timestamp || new Date());
    var timeString = date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
    var timeElement = document.createElement('span');
    timeElement.classList.add('message-time');
    timeElement.innerText = timeString;
    messageElement.appendChild(timeElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function fetchUsers() {
    fetch('/users')
        .then(response => response.json())
        .then(data => {
            usersList.innerHTML = '';

            // Public Chat Elementi
            createUserItem("Umumiy Chat", null);

            data.forEach(user => {
                if (user !== username) {
                    createUserItem(user, user);
                }
            });
        });
}

function createUserItem(displayName, chatUser) {
    let li = document.createElement('li');

    // Avatar yasash
    let avatar = document.createElement('div');
    avatar.classList.add('user-avatar');
    avatar.innerText = displayName.charAt(0).toUpperCase();
    avatar.style.backgroundColor = getAvatarColor(displayName);

    let span = document.createElement('span');
    span.innerText = displayName;

    li.appendChild(avatar);
    li.appendChild(span);

    // Active klassni tekshirish
    if ((selectedUser === null && chatUser === null) || (selectedUser === chatUser && chatUser !== null)) {
        li.classList.add('active');
    }

    li.onclick = () => {
        selectedUser = chatUser;
        chatHeader.innerText = displayName;

        // Active klassni o'zgartirish
        document.querySelectorAll('.users-list li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');

        fetchMessages(username, chatUser ? chatUser : "public");
    };

    usersList.appendChild(li);
}

function fetchMessages(sender, recipient) {
    messageArea.innerHTML = '';
    fetch(`/messages/${sender}/${recipient}`)
        .then(response => response.json())
        .then(data => {
            data.forEach(displayMessage);
        });
}

function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

// Listeners
usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', sendMessage, true);
messageInput.addEventListener('input', function() {
    if(selectedUser && stompClient) {
        stompClient.send("/app/chat.private", {}, JSON.stringify({
            sender: username, recipient: selectedUser, type: 'TYPING'
        }));
    }
});