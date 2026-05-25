package com.fling.config;

import com.fling.entity.Environment;
import com.fling.entity.RequestCollection;
import com.fling.entity.User;
import com.fling.repository.EnvironmentRepository;
import com.fling.repository.RequestCollectionRepository;
import com.fling.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final UserRepository userRepository;
    private final RequestCollectionRepository collectionRepository;
    private final EnvironmentRepository environmentRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${fling.username:admin}")
    private String configuredUsername;

    @Value("${fling.password:fling}")
    private String configuredPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        initializeFirstUser();
    }

    private void initializeFirstUser() {
        List<User> users = userRepository.findAll();

        if (users.isEmpty()) {
            log.info("No users found — seeding default user, collection, and environment");
            var user = new User();
            applyCredentials(user);
            userRepository.save(user);
            createDefaultCollection(user);
            createDefaultEnvironment(user);
            log.info("Seeded default user '{}' with Default collection and Default environment", configuredUsername);
            return;
        }

        // Update credentials on every startup so env-var changes take effect
        for (var user : users) {
            applyCredentials(user);
            userRepository.save(user);

            if (environmentRepository.countByUser(user) == 0) {
                log.info("Backfilling Default environment for user {}", user.getId());
                createDefaultEnvironment(user);
            }
        }
    }

    private void applyCredentials(User user) {
        user.setUsername(configuredUsername);
        user.setPasswordHash(passwordEncoder.encode(configuredPassword));
    }

    private void createDefaultCollection(User user) {
        var defaultCollection = new RequestCollection();
        defaultCollection.setUser(user);
        defaultCollection.setName("Default");
        defaultCollection.setDescription("Your default collection");
        collectionRepository.save(defaultCollection);
    }

    private void createDefaultEnvironment(User user) {
        var defaultEnvironment = new Environment();
        defaultEnvironment.setUser(user);
        defaultEnvironment.setName("Default");
        environmentRepository.save(defaultEnvironment);
    }
}
