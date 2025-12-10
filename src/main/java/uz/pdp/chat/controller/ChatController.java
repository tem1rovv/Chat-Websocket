package uz.pdp.chat.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import uz.pdp.chat.entity.ChatMessage;
import uz.pdp.chat.repository.ChatMessageRepository;
import uz.pdp.chat.service.UserService;

import java.util.Date;
import java.util.List;
import java.util.Set;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final ChatMessageRepository chatMessageRepository;
    private final UserService userService;

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage) {
        userService.connect(chatMessage.getSender());
        return chatMessage;
    }

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getType() == ChatMessage.MessageType.TYPING) {
            messagingTemplate.convertAndSend("/topic/private/" + chatMessage.getRecipient(), chatMessage);
        }
        chatMessage.setTimestamp(new Date());
        chatMessage.setChatId("public");
        try {
            chatMessageRepository.save(chatMessage);
        } catch (Exception e) {
            System.out.println("Xabarni saqlashda xatolik: " + e.getMessage());
        }
        return chatMessage;
    }

    @MessageMapping("/chat.private")
    public void sendPrivateMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getType() == ChatMessage.MessageType.TYPING) {
            messagingTemplate.convertAndSend("/topic/private/" + chatMessage.getRecipient(), chatMessage);
            return;
        }

        chatMessage.setTimestamp(new Date());
        String chatId = getChatId(chatMessage.getSender(), chatMessage.getRecipient());
        chatMessage.setChatId(chatId);

        chatMessageRepository.save(chatMessage);

        messagingTemplate.convertAndSend("/topic/private/" + chatMessage.getRecipient(), chatMessage);

        messagingTemplate.convertAndSend("/topic/private/" + chatMessage.getSender(), chatMessage);
    }

    @GetMapping("/messages/{sender}/{recipient}")
    @ResponseBody
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String sender,
                                                              @PathVariable String recipient) {
        String chatId = "public".equals(recipient) ? "public" : getChatId(sender, recipient);
        return ResponseEntity.ok(chatMessageRepository.findByChatId(chatId));
    }

    @GetMapping("/users")
    @ResponseBody
    public Set<String> getConnectedUsers() {
        return userService.getOnlineUsers();
    }

    private String getChatId(String sender, String recipient) {
        if (sender == null || recipient == null) return "unknown";
        return sender.compareTo(recipient) > 0 ? sender + "_" + recipient : recipient + "_" + sender;
    }
}