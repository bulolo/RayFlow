package com.rayflow.server.security;

import com.rayflow.common.exception.BusinessException;
import com.rayflow.common.result.ResultCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class SecretCipher {

    private static final String PREFIX = "enc:v1:";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecureRandom secureRandom = new SecureRandom();
    private final SecretKeySpec keySpec;

    public SecretCipher(@Value("${rayflow.security.encryption-key:${rayflow.jwt.secret}}") String encryptionKey) {
        if (!StringUtils.hasText(encryptionKey)) {
            throw new IllegalStateException("RAYFLOW_SECRET_ENCRYPTION_KEY or JWT_SECRET must be configured.");
        }
        this.keySpec = new SecretKeySpec(sha256(encryptionKey), "AES");
    }

    public String encrypt(String plaintext) {
        if (!StringUtils.hasText(plaintext) || plaintext.startsWith(PREFIX)) {
            return plaintext;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
            buffer.put(iv);
            buffer.put(ciphertext);
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.array());
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "敏感配置加密失败");
        }
    }

    public String decrypt(String value) {
        if (!StringUtils.hasText(value) || !value.startsWith(PREFIX)) {
            return value;
        }
        try {
            byte[] payload = Base64.getUrlDecoder().decode(value.substring(PREFIX.length()));
            if (payload.length <= IV_LENGTH) {
                throw new IllegalArgumentException("invalid encrypted payload");
            }
            byte[] iv = new byte[IV_LENGTH];
            byte[] ciphertext = new byte[payload.length - IV_LENGTH];
            System.arraycopy(payload, 0, iv, 0, IV_LENGTH);
            System.arraycopy(payload, IV_LENGTH, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "敏感配置解密失败");
        }
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
