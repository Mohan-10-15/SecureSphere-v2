/* =========================
CONFIG
========================= */

const API_URL = "https://secure-messeger.onrender.com";

const socket = io(API_URL);

let currentUser = "";
let currentUserId = "";

let currentRoom = "";
let currentChatType = "";

let selectedUser = "";
let selectedGroup = "";

let onlineUsers = [];

let mediaRecorder;
let audioChunks = [];
let isRecording = false;

const messagesContainer =
    document.getElementById(
        "messages"
    );

/* =========================
ENCRYPTION
========================= */

function getRoomKey() {

    return (
        "SecureSphere_" +
        currentRoom
    );
}

function encryptMessage(message) {

    return CryptoJS.AES.encrypt(
        message,
        getRoomKey()
    ).toString();
}

function decryptMessage(cipher) {

    try {

        const bytes =
            CryptoJS.AES.decrypt(
                cipher,
                getRoomKey()
            );

        return bytes.toString(
            CryptoJS.enc.Utf8
        );

    } catch {

        return cipher;
    }
}

/* =========================
USER ID
========================= */

function generateUserId() {

    return (
        "SSR-" +
        Math.floor(
            100000 +
            Math.random() * 900000
        )
    );
}

/* =========================
ROOM
========================= */

function generateDMRoom(
    user1,
    user2
) {

    return [user1, user2]
        .sort()
        .join("_");
}

/* =========================
CLEAR CHAT
========================= */

function clearChatState() {

    currentRoom = "";

    currentChatType = "";

    selectedUser = "";

    selectedGroup = "";

    messagesContainer.innerHTML = "";

    document.getElementById(
        "typingIndicator"
    ).innerHTML = "";

    document.getElementById(
        "chatTitle"
    ).innerHTML =
        "SecureSphere";

    document.getElementById(
        "chatSubtitle"
    ).innerHTML =
        "Select a chat";

    document.getElementById(
        "chatAvatar"
    ).innerHTML = "#";
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

        alert(
            "Fill all fields"
        );

        return;
    }

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

                userId:
                    generateUserId()
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

    if (!data.success) {

        alert(
            "Invalid login"
        );

        return;
    }

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
                src="${data.profilePicture}?t=${Date.now()}"
                class="profile-image"
            >
        `;
    }

    socket.emit(
        "user_online",
        {
            username:
                currentUser
        }
    );

    Notification.requestPermission();

    loadFriends();

    loadFriendRequests();

    loadGroups();
}

/* =========================
NAVIGATION
========================= */

function resetNav() {

    document
        .querySelectorAll(".nav-btn")
        .forEach(btn => {

            btn.classList.remove(
                "active-nav"
            );
        });
}

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

    clearChatState();

    resetNav();

    if (section === "groups") {

        document.getElementById(
            "groupsSection"
        ).style.display = "block";

        document.getElementById(
            "groupsTab"
        ).classList.add(
            "active-nav"
        );
    }

    if (section === "dms") {

        document.getElementById(
            "dmsSection"
        ).style.display = "block";

        document.getElementById(
            "dmsTab"
        ).classList.add(
            "active-nav"
        );
    }

    if (section === "profile") {

        document.getElementById(
            "profileSection"
        ).style.display = "block";

        document.getElementById(
            "profileTab"
        ).classList.add(
            "active-nav"
        );
    }
}

/* =========================
SOCKET EVENTS
========================= */

socket.on(
    "online_users",
    users => {

        onlineUsers = users;

        loadFriends();
    }
);

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
    "reaction_update",
    () => {

        if (currentRoom) {

            loadMessages(
                currentRoom
            );
        }
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

            clearTimeout(
                window.typingTimeout
            );

            window.typingTimeout =
                setTimeout(() => {

                    document.getElementById(
                        "typingIndicator"
                    ).innerHTML = "";

                }, 1400);
        }
    }
);

socket.on(
    "receive_message",
    data => {

        if (
            data.room === currentRoom
        ) {

            addMessageToUI(
                data
            );
        }

        if (
            Notification.permission ===
            "granted"
        ) {

            new Notification(
                data.sender,
                {
                    body:
                        "New message"
                }
            );
        }
    }
);
/* =========================
INPUT EVENTS
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
                e => {

                    if (
                        e.key === "Enter"
                    ) {

                        e.preventDefault();

                        sendMessage();
                    }
                }
            );

        document
            .getElementById("messageInput")
            .addEventListener(
                "input",
                () => {

                    if (!currentRoom)
                        return;

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

        document
            .getElementById("fileInput")
            .addEventListener(
                "change",
                uploadFile
            );
    }
);

/* =========================
FRIEND REQUESTS
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

        alert(
            "Friend request sent"
        );
    }

    else {

        alert(
            "Cannot send request"
        );
    }
}

async function loadFriendRequests() {

    const response =
        await fetch(
            `${API_URL}/requests/${currentUserId}`
        );

    const requests =
        await response.json();

    const container =
        document.getElementById(
            "requestsList"
        );

    container.innerHTML = "";

    requests.forEach(req => {

        container.innerHTML += `

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
                    class="mini-btn"
                    onclick="acceptFriend('${req.senderId}')"
                >
                    ✓
                </button>

            </div>
        `;
    });
}

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
FRIENDS
========================= */

async function loadFriends() {

    const response =
        await fetch(
            `${API_URL}/friends/${currentUserId}`
        );

    const friends =
        await response.json();

    const container =
        document.getElementById(
            "friendsList"
        );

    container.innerHTML = "";

    friends.forEach(friend => {

        const online =
            onlineUsers.includes(
                friend.username
            );

        container.innerHTML += `

            <div
                class="user-item"

                onclick="openDM(
                    '${friend.username}',
                    '${friend.profilePicture || ""}'
                )"
            >

                <div class="user-avatar">

                    ${
                        friend.profilePicture

                        ? `
                        <img
                            src="${friend.profilePicture}?t=${Date.now()}"
                        >
                        `

                        : friend.username[0].toUpperCase()
                    }

                </div>

                <div>

                    <div class="user-name">
                        ${friend.username}
                    </div>

                    <div class="user-status">
                        ${
                            online
                            ? "🟢 Online"
                            : "⚫ Offline"
                        }
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
DM
========================= */

async function openDM(
    username,
    picture
) {

    messagesContainer.innerHTML = "";

    currentChatType = "dm";

    selectedGroup = "";

    selectedUser = username;

    currentRoom =
        generateDMRoom(
            currentUser,
            username
        );

    document.getElementById(
        "chatTitle"
    ).innerHTML =
        username;

    document.getElementById(
        "chatSubtitle"
    ).innerHTML =
        "Direct Message";

    document.getElementById(
        "chatAvatar"
    ).innerHTML = picture

        ? `
        <img
            src="${picture}?t=${Date.now()}"
            class="profile-image"
        >
        `

        : username[0].toUpperCase();

    loadMessages(
        currentRoom
    );
}

/* =========================
GROUPS
========================= */

async function createGroup() {

    const groupName =
        prompt(
            "Enter Group Name"
        );

    if (!groupName) return;

    await fetch(
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
}

async function openGroup(
    groupName,
    groupId
) {

    messagesContainer.innerHTML = "";

    currentChatType = "group";

    selectedUser = "";

    selectedGroup = String(
        groupId
    );

    currentRoom =
        `group_${groupId}`;

    document.getElementById(
        "chatTitle"
    ).innerHTML =
        groupName;

    document.getElementById(
        "chatSubtitle"
    ).innerHTML =
        "Group Chat";

    document.getElementById(
        "chatAvatar"
    ).innerHTML = "#";

    loadMessages(
        currentRoom
    );
}

async function loadGroups() {

    const response =
        await fetch(
            `${API_URL}/groups/${currentUserId}`
        );

    const groups =
        await response.json();

    const container =
        document.getElementById(
            "groupsList"
        );

    container.innerHTML = "";

    groups.forEach(group => {

        container.innerHTML += `

            <div class="user-item">

                <div
                    style="
                        flex:1;
                        display:flex;
                        align-items:center;
                        gap:12px;
                    "

                    onclick="openGroup(
                        '${group.groupName}',
                        '${group.groupId}'
                    )"
                >

                    <div class="user-avatar">

                        ${
                            group.groupPicture

                            ? `
                            <img
                                src="${group.groupPicture}"
                            >
                            `

                            : "#"
                        }

                    </div>

                    <div>

                        <div class="user-name">
                            ${group.groupName}
                        </div>

                    </div>

                </div>

            </div>
        `;
    });
}

/* =========================
GROUP PICTURE
========================= */

async function changeGroupPicture() {

    if (!selectedGroup) {

        alert(
            "Open a group first"
        );

        return;
    }

    const input =
        document.createElement(
            "input"
        );

    input.type = "file";

    input.accept = "image/*";

    input.click();

    input.onchange = async () => {

        const file =
            input.files[0];

        if (!file) return;

        const formData =
            new FormData();

        formData.append(
            "file",
            file
        );

        const uploadResponse =
            await fetch(
                `${API_URL}/upload`,
                {
                    method: "POST",
                    body: formData
                }
            );

        const uploadData =
            await uploadResponse.json();

        const imageUrl =
            `${API_URL}/uploads/${uploadData.filename}?t=${Date.now()}`;

        const updateResponse =
            await fetch(
                `${API_URL}/update_group_picture`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        groupId:
                            selectedGroup,

                        groupPicture:
                            imageUrl
                    })
                }
            );

        const result =
            await updateResponse.json();

        if (result.success) {

            alert(
                "Group picture updated"
            );

            loadGroups();

            document.getElementById(
                "chatAvatar"
            ).innerHTML = `
                <img
                    src="${imageUrl}"
                    class="profile-image"
                >
            `;
        }
    };
}

/* =========================
SEND MESSAGE
========================= */

function sendMessage() {

    const input =
        document.getElementById(
            "messageInput"
        );

    const text =
        input.value.trim();

    if (!text) return;

    if (!currentRoom) {

        alert(
            "Open a chat first"
        );

        return;
    }

    socket.emit(
        "send_message",
        {

            sender:
                currentUser,

            receiver:
                selectedUser ||
                selectedGroup,

            room:
                currentRoom,

            message:
                encryptMessage(
                    text
                ),

            type:
                "text"
        }
    );

    input.value = "";
}

/* =========================
MESSAGES
========================= */

async function loadMessages(room) {

    const response =
        await fetch(
            `${API_URL}/messages/${room}`
        );

    const data =
        await response.json();

    messagesContainer.innerHTML = "";

    data.forEach(msg => {

        addMessageToUI(
            msg
        );
    });
}

function addMessageToUI(data) {

    const div =
        document.createElement(
            "div"
        );

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
        decryptMessage(
            data.message
        );

    div.innerHTML = `

        <div class="username">
            ${data.sender}
        </div>

        <div>
            ${content}
        </div>

        <div class="timestamp">
            ${new Date(
                data.timestamp + "Z"
            ).toLocaleTimeString([], {

                hour: "2-digit",
                minute: "2-digit",

                hour12: true
            })}
        </div>
    `;

    messagesContainer.appendChild(
        div
    );

    requestAnimationFrame(() => {

        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;

    });
}

/* =========================
UPLOAD
========================= */

function chooseFile() {

    document.getElementById(
        "fileInput"
    ).click();
}

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

    socket.emit(
        "send_message",
        {

            sender:
                currentUser,

            receiver:
                selectedUser ||
                selectedGroup,

            room:
                currentRoom,

            message:
                fileUrl,

            type:
                "file"
        }
    );
}

/* =========================
PROFILE
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
        `${API_URL}/uploads/${data.filename}?t=${Date.now()}`;

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

async function saveBio() {

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
                    ).value
            })
        }
    );

    alert(
        "Bio updated"
    );
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
PASSWORD
========================= */

function togglePassword() {

    const passwordInput =
        document.getElementById(
            "password"
        );

    const eyeButton =
        document.querySelector(
            ".eye-btn"
        );

    if (
        passwordInput.type ===
        "password"
    ) {

        passwordInput.type =
            "text";

        eyeButton.innerHTML =
            "👁️‍🗨️";

    } else {

        passwordInput.type =
            "password";

        eyeButton.innerHTML =
            "👁";
    }
}
/* =========================
GROUP ACTIONS
========================= */

async function addFriendToGroup(
    groupId
) {

    const friendId =
        prompt(
            "Enter Friend User ID"
        );

    if (!friendId) return;

    const response = await fetch(
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

    const data =
        await response.json();

    if (data.success) {

        alert(
            "Friend added"
        );

    } else {

        alert(
            data.message
        );
    }
}

async function removeFriendFromGroup(
    groupId
) {

    const friendId =
        prompt(
            "Enter Friend User ID"
        );

    if (!friendId) return;

    await fetch(
        `${API_URL}/remove_group_member`,
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
        "Friend removed"
    );
}

async function removeGroup(
    groupId
) {

    const confirmDelete =
        confirm(
            "Delete this group?"
        );

    if (!confirmDelete)
        return;

    await fetch(
        `${API_URL}/delete_group/${groupId}`,
        {
            method: "DELETE"
        }
    );

    clearChatState();

    loadGroups();
}
/* =========================
FIXED GROUP UI
========================= */

async function loadGroups() {

    const response =
        await fetch(
            `${API_URL}/groups/${currentUserId}`
        );

    const groups =
        await response.json();

    const container =
        document.getElementById(
            "groupsList"
        );

    container.innerHTML = "";

    groups.forEach(group => {

        container.innerHTML += `

            <div class="user-item">

                <div
                    style="
                        flex:1;
                        display:flex;
                        align-items:center;
                        gap:12px;
                    "

                    onclick="openGroup(
                        '${group.groupName}',
                        '${group.groupId}'
                    )"
                >

                    <div class="user-avatar">

                        ${
                            group.groupPicture

                            ? `
                            <img
                                src="${group.groupPicture}"
                            >
                            `

                            : "#"
                        }

                    </div>

                    <div>

                        <div class="user-name">
                            ${group.groupName}
                        </div>

                    </div>

                </div>

                <button
                    class="mini-btn"
                    onclick="
                        event.stopPropagation();
                        addFriendToGroup('${group.groupId}')
                    "
                >
                    +
                </button>

                <button
                    class="mini-btn"
                    onclick="
                        event.stopPropagation();
                        removeFriendFromGroup('${group.groupId}')
                    "
                >
                    −
                </button>

                <button
                    class="mini-btn"
                    onclick="
                        event.stopPropagation();
                        removeGroup('${group.groupId}')
                    "
                >
                    🗑
                </button>

            </div>
        `;
    });
}

/* =========================
FIXED AUTO SCROLL
========================= */

function addMessageToUI(data) {

    const div =
        document.createElement(
            "div"
        );

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
        decryptMessage(
            data.message
        );

    div.innerHTML = `

        <div class="username">
            ${data.sender}
        </div>

        <div>
            ${content}
        </div>

        <div class="timestamp">
            ${new Date(
                data.timestamp + "Z"
            ).toLocaleTimeString([], {

                hour: "2-digit",
                minute: "2-digit",

                hour12: true
            })}
        </div>
    `;

    messagesContainer.appendChild(
        div
    );

    const chatContent =
    document.querySelector(
        ".chat-content"
    );

requestAnimationFrame(() => {

    chatContent.scrollTop =
        chatContent.scrollHeight;
});
}