const API_URL = "https://YOUR-RENDER-URL.onrender.com";

const socket = io(API_URL);

let currentUser = "";
let currentUserId = "";

let selectedUser = "";
let currentGroupId = null;

let currentRoom = "";

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

let onlineUsers = [];

/* =========================
ENCRYPTION
========================= */

function getRoomKey() {

    return "SecureSphere_" + currentRoom;
}

function encryptMessage(message) {

    return CryptoJS.AES.encrypt(
        message,
        getRoomKey()
    ).toString();
}

function decryptMessage(cipherText) {

    try {

        const bytes = CryptoJS.AES.decrypt(
            cipherText,
            getRoomKey()
        );

        return bytes.toString(
            CryptoJS.enc.Utf8
        );

    } catch {

        return cipherText;
    }
}

/* =========================
USER ID
========================= */

function generateUserId() {

    return "SSR-" +
        Math.floor(
            100000 + Math.random() * 900000
        );
}

/* =========================
DM ROOM
========================= */

function generateDMRoom(user1, user2) {

    return [user1, user2]
        .sort()
        .join("_");
}

/* =========================
SIGNUP
========================= */

async function signup() {

    const username =
        document.getElementById(
            "username"
        ).value;

    const password =
        document.getElementById(
            "password"
        ).value;

    if (!username || !password) {

        alert("Fill all fields");

        return;
    }

    const userId =
        generateUserId();

    const response = await fetch(
        `${API_URL}/signup`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                username,
                password,
                userId
            })
        }
    );

    const data =
        await response.json();

    alert(data.message);
}

/* =========================
LOGIN
========================= */

async function login() {

    const username =
        document.getElementById(
            "username"
        ).value;

    const password =
        document.getElementById(
            "password"
        ).value;

    const response = await fetch(
        `${API_URL}/login`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                username,
                password
            })
        }
    );

    const data =
        await response.json();

    if (data.success) {

        currentUser = username;

        currentUserId =
            data.userId;

        document.querySelector(
            ".auth-container"
        ).style.display = "none";

        document.getElementById(
            "app"
        ).style.display = "flex";

        document.getElementById(
            "profileName"
        ).innerHTML =
            currentUser;

        document.getElementById(
            "profileId"
        ).innerHTML =
            currentUserId;

        document.getElementById(
            "bioInput"
        ).value =
            data.bio || "";

        if (data.profilePicture) {

            document.getElementById(
                "profileAvatar"
            ).innerHTML = `
                <img
                    src="${data.profilePicture}"
                    class="profile-image"
                >
            `;
        } else {

            document.getElementById(
                "profileAvatar"
            ).innerHTML =
                currentUser[0].toUpperCase();
        }

        socket.emit(
            "user_online",
            {
                username: currentUser
            }
        );

        Notification.requestPermission();

        loadFriends();

        loadFriendRequests();

        loadGroups();

    } else {

        alert("Invalid login");
    }
}

/* =========================
ONLINE USERS
========================= */

socket.on(
    "online_users",
    users => {

        onlineUsers = users;

        loadFriends();
    }
);

/* =========================
ENTER KEY
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .getElementById("sendBtn")
            .addEventListener(
                "click",
                sendMessage
            );

        document
            .getElementById("messageInput")
            .addEventListener(
                "keydown",
                function(event) {

                    if (
                        event.key === "Enter"
                    ) {

                        event.preventDefault();

                        sendMessage();
                    }
                }
            );

        document
            .getElementById("messageInput")
            .addEventListener(
                "input",
                () => {

                    socket.emit(
                        "typing",
                        {
                            sender:
                                currentUser,

                            room:
                                currentRoom
                        }
                    );
                }
            );
    }
);

/* =========================
SOCKETS
========================= */

socket.on(
    "friend_request_update",
    () => {

        loadFriendRequests();
    }
);

socket.on(
    "friend_update",
    () => {

        loadFriends();

        loadFriendRequests();
    }
);

socket.on(
    "group_update",
    () => {

        loadGroups();
    }
);

socket.on(
    "typing",
    data => {

        if (

            data.room === currentRoom &&

            data.sender !== currentUser

        ) {

            document.getElementById(
                "typingIndicator"
            ).innerHTML =
                `${data.sender} is typing...`;

            setTimeout(() => {

                document.getElementById(
                    "typingIndicator"
                ).innerHTML = "";

            }, 1000);
        }
    }
);

socket.on(
    "receive_message",
    data => {

        if (
            data.room === currentRoom
        ) {

            addMessageToUI(data);
        }

        if (
            Notification.permission ===
            "granted"
        ) {

            new Notification(
                `Message from ${data.sender}`,
                {
                    body: "New message received"
                }
            );
        }
    }
);

/* =========================
SHOW SECTION
========================= */

function showSection(section) {

    document.getElementById(
        "groupsSection"
    ).style.display = "none";

    document.getElementById(
        "dmsSection"
    ).style.display = "none";

    document.getElementById(
        "profileSection"
    ).style.display = "none";

    if (section === "groups") {

        document.getElementById(
            "groupsSection"
        ).style.display = "block";
    }

    if (section === "dms") {

        document.getElementById(
            "dmsSection"
        ).style.display = "block";
    }

    if (section === "profile") {

        document.getElementById(
            "profileSection"
        ).style.display = "block";
    }
}

/* =========================
FRIEND REQUEST
========================= */

async function sendFriendRequest() {

    const friendId =
        document.getElementById(
            "friendIdInput"
        ).value;

    if (!friendId) return;

    const response = await fetch(
        `${API_URL}/send_request`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                senderId:
                    currentUserId,

                receiverId:
                    friendId
            })
        }
    );

    const data =
        await response.json();

    if (data.success) {

        alert("Friend request sent");

        document.getElementById(
            "friendIdInput"
        ).value = "";
    }
}

/* =========================
LOAD REQUESTS
========================= */

async function loadFriendRequests() {

    const response =
        await fetch(
            `${API_URL}/requests/${currentUserId}`
        );

    const requests =
        await response.json();

    const requestsList =
        document.getElementById(
            "requestsList"
        );

    requestsList.innerHTML = "";

    requests.forEach(req => {

        requestsList.innerHTML += `

            <div class="user-item">

                <div class="user-avatar">
                    ${req.username[0].toUpperCase()}
                </div>

                <div style="flex:1;">

                    <div class="user-name">
                        ${req.username}
                    </div>

                    <div class="user-bio">
                        ${req.senderId}
                    </div>

                </div>

                <button
                    onclick="acceptFriend('${req.senderId}')"
                >
                    Accept
                </button>

            </div>
        `;
    });
}

/* =========================
ACCEPT FRIEND
========================= */

async function acceptFriend(senderId) {

    await fetch(
        `${API_URL}/accept_request`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                senderId,

                receiverId:
                    currentUserId
            })
        }
    );
}

/* =========================
LOAD FRIENDS
========================= */

async function loadFriends() {

    const response =
        await fetch(
            `${API_URL}/friends/${currentUserId}`
        );

    const friends =
        await response.json();

    const friendsList =
        document.getElementById(
            "friendsList"
        );

    friendsList.innerHTML = "";

    friends.forEach(friend => {

        const status =
            onlineUsers.includes(
                friend.username
            )
                ? "🟢 Online"
                : "⚫ Offline";

        friendsList.innerHTML += `

            <div
                class="user-item"
                onclick="openDM('${friend.username}')"
            >

                <div class="user-avatar">

                    ${
                        friend.profilePicture

                        ? `<img src="${friend.profilePicture}">`

                        : friend.username[0].toUpperCase()
                    }

                </div>

                <div>

                    <div class="user-name">
                        ${friend.username}
                    </div>

                    <div class="user-status">
                        ${status}
                    </div>

                    <div class="user-bio">
                        ${friend.userId}
                    </div>

                </div>

            </div>
        `;
    });
}

/* =========================
OPEN DM
========================= */

async function openDM(username) {

    selectedUser = username;

    currentGroupId = null;

    currentRoom =
        generateDMRoom(
            currentUser,
            username
        );

    document.getElementById(
        "chatTitle"
    ).innerHTML =
        username;

    loadMessages(currentRoom);
}

/* =========================
GROUPS
========================= */

async function createGroup() {

    const groupName =
        prompt("Enter Group Name");

    if (!groupName) return;

    const response = await fetch(
        `${API_URL}/create_group`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                groupName,

                creatorId:
                    currentUserId
            })
        }
    );

    const data =
        await response.json();

    renderGroup(
        groupName,
        data.groupId
    );
}

/* =========================
LOAD GROUPS
========================= */

async function loadGroups() {

    const response =
        await fetch(
            `${API_URL}/groups/${currentUserId}`
        );

    const groups =
        await response.json();

    const groupsList =
        document.getElementById(
            "groupsList"
        );

    groupsList.innerHTML = "";

    groups.forEach(group => {

        renderGroup(
            group.groupName,
            group.groupId
        );
    });
}

/* =========================
RENDER GROUP
========================= */

function renderGroup(
    groupName,
    groupId
) {

    const groupsList =
        document.getElementById(
            "groupsList"
        );

    groupsList.innerHTML += `

        <div class="user-item">

            <div
                onclick="openGroup('${groupName}', '${groupId}')"
                style="
                    flex:1;
                    display:flex;
                    align-items:center;
                    gap:12px;
                "
            >

                <div class="user-avatar">
                    ${groupName[0].toUpperCase()}
                </div>

                <div class="user-name">
                    ${groupName}
                </div>

            </div>

            <button
                onclick="addFriendToGroup('${groupId}')"
            >
                +
            </button>

            <button
                onclick="deleteGroup('${groupId}')"
            >
                ✖
            </button>

        </div>
    `;
}

/* =========================
OPEN GROUP
========================= */

async function openGroup(
    groupName,
    groupId
) {

    selectedUser = "";

    currentGroupId = groupId;

    currentRoom =
        `group_${groupId}`;

    document.getElementById(
        "chatTitle"
    ).innerHTML =
        `# ${groupName}`;

    loadMessages(currentRoom);
}

/* =========================
DELETE GROUP
========================= */

async function deleteGroup(groupId) {

    await fetch(
        `${API_URL}/delete_group/${groupId}`,
        {
            method: "DELETE"
        }
    );
}

/* =========================
ADD FRIEND TO GROUP
========================= */

async function addFriendToGroup(groupId) {

    const friendId =
        prompt(
            "Enter Friend User ID"
        );

    if (!friendId) return;

    await fetch(
        `${API_URL}/add_group_member`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({

                groupId,

                userId:
                    friendId
            })
        }
    );

    alert("Friend added");
}

/* =========================
SEND MESSAGE
========================= */

function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );

    const message =
        input.value;

    if (
        message.trim() === ""
    ) return;

    const encrypted =
        encryptMessage(message);

    socket.emit(
        "send_message",
        {
            sender:
                currentUser,

            receiver:
                selectedUser ||
                currentGroupId,

            room:
                currentRoom,

            message:
                encrypted,

            type:
                "text"
        }
    );

    input.value = "";
}

/* =========================
LOAD MESSAGES
========================= */

async function loadMessages(room) {

    const response =
        await fetch(
            `${API_URL}/messages/${room}`
        );

    const messagesData =
        await response.json();

    const messages =
        document.getElementById(
            "messages"
        );

    messages.innerHTML = "";

    messagesData.forEach(msg => {

        addMessageToUI(msg);
    });
}

/* =========================
MESSAGE UI
========================= */

function addMessageToUI(data) {

    const messages =
        document.getElementById(
            "messages"
        );

    const div =
        document.createElement("div");

    div.classList.add("message");

    if (
        data.sender === currentUser
    ) {

        div.classList.add(
            "my-message"
        );
    }

    let content =
        decryptMessage(
            data.message
        );

    if (
        data.type === "image"
    ) {

        content = `
            <img
                src="${data.message}"
                class="chat-image"
            >
        `;
    }

    if (
        data.type === "audio"
    ) {

        content = `
            <audio controls>
                <source src="${data.message}">
            </audio>
        `;
    }

    if (
        data.type === "file"
    ) {

        content = `
            <a
                href="${data.message}"
                target="_blank"
            >
                📎 File
            </a>
        `;
    }

    const reactions =
        data.reactions
            ? data.reactions.join(" ")
            : "";

    div.innerHTML = `

        <div class="username">
            ${data.sender}
        </div>

        <div>
            ${content}
        </div>

        <div class="timestamp">

            ${new Date(
                data.timestamp
            ).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })}

        </div>

        <div class="status">

            ${
                data.status === "seen"
                    ? "✓✓ Seen"
                    : "✓ Sent"
            }

        </div>

        <div class="reaction-bar">

            <button onclick="reactMessage(${data.id}, '❤️')">
                ❤️
            </button>

            <button onclick="reactMessage(${data.id}, '🔥')">
                🔥
            </button>

            <button onclick="reactMessage(${data.id}, '😂')">
                😂
            </button>

            <span>${reactions}</span>

        </div>
    `;

    messages.appendChild(div);

    messages.scrollTop =
        messages.scrollHeight;
}

/* =========================
REACTIONS
========================= */

async function reactMessage(
    messageId,
    emoji
) {

    await fetch(
        `${API_URL}/react`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                messageId,
                emoji
            })
        }
    );

    loadMessages(currentRoom);
}

/* =========================
FILES
========================= */

function chooseFile() {

    document
        .getElementById(
            "fileInput"
        )
        .click();
}

document
    .getElementById(
        "fileInput"
    )
    .addEventListener(
        "change",
        uploadFile
    );

/* =========================
UPLOAD FILE
========================= */

async function uploadFile() {

    const file =
        document.getElementById(
            "fileInput"
        ).files[0];

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    const response =
        await fetch(
            `${API_URL}/upload`,
            {
                method: "POST",
                body: formData
            }
        );

    const data =
        await response.json();

    const fileUrl =
        `${API_URL}/uploads/${data.filename}`;

    let type = "file";

    if (
        file.type.startsWith(
            "image/"
        )
    ) {

        type = "image";
    }

    socket.emit(
        "send_message",
        {
            sender:
                currentUser,

            receiver:
                selectedUser ||
                currentGroupId,

            room:
                currentRoom,

            message:
                fileUrl,

            type
        }
    );
}

/* =========================
VOICE RECORDING
========================= */

async function toggleRecording() {

    const recordBtn =
        document.getElementById(
            "recordBtn"
        );

    if (!isRecording) {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        mediaRecorder =
            new MediaRecorder(stream);

        audioChunks = [];

        mediaRecorder.start();

        isRecording = true;

        recordBtn.innerHTML = "⏹";

        mediaRecorder.ondataavailable =
            e => {

                audioChunks.push(e.data);
            };

    } else {

        mediaRecorder.stop();

        mediaRecorder.onstop =
            async () => {

                const blob =
                    new Blob(audioChunks, {
                        type: "audio/webm"
                    });

                const formData =
                    new FormData();

                formData.append(
                    "file",
                    blob,
                    "voice.webm"
                );

                const response =
                    await fetch(
                        `${API_URL}/upload`,
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                const data =
                    await response.json();

                const audioUrl =
                    `${API_URL}/uploads/${data.filename}`;

                socket.emit(
                    "send_message",
                    {
                        sender:
                            currentUser,

                        receiver:
                            selectedUser ||
                            currentGroupId,

                        room:
                            currentRoom,

                        message:
                            audioUrl,

                        type:
                            "audio"
                    }
                );
            };

        isRecording = false;

        recordBtn.innerHTML = "🎤";
    }
}

/* =========================
PROFILE PICTURE
========================= */

async function uploadProfilePic() {

    const file =
        document.getElementById(
            "profilePicInput"
        ).files[0];

    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    const response =
        await fetch(
            `${API_URL}/upload`,
            {
                method: "POST",
                body: formData
            }
        );

    const data =
        await response.json();

    const imageUrl =
        `${API_URL}/uploads/${data.filename}`;

    document.getElementById(
        "profileAvatar"
    ).innerHTML = `
        <img
            src="${imageUrl}"
            class="profile-image"
        >
    `;

    await fetch(
        `${API_URL}/update_profile`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                username:
                    currentUser,

                bio:
                    document.getElementById(
                        "bioInput"
                    ).value,

                profilePicture:
                    imageUrl
            })
        }
    );
}

/* =========================
SAVE BIO
========================= */

async function saveBio() {

    const bio =
        document.getElementById(
            "bioInput"
        ).value;

    await fetch(
        `${API_URL}/update_profile`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                username:
                    currentUser,

                bio
            })
        }
    );

    alert("Bio updated");
}

/* =========================
THEME
========================= */

function toggleTheme() {

    document.body.classList.toggle(
        "light-mode"
    );
}

/* =========================
AI
========================= */

function askAI() {

    const input =
        prompt(
            "Ask SecureAI"
        );

    if (!input) return;

    addMessageToUI({
        sender:
            "SecureAI",

        message:
            encryptMessage(
                `AI Response to: ${input}`
            ),

        type:
            "text",

        timestamp:
            new Date(),

        status:
            "seen",

        reactions:
            []
    });
}