package uz.pdp.chat.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.pdp.chat.entity.ChatMessage;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByChatId(String chatId);
}