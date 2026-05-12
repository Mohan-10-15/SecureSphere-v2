from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory
)

from flask_cors import CORS

from flask_socketio import (
    SocketIO,
    emit
)

from flask_bcrypt import Bcrypt

from werkzeug.utils import secure_filename

from models import *

import os

# =========================
# APP
# =========================

app = Flask(__name__)

app.config[
    "SQLALCHEMY_DATABASE_URI"
] = "sqlite:///users.db"

app.config[
    "SQLALCHEMY_TRACK_MODIFICATIONS"
] = False

db.init_app(app)

bcrypt = Bcrypt(app)

CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

# =========================
# UPLOADS
# =========================

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)

# =========================
# DB INIT
# =========================

with app.app_context():

    db.create_all()

# =========================
# FRONTEND ROUTES
# =========================

@app.route("/")
def home():

    return send_from_directory(
        "../frontend",
        "index.html"
    )

@app.route("/<path:path>")
def frontend_files(path):

    return send_from_directory(
        "../frontend",
        path
    )

# =========================
# ONLINE USERS
# =========================

online_users = {}

# =========================
# SIGNUP
# =========================

@app.route(
    "/signup",
    methods=["POST"]
)
def signup():

    data = request.json

    existing = User.query.filter_by(
        username=data["username"]
    ).first()

    if existing:

        return jsonify({

            "success": False,

            "message":
                "Username already exists"
        })

    hashed = bcrypt.generate_password_hash(
        data["password"]
    ).decode("utf-8")

    user = User(

        username=data["username"],

        password=hashed,

        user_id=data["userId"]
    )

    db.session.add(user)

    db.session.commit()

    return jsonify({

        "success": True,

        "message":
            "Signup successful"
    })

# =========================
# LOGIN
# =========================

@app.route(
    "/login",
    methods=["POST"]
)
def login():

    data = request.json

    user = User.query.filter_by(
        username=data["username"]
    ).first()

    if not user:

        return jsonify({
            "success": False
        })

    valid = bcrypt.check_password_hash(
        user.password,
        data["password"]
    )

    if not valid:

        return jsonify({
            "success": False
        })

    return jsonify({

        "success": True,

        "userId":
            user.user_id,

        "bio":
            user.bio,

        "profilePicture":
            user.profile_picture
    })

# =========================
# FRIEND REQUEST
# =========================

@app.route(
    "/send_request",
    methods=["POST"]
)
def send_request():

    data = request.json

    if data["senderId"] == data["receiverId"]:

        return jsonify({
            "success": False
        })

    existing = FriendRequest.query.filter_by(

        sender_id=data["senderId"],

        receiver_id=data["receiverId"]
    ).first()

    if existing:

        return jsonify({
            "success": False
        })

    new_request = FriendRequest(

        sender_id=data["senderId"],

        receiver_id=data["receiverId"]
    )

    db.session.add(
        new_request
    )

    db.session.commit()

    socketio.emit(
        "friend_request_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# REQUESTS
# =========================

@app.route(
    "/requests/<user_id>"
)
def get_requests(user_id):

    requests = FriendRequest.query.filter_by(
        receiver_id=user_id
    ).all()

    response = []

    for req in requests:

        user = User.query.filter_by(
            user_id=req.sender_id
        ).first()

        if user:

            response.append({

                "senderId":
                    req.sender_id,

                "username":
                    user.username
            })

    return jsonify(response)

# =========================
# ACCEPT REQUEST
# =========================

@app.route(
    "/accept_request",
    methods=["POST"]
)
def accept_request():

    data = request.json

    friend = Friend(

        user1=data["senderId"],

        user2=data["receiverId"]
    )

    db.session.add(friend)

    FriendRequest.query.filter_by(

        sender_id=data["senderId"],

        receiver_id=data["receiverId"]
    ).delete()

    db.session.commit()

    socketio.emit(
        "friend_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# FRIENDS
# =========================

@app.route(
    "/friends/<user_id>"
)
def get_friends(user_id):

    friends = Friend.query.filter(
        (
            Friend.user1 == user_id
        ) |
        (
            Friend.user2 == user_id
        )
    ).all()

    response = []

    for friend in friends:

        other_id = (

            friend.user1

            if friend.user2 == user_id

            else friend.user2
        )

        user = User.query.filter_by(
            user_id=other_id
        ).first()

        if user:

            response.append({

                "username":
                    user.username,

                "userId":
                    user.user_id,

                "bio":
                    user.bio,

                "profilePicture":
                    user.profile_picture
            })

    return jsonify(response)

# =========================
# CREATE GROUP
# =========================

@app.route(
    "/create_group",
    methods=["POST"]
)
def create_group():

    data = request.json

    group = Group(

        group_name=data["groupName"],

        group_picture=data.get(
            "groupPicture",
            ""
        )
    )

    db.session.add(group)

    db.session.commit()

    member = GroupMember(

        group_id=group.id,

        user_id=data["creatorId"],

        role="admin"
    )

    db.session.add(member)

    db.session.commit()

    socketio.emit(
        "group_update"
    )

    return jsonify({

        "success": True,

        "groupId":
            group.id
    })

# =========================
# GET GROUPS
# =========================

@app.route(
    "/groups/<user_id>"
)
def get_groups(user_id):

    memberships = GroupMember.query.filter_by(
        user_id=user_id
    ).all()

    response = []

    for member in memberships:

        group = Group.query.filter_by(
            id=member.group_id
        ).first()

        if group:

            response.append({

                "groupId":
                    group.id,

                "groupName":
                    group.group_name,

                "groupPicture":
                    group.group_picture
            })

    return jsonify(response)

# =========================
# ADD GROUP MEMBER
# =========================

@app.route(
    "/add_group_member",
    methods=["POST"]
)
def add_group_member():

    data = request.json

    member = GroupMember(

        group_id=data["groupId"],

        user_id=data["userId"]
    )

    db.session.add(member)

    db.session.commit()

    socketio.emit(
        "group_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# REMOVE GROUP MEMBER
# =========================

@app.route(
    "/remove_group_member",
    methods=["POST"]
)
def remove_group_member():

    data = request.json

    GroupMember.query.filter_by(

        group_id=data["groupId"],

        user_id=data["userId"]
    ).delete()

    db.session.commit()

    socketio.emit(
        "group_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# DELETE GROUP
# =========================

@app.route(
    "/delete_group/<group_id>",
    methods=["DELETE"]
)
def delete_group(group_id):

    Group.query.filter_by(
        id=group_id
    ).delete()

    GroupMember.query.filter_by(
        group_id=group_id
    ).delete()

    db.session.commit()

    socketio.emit(
        "group_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# UPDATE GROUP PICTURE
# =========================

@app.route(
    "/update_group_picture",
    methods=["POST"]
)
def update_group_picture():

    data = request.json

    group = Group.query.filter_by(
        id=data["groupId"]
    ).first()

    if not group:

        return jsonify({
            "success": False
        })

    group.group_picture = data[
        "groupPicture"
    ]

    db.session.commit()

    socketio.emit(
        "group_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# PROFILE
# =========================

@app.route(
    "/update_profile",
    methods=["POST"]
)
def update_profile():

    data = request.json

    user = User.query.filter_by(
        username=data["username"]
    ).first()

    if not user:

        return jsonify({
            "success": False
        })

    user.bio = data["bio"]

    if "profilePicture" in data:

        user.profile_picture = data[
            "profilePicture"
        ]

    db.session.commit()

    return jsonify({
        "success": True
    })

# =========================
# MESSAGES
# =========================

@app.route(
    "/messages/<room>"
)
def get_messages(room):

    messages = Message.query.filter_by(
        room=room
    ).all()

    response = []

    for msg in messages:

        response.append({

            "id":
                msg.id,

            "sender":
                msg.sender,

            "message":
                msg.message,

            "room":
                msg.room,

            "type":
                msg.message_type,

            "timestamp":
                str(msg.timestamp),

            "status":
                msg.status
        })

    return jsonify(response)

# =========================
# UPLOAD
# =========================

@app.route(
    "/upload",
    methods=["POST"]
)
def upload():

    file = request.files["file"]

    filename = secure_filename(
        file.filename
    )

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename
    )

    file.save(filepath)

    return jsonify({
        "filename": filename
    })

@app.route(
    "/uploads/<filename>"
)
def uploaded_file(filename):

    return send_from_directory(
        UPLOAD_FOLDER,
        filename
    )

# =========================
# SOCKET EVENTS
# =========================

@socketio.on(
    "user_online"
)
def user_online(data):

    online_users[
        request.sid
    ] = data["username"]

    emit(

        "online_users",

        list(
            online_users.values()
        ),

        broadcast=True
    )

@socketio.on(
    "disconnect"
)
def disconnect():

    if request.sid in online_users:

        del online_users[
            request.sid
        ]

    emit(

        "online_users",

        list(
            online_users.values()
        ),

        broadcast=True
    )

@socketio.on(
    "typing"
)
def typing(data):

    emit(
        "typing",
        data,
        broadcast=True
    )

@socketio.on(
    "send_message"
)
def send_message(data):

    message = Message(

        sender=data["sender"],

        receiver=str(
            data["receiver"]
        ),

        room=data["room"],

        message=data["message"],

        message_type=data["type"],

        status="delivered"
    )

    db.session.add(message)

    db.session.commit()

    emit(

        "receive_message",

        {

            "id":
                message.id,

            "sender":
                message.sender,

            "message":
                message.message,

            "room":
                message.room,

            "type":
                message.message_type,

            "timestamp":
                str(message.timestamp),

            "status":
                message.status
        },

        broadcast=True
    )

# =========================
# RUN
# =========================

if __name__ == "__main__":

    print(
        "SecureSphere v5.1 FINAL Running"
    )

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    socketio.run(

        app,

        host="0.0.0.0",

        port=port,

        debug=True,

        allow_unsafe_werkzeug=True
    )