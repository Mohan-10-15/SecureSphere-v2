from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename

from models import *

import os

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///users.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)

db.init_app(app)

bcrypt = Bcrypt(app)

CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

with app.app_context():
    db.create_all()

# =========================
# ONLINE USERS
# =========================

online_users = set()

# =========================
# SIGNUP
# =========================

@app.route("/signup", methods=["POST"])
def signup():

    data = request.json

    existing_user = User.query.filter_by(
        username=data["username"]
    ).first()

    if existing_user:

        return jsonify({
            "success": False,
            "message": "Username already exists"
        })

    hashed_password = bcrypt.generate_password_hash(
        data["password"]
    ).decode("utf-8")

    user = User(
        username=data["username"],
        password=hashed_password,
        user_id=data["userId"]
    )

    db.session.add(user)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Signup successful"
    })

# =========================
# LOGIN
# =========================

@app.route("/login", methods=["POST"])
def login():

    data = request.json

    user = User.query.filter_by(
        username=data["username"]
    ).first()

    if user and bcrypt.check_password_hash(
        user.password,
        data["password"]
    ):

        return jsonify({
            "success": True,
            "userId": user.user_id,
            "bio": user.bio,
            "profilePicture": user.profile_picture
        })

    return jsonify({
        "success": False
    })

# =========================
# UPDATE PROFILE
# =========================

@app.route("/update_profile", methods=["POST"])
def update_profile():

    data = request.json

    user = User.query.filter_by(
        username=data["username"]
    ).first()

    if user:

        user.bio = data["bio"]

        if "profilePicture" in data:

            user.profile_picture = data["profilePicture"]

        db.session.commit()

    return jsonify({
        "success": True
    })

# =========================
# FRIEND REQUEST
# =========================

@app.route("/send_request", methods=["POST"])
def send_request():

    data = request.json

    existing = FriendRequest.query.filter_by(
        sender_id=data["senderId"],
        receiver_id=data["receiverId"]
    ).first()

    if existing:

        return jsonify({
            "success": False
        })

    req = FriendRequest(
        sender_id=data["senderId"],
        receiver_id=data["receiverId"]
    )

    db.session.add(req)

    db.session.commit()

    socketio.emit(
        "friend_request_update"
    )

    return jsonify({
        "success": True
    })

# =========================
# GET REQUESTS
# =========================

@app.route("/requests/<user_id>")
def requests(user_id):

    requests = FriendRequest.query.filter_by(
        receiver_id=user_id
    ).all()

    data = []

    for req in requests:

        user = User.query.filter_by(
            user_id=req.sender_id
        ).first()

        data.append({
            "senderId": req.sender_id,
            "username": user.username
        })

    return jsonify(data)

# =========================
# ACCEPT FRIEND
# =========================

@app.route("/accept_request", methods=["POST"])
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

@app.route("/friends/<user_id>")
def friends(user_id):

    friends = Friend.query.filter(
        (
            Friend.user1 == user_id
        ) |
        (
            Friend.user2 == user_id
        )
    ).all()

    data = []

    for friend in friends:

        other_id = (
            friend.user1
            if friend.user2 == user_id
            else friend.user2
        )

        user = User.query.filter_by(
            user_id=other_id
        ).first()

        data.append({
            "username": user.username,
            "userId": user.user_id,
            "bio": user.bio,
            "profilePicture": user.profile_picture
        })

    return jsonify(data)

# =========================
# CREATE GROUP
# =========================

@app.route("/create_group", methods=["POST"])
def create_group():

    data = request.json

    group = Group(
        group_name=data["groupName"]
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
        "groupId": group.id
    })

# =========================
# GROUPS
# =========================

@app.route("/groups/<user_id>")
def groups(user_id):

    memberships = GroupMember.query.filter_by(
        user_id=user_id
    ).all()

    data = []

    for member in memberships:

        group = Group.query.filter_by(
            id=member.group_id
        ).first()

        data.append({
            "groupId": group.id,
            "groupName": group.group_name,
            "groupImage": group.group_image,
            "role": member.role
        })

    return jsonify(data)

# =========================
# DELETE GROUP
# =========================

@app.route("/delete_group/<group_id>", methods=["DELETE"])
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
# ADD GROUP MEMBER
# =========================

@app.route("/add_group_member", methods=["POST"])
def add_group_member():

    data = request.json

    existing = GroupMember.query.filter_by(
        group_id=data["groupId"],
        user_id=data["userId"]
    ).first()

    if existing:

        return jsonify({
            "success": False
        })

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
# GET MESSAGES
# =========================

@app.route("/messages/<room>")
def messages(room):

    messages = Message.query.filter_by(
        room=room
    ).all()

    data = []

    for msg in messages:

        reactions = Reaction.query.filter_by(
            message_id=msg.id
        ).all()

        reaction_list = []

        for r in reactions:

            reaction_list.append(r.emoji)

        data.append({
            "id": msg.id,
            "sender": msg.sender,
            "receiver": msg.receiver,
            "room": msg.room,
            "message": msg.message,
            "type": msg.message_type,
            "timestamp": str(msg.timestamp),
            "status": msg.status,
            "reactions": reaction_list
        })

    return jsonify(data)

# =========================
# REACTIONS
# =========================

@app.route("/react", methods=["POST"])
def react():

    data = request.json

    reaction = Reaction(
        message_id=data["messageId"],
        emoji=data["emoji"]
    )

    db.session.add(reaction)

    db.session.commit()

    return jsonify({
        "success": True
    })

# =========================
# SEEN
# =========================

@app.route("/seen/<message_id>", methods=["POST"])
def seen(message_id):

    msg = Message.query.get(
        message_id
    )

    if msg:

        msg.status = "seen"

        db.session.commit()

    return jsonify({
        "success": True
    })

# =========================
# FILE UPLOAD
# =========================

@app.route("/upload", methods=["POST"])
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

# =========================
# FILES
# =========================

@app.route("/uploads/<filename>")
def uploaded_file(filename):

    return send_from_directory(
        UPLOAD_FOLDER,
        filename
    )

# =========================
# ONLINE STATUS
# =========================

@socketio.on("user_online")
def user_online(data):

    online_users.add(
        data["username"]
    )

    emit(
        "online_users",
        list(online_users),
        broadcast=True
    )

# =========================
# TYPING
# =========================

@socketio.on("typing")
def typing(data):

    emit(
        "typing",
        data,
        broadcast=True
    )

# =========================
# SEND MESSAGE
# =========================

@socketio.on("send_message")
def handle_message(data):

    msg = Message(
        sender=data["sender"],
        receiver=str(data["receiver"]),
        room=data["room"],
        message=data["message"],
        message_type=data["type"]
    )

    db.session.add(msg)

    db.session.commit()

    emit(
        "receive_message",
        {
            "id": msg.id,
            "sender": msg.sender,
            "receiver": msg.receiver,
            "room": msg.room,
            "message": msg.message,
            "type": msg.message_type,
            "timestamp": str(msg.timestamp),
            "status": msg.status,
            "reactions": []
        },
        broadcast=True
    )

# =========================
# RUN
# =========================

if __name__ == "__main__":

    socketio.run(
        app,
        host="0.0.0.0",
        port=5000
    )