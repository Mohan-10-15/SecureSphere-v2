from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# =========================
# USER
# =========================

class User(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    username = db.Column(
        db.String(100),
        unique=True,
        nullable=False
    )

    user_id = db.Column(
        db.String(20),
        unique=True,
        nullable=False
    )

    password = db.Column(
        db.String(200),
        nullable=False
    )

    bio = db.Column(
        db.String(300),
        default=""
    )

    profile_picture = db.Column(
        db.String(500),
        default=""
    )

# =========================
# FRIEND REQUEST
# =========================

class FriendRequest(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    sender_id = db.Column(
        db.String(20),
        nullable=False
    )

    receiver_id = db.Column(
        db.String(20),
        nullable=False
    )

# =========================
# FRIENDS
# =========================

class Friend(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user1 = db.Column(
        db.String(20),
        nullable=False
    )

    user2 = db.Column(
        db.String(20),
        nullable=False
    )

# =========================
# GROUP
# =========================

class Group(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    group_name = db.Column(
        db.String(100),
        nullable=False
    )

    group_image = db.Column(
        db.String(500),
        default=""
    )

# =========================
# GROUP MEMBER
# =========================

class GroupMember(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    group_id = db.Column(
        db.Integer,
        nullable=False
    )

    user_id = db.Column(
        db.String(20),
        nullable=False
    )

    role = db.Column(
        db.String(20),
        default="member"
    )

# =========================
# MESSAGE
# =========================

class Message(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    sender = db.Column(
        db.String(100),
        nullable=False
    )

    receiver = db.Column(
        db.String(100),
        nullable=False
    )

    room = db.Column(
        db.String(200),
        nullable=False
    )

    message = db.Column(
        db.Text,
        nullable=False
    )

    message_type = db.Column(
        db.String(20),
        default="text"
    )

    timestamp = db.Column(
        db.DateTime,
        default=db.func.now()
    )

    status = db.Column(
        db.String(20),
        default="sent"
    )

# =========================
# REACTIONS
# =========================

class Reaction(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    message_id = db.Column(
        db.Integer,
        nullable=False
    )

    emoji = db.Column(
        db.String(10)
    )