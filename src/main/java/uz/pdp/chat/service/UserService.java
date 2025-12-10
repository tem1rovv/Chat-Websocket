package uz.pdp.chat.service;

import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
public class UserService {
    private final Set<String> onlineUsers = new HashSet<String>();

    public void connect(String username){
        onlineUsers.add(username);
    }

    public void disconnect(String username) {
        onlineUsers.remove(username);
    }

    public Set<String> getOnlineUsers() {
        return onlineUsers;
    }
}
