'use strict';

var stompClient = null;
var username = null;
var selectedUser = null;

// HTML elementlar
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
var fileInput = document.getElementById('fileInput'); // HTMLda fileInput ID bo'lishi kerak

var colors = ['#2196F3', '#32c787', '#00BCD4', '#ff5652', '#ffc107', '#ff85af', '#FF9800', '#39bbb0'];
var unreadMessages = {}; // O'qilmagan xabarlarni saqlash uchun

// 1. ULANISH
function connect(event) {
    username = document.querySelector('#name').value.trim();
    if (username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');
        currentUserBadge.innerText = username;

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}

function onConnected() {
    // Obunalar
    stompClient.subscribe('/topic/public', onMessageReceived);
    stompClient.subscribe('/topic/private/' + username, onPrivateMessageReceived);

    // User qo'shish
    stompClient.send("/app/chat.addUser", {}, JSON.stringify({sender: username, type: 'JOIN'}));

    fetchUsers();
    fetchMessages(username, "public");
}

function onError(error) {
    typingStatus.textContent = 'Aloqa uzildi. Qayta ulanmoqda...';
    typingStatus.style.color = 'red';
    setTimeout(connect, 5000);
}

// 2. TEXT XABAR YUBORISH
function sendMessage(event) {
    event.preventDefault();
    var messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        var chatMessage = {
            sender: username,
            content: messageContent,
            type: 'CHAT'
        };
        sendToSocket(chatMessage);
        messageInput.value = '';
    }
}

// 3. FAYL YUKLASH (YANGI FUNKSIYA)
if(fileInput) {
    fileInput.addEventListener('change', function(event) {
        var file = event.target.files[0];
        if (file) {
            var formData = new FormData();
            formData.append("file", file);

            // Loading holati (ixtiyoriy)
            typingStatus.innerText = "Fayl yuklanmoqda...";

            fetch('/api/files/upload', {
                method: 'POST',
                body: formData
            })
                .then(response => {
                    if(response.ok) return response.text();
                    throw new Error("Upload xatosi");
                })
                .then(fileUrl => {
                    typingStatus.innerText = "";
                    // Rasm yoki oddiy Fayl ekanligini aniqlash
                    var type = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';

                    var chatMessage = {
                        sender: username,
                        content: fileUrl,
                        type: type
                    };
                    sendToSocket(chatMessage);
                    event.target.value = ''; // Inputni tozalash
                })
                .catch(error => {
                    console.error("Xatolik:", error);
                    typingStatus.innerText = "Xatolik yuz berdi!";
                });
        }
    });
}

// Yordamchi: Socketga yuborish
function sendToSocket(chatMessage) {
    if (selectedUser) {
        chatMessage.recipient = selectedUser;
        stompClient.send("/app/chat.private", {}, JSON.stringify(chatMessage));
        // O'zimizga ham chiqarish (agar private bo'lsa)
        displayMessage(chatMessage);
    } else {
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
    }
}

// 4. PUBLIC XABAR KELISHI
function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    if (message.type === 'JOIN' || message.type === 'LEAVE') {
        fetchUsers();
    }
    // Agar Public chat ochiq bo'lsa
    if (!selectedUser) {
        displayMessage(message);
    }
}

// 5. PRIVATE XABAR KELISHI (SORTING & BADGE)
function onPrivateMessageReceived(payload) {
    var message = JSON.parse(payload.body);

    // Typing...
    if (message.type === 'TYPING') {
        if (selectedUser === message.sender) {
            typingStatus.innerText = "yozmoqda...";
            setTimeout(() => typingStatus.innerText = '', 2000);
        }
        return;
    }

    // A) Agar chat ochiq bo'lsa (Active)
    if (selectedUser === message.sender) {
        displayMessage(message);
    }
    // B) Agar chat yopiq bo'lsa yoki boshqa odamdan kelsa
    else if (message.sender !== username) {
        // 1. Counter oshirish
        if (!unreadMessages[message.sender]) unreadMessages[message.sender] = 0;
        unreadMessages[message.sender]++;

        // 2. Badge chizish
        updateUnreadBadge(message.sender);

        // 3. Userni tepaga ko'tarish
        moveUserToTop(message.sender);
    }
}

// 6. EKRANGA CHIQARISH (RASM VA FAYL BILAN)
function displayMessage(message) {
    // Agar typing yoki boshqa texnik xabar bo'lsa chiqarmaymiz
    if(message.type === 'TYPING') return;

    var messageElement = document.createElement('li');

    if (message.type === 'JOIN' || message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + (message.type === 'JOIN' ? ' qo\'shildi' : ' chiqib ketdi');
    } else {
        messageElement.classList.add('chat-message');

        if (message.sender === username) {
            messageElement.classList.add('sender');
        } else {
            messageElement.classList.add('receiver');
        }

        var usernameText = document.createElement('span');
        usernameText.classList.add('message-sender-name');
        usernameText.innerText = message.sender;
        messageElement.appendChild(usernameText);
    }

    // CONTENT TURI (TEXT, IMAGE, FILE)
    var contentElement;
    if (message.type === 'IMAGE') {
        contentElement = document.createElement('img');
        contentElement.src = message.content;
        contentElement.style.maxWidth = '200px';
        contentElement.style.borderRadius = '10px';
        contentElement.style.cursor = 'pointer';
        contentElement.onclick = () => window.open(message.content, '_blank');
    }
    else if (message.type === 'FILE') {
        contentElement = document.createElement('a');
        contentElement.href = message.content;
        contentElement.target = "_blank";
        contentElement.classList.add('file-attachment');

        // Fayl nomini chiroyli qilish
        let fileName = message.content.split('/').pop().split('_').slice(1).join('_') || "Fayl";
        contentElement.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i> ${fileName}`;
        contentElement.style.display = "block";
        contentElement.style.background = "#f1f1f1";
        contentElement.style.padding = "10px";
        contentElement.style.borderRadius = "5px";
        contentElement.style.textDecoration = "none";
        contentElement.style.color = "#333";
    }
    else {
        contentElement = document.createElement('p');
        var messageText = document.createTextNode(message.content);
        contentElement.appendChild(messageText);
    }

    messageElement.appendChild(contentElement);

    // VAQT
    var date = new Date(message.timestamp || new Date());
    var timeString = date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
    var timeElement = document.createElement('span');
    timeElement.classList.add('message-time');
    timeElement.innerText = timeString;
    messageElement.appendChild(timeElement);

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

// 7. USERLARNI OLISH VA BADGE QO'SHISH
function fetchUsers() {
    fetch('/users')
        .then(response => response.json())
        .then(data => {
            usersList.innerHTML = '';
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
    li.id = "user-item-" + displayName; // ID beramiz (topish oson bo'lishi uchun)

    let avatar = document.createElement('div');
    avatar.classList.add('user-avatar');
    avatar.innerText = displayName.charAt(0).toUpperCase();
    avatar.style.backgroundColor = getAvatarColor(displayName);

    let span = document.createElement('span');
    span.innerText = displayName;

    // BADGE element (Yashirin bo'ladi boshida)
    let badge = document.createElement('span');
    badge.classList.add('unread-badge');
    badge.id = "badge-" + displayName;
    badge.innerText = "0";
    badge.style.display = 'none'; // CSSda ham .unread-badge uchun stil yozish kerak

    li.appendChild(avatar);
    li.appendChild(span);
    li.appendChild(badge);

    if ((selectedUser === null && chatUser === null) || (selectedUser === chatUser && chatUser !== null)) {
        li.classList.add('active');
    }

    li.onclick = () => {
        selectedUser = chatUser;
        chatHeader.innerText = displayName;

        // O'qilgan deb belgilash
        if (chatUser) {
            unreadMessages[chatUser] = 0;
            updateUnreadBadge(chatUser);
        }

        document.querySelectorAll('.users-list li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');

        fetchMessages(username, chatUser ? chatUser : "public");
    };

    usersList.appendChild(li);
}

// 8. YORDAMCHI FUNKSIYALAR

// Badgeni yangilash
function updateUnreadBadge(username) {
    let badge = document.getElementById("badge-" + username);
    if (badge) {
        let count = unreadMessages[username] || 0;
        if (count > 0) {
            badge.style.display = 'inline-block'; // Yoki 'flex' css ga qarab
            badge.innerText = count;
            badge.style.backgroundColor = 'red';
            badge.style.color = 'white';
            badge.style.borderRadius = '50%';
            badge.style.padding = '2px 6px';
            badge.style.fontSize = '12px';
            badge.style.marginLeft = 'auto';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Userni ro'yxat boshiga o'tkazish
function moveUserToTop(username) {
    let li = document.getElementById("user-item-" + username);
    if (li) {
        // "Umumiy Chat"dan keyin qo'yish (agar Umumiy Chat har doim tepada tursin desangiz)
        let publicChat = usersList.firstElementChild;
        if(publicChat) {
            usersList.insertBefore(li, publicChat.nextSibling);
        } else {
            usersList.prepend(li);
        }
    }
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

// Typing Listener
messageInput.addEventListener('input', function () {
    if (selectedUser && stompClient) {
        stompClient.send("/app/chat.private", {}, JSON.stringify({
            sender: username, recipient: selectedUser, type: 'TYPING'
        }));
    }
});