package uz.pdp.chat.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String chatId;
    private String sender;
    private String recipient;
    @Lob
    @Column(columnDefinition = "TEXT")
    private String content;
    private Date timestamp;

    @Enumerated(EnumType.STRING)
    private MessageType type;

    public enum MessageType {
        CHAT, JOIN, LEAVE, TYPING,
        IMAGE, FILE, AUDIO
    }
}