package com.fling.service;

import com.fling.entity.User;
import com.fling.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public final class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getDefaultUser() {
        log.debug("Loading default user from the database");
        return userRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No default user found — has the application initialised correctly?"));
    }
}
