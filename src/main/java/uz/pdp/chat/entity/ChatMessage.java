package uz.pdp.chat.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity // Bazada jadval bo'lishi uchun
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String chatId; // Private chat uchun unikal ID (masalan: ali_vali)
    private String sender; // Kimdan
    private String recipient;
    // Kimga (null bo'lsa Public xabar)
    @Lob // Katta hajmdagi ma'lumot (Large Object)
    @Column(columnDefinition = "TEXT")
    private String content;   // Xabar
    private Date timestamp;   // Vaqt

    @Enumerated(EnumType.STRING)
    private MessageType type;

    public enum MessageType {
        CHAT, JOIN, LEAVE, TYPING, // Yangi: Yozmoqda...
        IMAGE
    }
}