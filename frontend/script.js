const API_URL = "http://127.0.0.1:5000";

const socket = io(API_URL);

let currentUser = "";
let currentUserId = "";

let selectedUser = "";
let currentGroupId = null;

let currentRoom = "";

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

/* USER ID */

function generateUserId() {

    return "SSR-" +
        Math.floor(
            100000 + Math.random() * 900000
        );
}

/* ROOM */

function generateDMRoom(user1, user2) {

    return [user1, user2]
        .sort()
        .join("_");
}

/* SIGNUP */

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

/* LOGIN */

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
            "profileAvatar"
        ).innerHTML =
            currentUser[0].toUpperCase();

        document.getElementById(
            "profileId"
        ).innerHTML =
            currentUserId;

        document.getElementById(
            "bioInput"
        ).value =
            data.bio || "";

        loadFriends();
        loadFriendRequests();
        loadGroups();

    } else {

        alert("Invalid login");
    }
}

/* ENTER KEY */

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
    }
);

/* SOCKET */

socket.on(
    "friend_request_update",
    () => {

        loadFriendRequests();
    }
);

socket.on(
    "friend_update",
    () => {

        loadFriendRequests();

        loadFriends();
    }
);

socket.on(
    "group_update",
    () => {

        loadGroups();
    }
);

socket.on(
    "receive_message",
    (data) => {

        if (
            data.room === currentRoom
        ) {

            addMessageToUI(data);
        }
    }
);

/* SECTION */

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

/* FRIEND REQUEST */

async function sendFriendRequest() {

    const friendId =
        document.getElementById(
            "friendIdInput"
        ).value;

    if (!friendId) {

        alert("Enter user ID");

        return;
    }

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

        alert(
            "Friend request sent"
        );

        document.getElementById(
            "friendIdInput"
        ).value = "";
    }
}

/* LOAD REQUESTS */

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
                    style="
                        background:#2563eb;
                        border:none;
                        color:white;
                        padding:8px;
                        border-radius:8px;
                    "
                >
                    Accept
                </button>

            </div>
        `;
    });
}

/* ACCEPT */

async function acceptFriend(senderId) {

    const response = await fetch(
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

    const data =
        await response.json();

    if (data.success) {

        loadFriendRequests();

        loadFriends();
    }
}

/* FRIENDS */

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

        friendsList.innerHTML += `

            <div
                class="user-item"
                onclick="openDM('${friend.username}')"
            >

                <div class="user-avatar">
                    ${friend.username[0].toUpperCase()}
                </div>

                <div>

                    <div class="user-name">
                        ${friend.username}
                    </div>

                    <div class="user-bio">
                        ${friend.userId}
                    </div>

                </div>

            </div>
        `;
    });
}

/* OPEN DM */

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

    await loadMessages(currentRoom);
}

/* CREATE GROUP */

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

/* LOAD GROUPS */

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

/* RENDER GROUP */

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
                style="
                    background:#2563eb;
                    border:none;
                    color:white;
                    padding:8px;
                    border-radius:8px;
                "
            >
                +
            </button>

            <button
                onclick="deleteGroup('${groupId}')"
                style="
                    background:red;
                    border:none;
                    color:white;
                    padding:8px;
                    border-radius:8px;
                "
            >
                ✖
            </button>

        </div>
    `;
}

/* OPEN GROUP */

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

    await loadMessages(currentRoom);
}

/* DELETE GROUP */

async function deleteGroup(groupId) {

    await fetch(
        `${API_URL}/delete_group/${groupId}`,
        {
            method: "DELETE"
        }
    );
}

/* ADD FRIEND TO GROUP */

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

    alert(
        "Friend added"
    );
}

/* SEND */

function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );

    const message =
        input.value;

    if (
        message.trim() === ""
    ) {

        return;
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

            message,

            type:
                "text"
        }
    );

    input.value = "";
}

/* LOAD MESSAGES */

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

/* MESSAGE UI */

function addMessageToUI(data) {

    const messages =
        document.getElementById(
            "messages"
        );

    const div =
        document.createElement("div");

    div.classList.add(
        "message"
    );

    if (
        data.sender === currentUser
    ) {

        div.classList.add(
            "my-message"
        );
    }

    let content =
        data.message;

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

    div.innerHTML = `

        <div class="username">
            ${data.sender}
        </div>

        <div>
            ${content}
        </div>
    `;

    messages.appendChild(div);

    messages.scrollTop =
        messages.scrollHeight;
}

/* FILE */

function chooseFile() {

    document
        .getElementById(
            "fileInput"
        )
        .click();
}

/* UPLOAD */

document
    .getElementById(
        "fileInput"
    )
    .addEventListener(
        "change",
        uploadFile
    );

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

/* VOICE */

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

/* BIO */

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