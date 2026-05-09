from Crypto.Cipher import AES
from Crypto.Util.Padding import (
    pad,
    unpad
)

import base64

# 32 BYTE AES KEY

SECRET_KEY = b"SecureSphereEncryptionKey123"

# ENCRYPT

def encrypt_message(message):

    cipher = AES.new(
        SECRET_KEY,
        AES.MODE_CBC
    )

    encrypted_bytes = cipher.encrypt(
        pad(
            message.encode(),
            AES.block_size
        )
    )

    encrypted_data = base64.b64encode(
        cipher.iv + encrypted_bytes
    ).decode()

    return encrypted_data

# DECRYPT

def decrypt_message(encrypted_message):

    encrypted_data = base64.b64decode(
        encrypted_message
    )

    iv = encrypted_data[:16]

    encrypted_bytes = encrypted_data[16:]

    cipher = AES.new(
        SECRET_KEY,
        AES.MODE_CBC,
        iv
    )

    decrypted = unpad(
        cipher.decrypt(
            encrypted_bytes
        ),
        AES.block_size
    )

    return decrypted.decode()