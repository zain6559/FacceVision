import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class SecureCryptoManager:
    """
    تأمين وحماية تشفير البصمات الرياضية والبيانات الحساسة باستخدام AES-256-GCM.
    """
    def __init__(self, key_env_var: str = "FACE_SECURE_SECRET"):
        secret = os.environ.get(key_env_var, "A" * 32)
        if len(secret) < 32:
            secret = secret.ljust(32, "0")
        self.key = secret[:32].encode("utf-8")
        self.aesgcm = AESGCM(self.key)

    def encrypt_data(self, plaintext: str) -> str:
        try:
            nonce = os.urandom(12)
            ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
            combined = nonce + ciphertext
            return base64.b64encode(combined).decode("utf-8")
        except Exception as e:
            print(f"Encryption error: {e}")
            return plaintext

    def decrypt_data(self, encrypted_b64: str) -> str:
        try:
            data = base64.b64decode(encrypted_b64.encode("utf-8"))
            nonce = data[:12]
            ciphertext = data[12:]
            decrypted = self.aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode("utf-8")
        except Exception as e:
            return encrypted_b64
