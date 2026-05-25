package com.fling.service;

import com.fling.entity.User;
import com.fling.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public final class UserService {

    private final User defaultUser;

    public UserService(UserRepository userRepository) {
        log.debug("Loading default user from the database");
        defaultUser = userRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No default user found — has the application initialised correctly?"));
    }

    public User getDefaultUser() {
        return defaultUser;
    }
}
