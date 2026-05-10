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

# SIGNUP

@app.route("/signup", methods=["POST"])
def signup():

    data = request.json

    existing_user = User.query.filter_by(
        username=data["username"]
    ).first()

    if existing_user:

        return jsonify({
            "success": False,
            "message": "Username exists"
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

# LOGIN

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
            "bio": user.bio
        })

    return jsonify({
        "success": False
    })

# UPDATE PROFILE

@app.route("/update_profile", methods=["POST"])
def update_profile():

    data = request.json

    user = User.query.filter_by(
        username=data["username"]
    ).first()

    if user:

        user.bio = data["bio"]

        db.session.commit()

    return jsonify({
        "success": True
    })

# SEND FRIEND REQUEST

@app.route("/send_request", methods=["POST"])
def send_request():

    data = request.json

    existing = FriendRequest.query.filter_by(
        sender_id=data["senderId"],
        receiver_id=data["receiverId"]
    ).first()

    if existing:

        return jsonify({
            "success": False,
            "message": "Request already sent"
        })

    friend_request = FriendRequest(
        sender_id=data["senderId"],
        receiver_id=data["receiverId"]
    )

    db.session.add(friend_request)

    db.session.commit()

    socketio.emit("friend_request_update")

    return jsonify({
        "success": True
    })

# GET FRIEND REQUESTS

@app.route("/requests/<user_id>")
def get_requests(user_id):

    requests = FriendRequest.query.filter_by(
        receiver_id=user_id
    ).all()

    result = []

    for req in requests:

        sender = User.query.filter_by(
            user_id=req.sender_id
        ).first()

        if sender:

            result.append({
                "senderId": req.sender_id,
                "username": sender.username
            })

    return jsonify(result)

# ACCEPT FRIEND REQUEST

@app.route("/accept_request", methods=["POST"])
def accept_request():

    data = request.json

    FriendRequest.query.filter_by(
        sender_id=data["senderId"],
        receiver_id=data["receiverId"]
    ).delete()

    friend = Friend(
        user1=data["senderId"],
        user2=data["receiverId"]
    )

    db.session.add(friend)

    db.session.commit()

    socketio.emit("friend_update")

    return jsonify({
        "success": True
    })

# GET FRIENDS

@app.route("/friends/<user_id>")
def get_friends(user_id):

    friends = Friend.query.filter(
        (Friend.user1 == user_id) |
        (Friend.user2 == user_id)
    ).all()

    result = []

    for friend in friends:

        friend_id = (
            friend.user2
            if friend.user1 == user_id
            else friend.user1
        )

        user = User.query.filter_by(
            user_id=friend_id
        ).first()

        if user:

            result.append({
                "username": user.username,
                "userId": user.user_id
            })

    return jsonify(result)

# CREATE GROUP

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
        user_id=data["creatorId"]
    )

    db.session.add(member)

    db.session.commit()

    socketio.emit("group_update")

    return jsonify({
        "success": True,
        "groupId": group.id
    })

# GET GROUPS

@app.route("/groups/<user_id>")
def get_groups(user_id):

    memberships = GroupMember.query.filter_by(
        user_id=user_id
    ).all()

    result = []

    for membership in memberships:

        group = Group.query.get(
            membership.group_id
        )

        if group:

            result.append({
                "groupId": group.id,
                "groupName": group.group_name
            })

    return jsonify(result)

# DELETE GROUP

@app.route("/delete_group/<int:group_id>", methods=["DELETE"])
def delete_group(group_id):

    GroupMember.query.filter_by(
        group_id=group_id
    ).delete()

    Group.query.filter_by(
        id=group_id
    ).delete()

    db.session.commit()

    socketio.emit("group_update")

    return jsonify({
        "success": True
    })

# ADD GROUP MEMBER

@app.route("/add_group_member", methods=["POST"])
def add_group_member():

    data = request.json

    member = GroupMember(
        group_id=data["groupId"],
        user_id=data["userId"]
    )

    db.session.add(member)

    db.session.commit()

    socketio.emit("group_update")

    return jsonify({
        "success": True
    })

# GET MESSAGES

@app.route("/messages/<room>")
def get_messages(room):

    messages = Message.query.filter_by(
        room=room
    ).all()

    result = []

    for msg in messages:

        result.append({
            "sender": msg.sender,
            "receiver": msg.receiver,
            "room": msg.room,
            "message": msg.message,
            "type": msg.type
        })

    return jsonify(result)

# SEND MESSAGE (SOCKET)

@socketio.on("send_message")
def handle_message(data):

    message = Message(
        sender=data["sender"],
        receiver=str(data["receiver"]),
        room=data["room"],
        message=data["message"],
        type=data.get("type", "text")
    )

    db.session.add(message)

    db.session.commit()

    emit(
        "receive_message",
        data,
        room=data["room"],
        broadcast=True
    )

# UPLOAD FILE

@app.route("/upload", methods=["POST"])
def upload_file():

    file = request.files["file"]

    filename = secure_filename(file.filename)

    file.save(
        os.path.join(
            UPLOAD_FOLDER,
            filename
        )
    )

    return jsonify({
        "filename": filename
    })

# SERVE UPLOADS

@app.route("/uploads/<filename>")
def serve_file(filename):

    return send_from_directory(
        UPLOAD_FOLDER,
        filename
    )

if __name__ == "__main__":

    socketio.run(app)
